import { Router, type IRouter } from "express";
import {
  db,
  contratacionesTable,
  entidadesTable,
  proveedoresTable,
  syncLogTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const OCDS_BASE =
  process.env.OCDS_API_BASE ??
  "https://contratacionesabiertas.osce.gob.pe/api";

// Prefijo del código UBIGEO para la región Junín (departamento 12)
const JUNIN_PREFIX = "12";

// Máximo de páginas a procesar en una sola ejecución (protección contra loops)
const MAX_PAGES = 50;

// Tamaño de página recomendado por la API OCDS
const PAGE_SIZE = 100;

// Delay entre requests (ms) para no saturar la API pública
const REQUEST_DELAY_MS = 300;

// ────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch con reintentos y backoff exponencial.
 * Maneja errores transitorios de red y respuestas 5xx.
 */
async function fetchWithRetry(
  url: string,
  maxRetries = 3,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "VecinoVigilante/1.0 (Chanchamayo civic portal)",
        },
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      // Reintentar solo en errores 5xx o 429 (rate limit)
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`HTTP ${response.status}`);
        const backoff = 1000 * Math.pow(2, attempt);
        await sleep(backoff);
        continue;
      }

      return response;
    } catch (err) {
      lastError = err;
      const backoff = 1000 * Math.pow(2, attempt);
      await sleep(backoff);
    }
  }

  throw lastError;
}

function extractUbigeo(
  release: Record<string, unknown>,
): string | null {
  const buyer = release.buyer as Record<string, unknown> | undefined;
  if (!buyer) return null;

  const additionalIdentifiers = (buyer.additionalIdentifiers as
    | Record<string, unknown>[]
    | undefined) ?? [];

  const ubigeoId = additionalIdentifiers.find(
    (i) => (i as Record<string, unknown>).scheme === "PE-UBIGEO",
  ) as Record<string, unknown> | undefined;

  return (ubigeoId?.id as string | undefined) ?? null;
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
    planning: "PLANIFICADO",
    planned: "PLANIFICADO",
    active: "CONVOCADO",
    tender: "CONVOCADO",
    complete: "ADJUDICADO",
    awarded: "ADJUDICADO",
    contract: "CONTRATADO",
    cancelled: "CANCELADO",
    unsuccessful: "DESIERTO",
    withdrawn: "ANULADO",
  };
  return map[status.toLowerCase()] ?? "CONVOCADO";
}

function safeDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function mapOcdsToContratacion(release: Record<string, unknown>) {
  const tender = (release.tender as Record<string, unknown>) ?? {};
  const awards = (release.awards as Record<string, unknown>[]) ?? [];
  const contracts = (release.contracts as Record<string, unknown>[]) ?? [];
  const buyer = (release.buyer as Record<string, unknown>) ?? {};

  const award = awards[0] ?? {};
  const contract = contracts[0] ?? {};
  const awardSuppliers =
    (award.suppliers as Record<string, unknown>[]) ?? [];
  const supplier = awardSuppliers[0] ?? {};

  const buyerIdentifier =
    (buyer.identifier as Record<string, unknown>) ?? {};
  const supplierIdentifier =
    (supplier.identifier as Record<string, unknown>) ?? {};

  const tenderValue = (tender.value as Record<string, unknown>) ?? {};
  const awardValue = (award.value as Record<string, unknown>) ?? {};

  const ubigeoCodigo = extractUbigeo(release);

  const tenderPeriod = tender.tenderPeriod as
    | Record<string, unknown>
    | undefined;

  return {
    ocid: release.ocid as string,
    nomenclatura: (tender.id as string) ?? null,
    titulo: (tender.title as string) ?? (release.ocid as string),
    descripcion: (tender.description as string) ?? null,
    tipo: mapTipo((tender.mainProcurementCategory as string) ?? ""),
    procedimiento: mapProcedimiento(
      (tender.procurementMethodDetails as string) ?? "",
    ),
    estado: mapEstado((tender.status as string) ?? ""),
    entidadRuc: (buyerIdentifier.id as string) ?? null,
    entidadNombre: (buyer.name as string) ?? null,
    proveedorRuc: (supplierIdentifier.id as string) ?? null,
    proveedorNombre: (supplier.name as string) ?? null,
    ubigeoCodigo,
    montoReferencial: tenderValue.amount
      ? String(tenderValue.amount)
      : null,
    montoAdjudicado: awardValue.amount
      ? String(awardValue.amount)
      : null,
    moneda: (tenderValue.currency as string) ?? "PEN",
    fechaConvocatoria: tenderPeriod
      ? safeDate(tenderPeriod.startDate)
      : null,
    fechaAdjudicacion: safeDate(award.date),
    fechaContrato: safeDate(contract.dateSigned),
    plazoEjecucionDias: null,
    rawOcds: release,
  };
}

// ────────────────────────────────────────────────────────────────────
// ENDPOINT PRINCIPAL
// ────────────────────────────────────────────────────────────────────

router.post("/sync", async (req, res): Promise<void> => {
  // Autenticación opcional via SYNC_SECRET
  const secret = process.env.SYNC_SECRET;
  if (secret && req.headers["x-sync-secret"] !== secret) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  const syncId = randomUUID();
  const startedAt = Date.now();

  let registrosProcesados = 0;
  let registrosNuevos = 0;
  let registrosActualizados = 0;
  let juninEncontrados = 0;
  let paginasRecorridas = 0;
  const errores: unknown[] = [];

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${OCDS_BASE}/releases/?page=${page}&size=${PAGE_SIZE}`;

      req.log.info({ page, url }, "Fetching OCDS page");

      const response = await fetchWithRetry(url);
      paginasRecorridas++;

      if (!response.ok) {
        throw new Error(
          `OCDS API error en página ${page}: ${response.status}`,
        );
      }

      const data = (await response.json()) as {
        results?: Record<string, unknown>[];
        data?: Record<string, unknown>[];
        pagination?: { total?: number; total_pages?: number };
      };

      const releases = data.results ?? data.data ?? [];

      // Si la página viene vacía, terminamos
      if (releases.length === 0) {
        req.log.info({ page }, "Empty page, stopping pagination");
        break;
      }

      // Filtrar solo releases de Junín
      const juninReleases = releases.filter((r) => {
        const ubigeo = extractUbigeo(r);
        return ubigeo?.startsWith(JUNIN_PREFIX);
      });

      juninEncontrados += juninReleases.length;

      for (const release of juninReleases) {
        try {
          registrosProcesados++;
          const mapped = mapOcdsToContratacion(release);

          // Validación mínima
          if (!mapped.ocid || !mapped.titulo) {
            errores.push({
              motivo: "Falta OCID o título",
              ocid: mapped.ocid,
            });
            continue;
          }

          // Upsert entidad
          if (mapped.entidadRuc) {
            await db
              .insert(entidadesTable)
              .values({
                ruc: mapped.entidadRuc,
                nombre: mapped.entidadNombre ?? mapped.entidadRuc,
                tipo: "MUNICIPALIDAD",
                nivelGobierno: "LOCAL",
                ubigeoCodigo: mapped.ubigeoCodigo,
              })
              .onConflictDoNothing();
          }

          // Upsert proveedor
          if (mapped.proveedorRuc) {
            await db
              .insert(proveedoresTable)
              .values({
                ruc: mapped.proveedorRuc,
                razonSocial:
                  mapped.proveedorNombre ?? mapped.proveedorRuc,
              })
              .onConflictDoNothing();
          }

          // Upsert contratación
          const existing = await db
            .select({ ocid: contratacionesTable.ocid })
            .from(contratacionesTable)
            .where(eq(contratacionesTable.ocid, mapped.ocid))
            .limit(1);

          // Separar campos que sí van a la tabla
          const {
            entidadNombre: _en,
            proveedorNombre: _pn,
            ...contratacionData
          } = mapped;

          if (existing.length === 0) {
            await db.insert(contratacionesTable).values({
              ...contratacionData,
              rawOcds: contratacionData.rawOcds as Record<
                string,
                unknown
              >,
            });
            registrosNuevos++;
          } else {
            await db
              .update(contratacionesTable)
              .set({
                estado: contratacionData.estado,
                montoAdjudicado: contratacionData.montoAdjudicado,
                fechaAdjudicacion: contratacionData.fechaAdjudicacion,
                fechaContrato: contratacionData.fechaContrato,
                proveedorRuc: contratacionData.proveedorRuc,
                rawOcds: contratacionData.rawOcds as Record<
                  string,
                  unknown
                >,
              })
              .where(eq(contratacionesTable.ocid, mapped.ocid));
            registrosActualizados++;
          }
        } catch (err) {
          errores.push({
            ocid: (release as Record<string, unknown>).ocid,
            error: String(err),
          });
        }
      }

      // Verificar si ya llegamos al final según la paginación
      const totalPages = data.pagination?.total_pages;
      if (totalPages && page >= totalPages) {
        req.log.info(
          { page, totalPages },
          "Reached last page, stopping",
        );
        break;
      }

      // Delay cortés entre requests
      await sleep(REQUEST_DELAY_MS);
    }

    const duracionMs = Date.now() - startedAt;
    const estado =
      errores.length > 0
        ? errores.length < registrosProcesados / 2
          ? "PARCIAL"
          : "ERROR"
        : "OK";

    await db.insert(syncLogTable).values({
      id: syncId,
      registrosProcesados,
      registrosNuevos,
      registrosActualizados,
      errores: errores.length > 0 ? errores.slice(0, 50) : null,
      estado,
    });

    res.json({
      message: "Sincronización completada",
      estado,
      duracionSegundos: Math.round(duracionMs / 1000),
      paginasRecorridas,
      juninEncontrados,
      registrosProcesados,
      registrosNuevos,
      registrosActualizados,
      erroresCount: errores.length,
    });
  } catch (err) {
    await db
      .insert(syncLogTable)
      .values({
        id: syncId,
        registrosProcesados,
        registrosNuevos,
        registrosActualizados,
        errores: [String(err)],
        estado: "ERROR",
      })
      .catch(() => {});

    req.log.error({ err }, "Sync error");
    res.status(500).json({
      error: "Error en sincronización",
      estado: "ERROR",
      message: String(err),
      paginasRecorridas,
      registrosProcesados,
      registrosNuevos,
      registrosActualizados,
    });
  }
});

// ────────────────────────────────────────────────────────────────────
// ENDPOINT DE ESTADO (útil para debug)
// ────────────────────────────────────────────────────────────────────

router.get("/sync/status", async (_req, res): Promise<void> => {
  const lastSync = await db
    .select()
    .from(syncLogTable)
    .orderBy(syncLogTable.fechaEjecucion)
    .limit(1);

  res.json({
    ultimaEjecucion: lastSync[0] ?? null,
  });
});

export default router;
