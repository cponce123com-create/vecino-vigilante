import { Router, type IRouter } from "express";
import { db, contratacionesTable, entidadesTable, proveedoresTable, syncLogTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const OCDS_BASE = process.env.OCDS_API_BASE ?? "https://contratacionesabiertas.osce.gob.pe/api";

const JUNIN_PREFIX = "12";

function mapOcdsToContratacion(release: Record<string, unknown>) {
  const tender = (release.tender as Record<string, unknown>) ?? {};
  const awards = (release.awards as Record<string, unknown>[]) ?? [];
  const contracts = (release.contracts as Record<string, unknown>[]) ?? [];
  const planning = (release.planning as Record<string, unknown>) ?? {};
  const buyer = (release.buyer as Record<string, unknown>) ?? {};

  const award = awards[0] ?? {};
  const contract = contracts[0] ?? {};
  const awardSuppliers = (award.suppliers as Record<string, unknown>[]) ?? [];
  const supplier = awardSuppliers[0] ?? {};

  const buyerIdentifier = (buyer.identifier as Record<string, unknown>) ?? {};
  const supplierIdentifier = (supplier.identifier as Record<string, unknown>) ?? {};

  const tenderValue = (tender.value as Record<string, unknown>) ?? {};
  const awardValue = (award.value as Record<string, unknown>) ?? {};

  const additionalIdentifiers = ((buyer as Record<string, unknown>).additionalIdentifiers as Record<string, unknown>[]) ?? [];
  const ubigeoId = additionalIdentifiers.find((i) => (i as Record<string, unknown>).scheme === "PE-UBIGEO") as Record<string, unknown> | undefined;
  const ubigeoCodigo = ubigeoId?.id as string | undefined;

  return {
    ocid: release.ocid as string,
    nomenclatura: (tender.id as string) ?? null,
    titulo: (tender.title as string) ?? (release.ocid as string),
    descripcion: (tender.description as string) ?? null,
    tipo: mapTipo((tender.mainProcurementCategory as string) ?? ""),
    procedimiento: mapProcedimiento((tender.procurementMethodDetails as string) ?? ""),
    estado: mapEstado((tender.status as string) ?? ""),
    entidadRuc: (buyerIdentifier.id as string) ?? null,
    proveedorRuc: (supplierIdentifier.id as string) ?? null,
    ubigeoCodigo: ubigeoCodigo ?? null,
    montoReferencial: tenderValue.amount ? String(tenderValue.amount) : null,
    montoAdjudicado: awardValue.amount ? String(awardValue.amount) : null,
    moneda: (tenderValue.currency as string) ?? "PEN",
    fechaConvocatoria: tender.tenderPeriod
      ? new Date((tender.tenderPeriod as Record<string, unknown>).startDate as string)
      : null,
    fechaAdjudicacion: award.date ? new Date(award.date as string) : null,
    fechaContrato: contract.dateSigned ? new Date(contract.dateSigned as string) : null,
    plazoEjecucionDias: null,
    rawOcds: release,
  };
}

function mapTipo(category: string): string {
  const map: Record<string, string> = {
    goods: "BIENES",
    services: "SERVICIOS",
    works: "OBRAS",
    consultingServices: "CONSULTORIA",
  };
  return map[category] ?? "SERVICIOS";
}

function mapProcedimiento(method: string): string {
  const m = method.toUpperCase();
  if (m.includes("LICITACION") || m.includes("LP")) return "LP";
  if (m.includes("ADJUDICACION SIMPLIFICADA") || m.includes("AS")) return "AS";
  if (m.includes("SUBASTA") || m.includes("SM")) return "SM";
  if (m.includes("CONCURSO") || m.includes("CP")) return "CP";
  if (m.includes("DIRECTA") || m.includes("CD")) return "CD";
  if (m.includes("COMPARACION") || m.includes("CE")) return "CE";
  return method.slice(0, 10) || "AS";
}

function mapEstado(status: string): string {
  const map: Record<string, string> = {
    planning: "CONVOCADO",
    planned: "CONVOCADO",
    active: "CONVOCADO",
    complete: "FINALIZADO",
    cancelled: "NULO",
    unsuccessful: "DESIERTO",
  };
  return map[status] ?? "CONVOCADO";
}

router.post("/sync", async (req, res): Promise<void> => {
  const secret = process.env.SYNC_SECRET;
  if (secret && req.headers["x-sync-secret"] !== secret) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  const syncId = randomUUID();
  let registrosProcesados = 0;
  let registrosNuevos = 0;
  let registrosActualizados = 0;
  const errores: unknown[] = [];

  try {
    const url = `${OCDS_BASE}/releases/?page=1&size=100`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });

    if (!response.ok) {
      throw new Error(`OCDS API error: ${response.status}`);
    }

    const data = await response.json() as { results?: Record<string, unknown>[]; data?: Record<string, unknown>[] };
    const releases = data.results ?? data.data ?? [];

    const juninReleases = releases.filter((r) => {
      const additionalIdentifiers = ((r.buyer as Record<string, unknown>)?.additionalIdentifiers as Record<string, unknown>[]) ?? [];
      const ubigeoId = additionalIdentifiers.find((i) => (i as Record<string, unknown>).scheme === "PE-UBIGEO") as Record<string, unknown> | undefined;
      const ubigeo = ubigeoId?.id as string | undefined;
      return ubigeo?.startsWith(JUNIN_PREFIX);
    });

    for (const release of juninReleases) {
      try {
        registrosProcesados++;
        const mapped = mapOcdsToContratacion(release);

        if (mapped.entidadRuc) {
          await db
            .insert(entidadesTable)
            .values({
              ruc: mapped.entidadRuc,
              nombre: ((release.buyer as Record<string, unknown>)?.name as string) ?? mapped.entidadRuc,
              tipo: "MUNICIPALIDAD",
              nivelGobierno: "LOCAL",
            })
            .onConflictDoNothing();
        }

        if (mapped.proveedorRuc && mapped.proveedorRuc !== "") {
          const suppliers = (((release.awards as Record<string, unknown>[])?.[0])?.suppliers as Record<string, unknown>[]) ?? [];
          const supplierName = (suppliers[0]?.name as string) ?? mapped.proveedorRuc;
          await db
            .insert(proveedoresTable)
            .values({
              ruc: mapped.proveedorRuc,
              razonSocial: supplierName,
            })
            .onConflictDoNothing();
        }

        const existing = await db
          .select({ ocid: contratacionesTable.ocid })
          .from(contratacionesTable)
          .where(eq(contratacionesTable.ocid, mapped.ocid))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(contratacionesTable).values({
            ...mapped,
            rawOcds: mapped.rawOcds as Record<string, unknown>,
          });
          registrosNuevos++;
        } else {
          await db
            .update(contratacionesTable)
            .set({
              estado: mapped.estado,
              montoAdjudicado: mapped.montoAdjudicado,
              fechaAdjudicacion: mapped.fechaAdjudicacion,
              fechaContrato: mapped.fechaContrato,
              rawOcds: mapped.rawOcds as Record<string, unknown>,
            })
            .where(eq(contratacionesTable.ocid, mapped.ocid));
          registrosActualizados++;
        }
      } catch (err) {
        errores.push({ ocid: (release as Record<string, unknown>).ocid, error: String(err) });
      }
    }

    await db.insert(syncLogTable).values({
      id: syncId,
      registrosProcesados,
      registrosNuevos,
      registrosActualizados,
      errores: errores.length > 0 ? errores : null,
      estado: errores.length > 0 ? "PARCIAL" : "OK",
    });

    res.json({
      message: "Sincronización completada",
      registrosProcesados,
      registrosNuevos,
      registrosActualizados,
      estado: errores.length > 0 ? "PARCIAL" : "OK",
    });
  } catch (err) {
    await db.insert(syncLogTable).values({
      id: syncId,
      registrosProcesados,
      registrosNuevos,
      registrosActualizados,
      errores: [String(err)],
      estado: "ERROR",
    }).catch(() => {});

    req.log.error({ err }, "Sync error");
    res.status(500).json({ error: "Error en sincronización", estado: "ERROR", message: String(err), registrosProcesados, registrosNuevos, registrosActualizados });
  }
});

export default router;
