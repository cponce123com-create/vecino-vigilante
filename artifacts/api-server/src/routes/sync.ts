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

const JUNIN_PREFIX = "12";
const MAX_PAGES = 50;
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 300;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "VecinoVigilante/1.0 (Chanchamayo civic portal)",
        },
        signal: AbortSignal.timeout(30000),
      });
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`HTTP ${response.status}`);
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
  throw lastError;
}

function extractUbigeo(release: Record<string, unknown>): string | null {
  // Intento 1: buyer.additionalIdentifiers scheme PE-UBIGEO
  const buyer = release.buyer as Record<string, unknown> | undefined;
  if (buyer) {
    const ids = (buyer.additionalIdentifiers as Record<string, unknown>[] | undefined) ?? [];
    const found = ids.find((i) => (i as Record<string, unknown>).scheme === "PE-UBIGEO") as Record<string, unknown> | undefined;
    if (found?.id) return found.id as string;

    // Intento 2: buyer.address.postalCode
    const address = buyer.address as Record<string, unknown> | undefined;
    if (address?.postalCode) return address.postalCode as string;
  }

  // Intento 3: tender.procuringEntity.additionalIdentifiers
  const tender = release.tender as Record<string, unknown> | undefined;
  if (tender) {
    const pe = tender.procuringEntity as Record<string, unknown> | undefined;
    if (pe) {
      const ids = (pe.additionalIdentifiers as Record<string, unknown>[] | undefined) ?? [];
      const found = ids.find((i) => (i as Record<string, unknown>).scheme === "PE-UBIGEO") as Record<string, unknown> | undefined;
      if (found?.id) return found.id as string;
    }
  }

  return null;
}

function mapTipo(category: string): string {
  const map: Record<string, string> = { goods: "BIENES", services: "SERVICIOS", works: "OBRAS", consultingServices: "CONSULTORIA" };
  return map[category] ?? "SERVICIOS";
}

function mapProcedimiento(method: string): string {
  const m = method.toUpperCase();
  if (m.includes("LICITACION") || m.includes(" LP")) return "LP";
  if (m.includes("ADJUDICACION SIMPLIFICADA") || m.includes(" AS")) return "AS";
  if (m.includes("SUBASTA")) return "SM";
  if (m.includes("CONCURSO")) return "CP";
  if (m.includes("DIRECTA") || m.includes(" CD")) return "CD";
  if (m.includes("COMPARACION")) return "CE";
  return method.slice(0, 10) || "AS";
}

function mapEstado(status: string): string {
  const map: Record<string, string> = {
    planning: "PLANIFICADO", planned: "PLANIFICADO", active: "CONVOCADO",
    tender: "CONVOCADO", complete: "ADJUDICADO", awarded: "ADJUDICADO",
    contract: "CONTRATADO", cancelled: "CANCELADO", unsuccessful: "DESIERTO", withdrawn: "ANULADO",
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
  const supplier = ((award.suppliers as Record<string, unknown>[]) ?? [])[0] ?? {};
  const buyerIdentifier = (buyer.identifier as Record<string, unknown>) ?? {};
  const supplierIdentifier = (supplier.identifier as Record<string, unknown>) ?? {};
  const tenderValue = (tender.value as Record<string, unknown>) ?? {};
  const awardValue = (award.value as Record<string, unknown>) ?? {};
  const tenderPeriod = tender.tenderPeriod as Record<string, unknown> | undefined;

  return {
    ocid: release.ocid as string,
    nomenclatura: (tender.id as string) ?? null,
    titulo: (tender.title as string) ?? (release.ocid as string),
    descripcion: (tender.description as string) ?? null,
    tipo: mapTipo((tender.mainProcurementCategory as string) ?? ""),
    procedimiento: mapProcedimiento((tender.procurementMethodDetails as string) ?? ""),
    estado: mapEstado((tender.status as string) ?? ""),
    entidadRuc: (buyerIdentifier.id as string) ?? null,
    entidadNombre: (buyer.name as string) ?? null,
    proveedorRuc: (supplierIdentifier.id as string) ?? null,
    proveedorNombre: (supplier.name as string) ?? null,
    ubigeoCodigo: extractUbigeo(release),
    montoReferencial: tenderValue.amount ? String(tenderValue.amount) : null,
    montoAdjudicado: awardValue.amount ? String(awardValue.amount) : null,
    moneda: (tenderValue.currency as string) ?? "PEN",
    fechaConvocatoria: tenderPeriod ? safeDate(tenderPeriod.startDate) : null,
    fechaAdjudicacion: safeDate(award.date),
    fechaContrato: safeDate(contract.dateSigned),
    plazoEjecucionDias: null,
    rawOcds: release,
  };
}

async function runSync(log: (msg: string) => void) {
  const syncId = randomUUID();
  const startedAt = Date.now();
  let registrosProcesados = 0, registrosNuevos = 0, registrosActualizados = 0;
  let juninEncontrados = 0, paginasRecorridas = 0;
  const errores: unknown[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${OCDS_BASE}/releases/?page=${page}&size=${PAGE_SIZE}`;
    log(`Fetching page ${page}: ${url}`);

    const response = await fetchWithRetry(url);
    paginasRecorridas++;

    if (!response.ok) throw new Error(`OCDS API error página ${page}: ${response.status}`);

    const data = (await response.json()) as {
      results?: Record<string, unknown>[];
      data?: Record<string, unknown>[];
      releases?: Record<string, unknown>[];
      pagination?: { total_pages?: number };
    };

    const releases = data.results ?? data.data ?? data.releases ?? [];
    if (releases.length === 0) { log(`Page ${page} empty, stopping`); break; }

    const juninReleases = releases.filter((r) => extractUbigeo(r)?.startsWith(JUNIN_PREFIX));
    juninEncontrados += juninReleases.length;
    log(`Page ${page}: ${releases.length} total, ${juninReleases.length} Junín`);

    for (const release of juninReleases) {
      try {
        registrosProcesados++;
        const mapped = mapOcdsToContratacion(release);
        if (!mapped.ocid || !mapped.titulo) { errores.push({ motivo: "Falta OCID o título", ocid: mapped.ocid }); continue; }

        if (mapped.entidadRuc) {
          await db.insert(entidadesTable).values({
            ruc: mapped.entidadRuc,
            nombre: mapped.entidadNombre ?? mapped.entidadRuc,
            tipo: "MUNICIPALIDAD",
            nivelGobierno: "LOCAL",
            ubigeoCodigo: mapped.ubigeoCodigo,
          }).onConflictDoNothing();
        }

        if (mapped.proveedorRuc) {
          await db.insert(proveedoresTable).values({
            ruc: mapped.proveedorRuc,
            razonSocial: mapped.proveedorNombre ?? mapped.proveedorRuc,
          }).onConflictDoNothing();
        }

        const { entidadNombre: _en, proveedorNombre: _pn, ...contratacionData } = mapped;
        const existing = await db.select({ ocid: contratacionesTable.ocid }).from(contratacionesTable).where(eq(contratacionesTable.ocid, mapped.ocid)).limit(1);

        if (existing.length === 0) {
          await db.insert(contratacionesTable).values({ ...contratacionData, rawOcds: contratacionData.rawOcds as Record<string, unknown> });
          registrosNuevos++;
        } else {
          await db.update(contratacionesTable).set({
            estado: contratacionData.estado,
            montoAdjudicado: contratacionData.montoAdjudicado,
            fechaAdjudicacion: contratacionData.fechaAdjudicacion,
            fechaContrato: contratacionData.fechaContrato,
            proveedorRuc: contratacionData.proveedorRuc,
            rawOcds: contratacionData.rawOcds as Record<string, unknown>,
          }).where(eq(contratacionesTable.ocid, mapped.ocid));
          registrosActualizados++;
        }
      } catch (err) {
        errores.push({ ocid: (release as Record<string, unknown>).ocid, error: String(err) });
      }
    }

    const totalPages = data.pagination?.total_pages;
    if (totalPages && page >= totalPages) { log(`Last page ${page}/${totalPages}`); break; }

    await sleep(REQUEST_DELAY_MS);
  }

  const duracionMs = Date.now() - startedAt;
  const estado = errores.length === 0 ? "OK" : errores.length < registrosProcesados / 2 ? "PARCIAL" : "ERROR";

  await db.insert(syncLogTable).values({
    id: syncId,
    registrosProcesados,
    registrosNuevos,
    registrosActualizados,
    errores: errores.length > 0 ? errores.slice(0, 50) : null,
    estado,
  });

  return { estado, duracionSegundos: Math.round(duracionMs / 1000), paginasRecorridas, juninEncontrados, registrosProcesados, registrosNuevos, registrosActualizados, erroresCount: errores.length };
}

// POST /api/sync — con header x-sync-secret
router.post("/sync", async (req, res): Promise<void> => {
  const secret = process.env.SYNC_SECRET;
  if (secret && req.headers["x-sync-secret"] !== secret) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  try {
    const result = await runSync((msg) => req.log.info(msg));
    res.json({ message: "Sincronización completada", ...result });
  } catch (err) {
    req.log.error({ err }, "Sync error");
    res.status(500).json({ error: "Error en sincronización", message: String(err) });
  }
});

// GET /api/sync?secret=... — disparable desde el browser
router.get("/sync", async (req, res): Promise<void> => {
  const secret = process.env.SYNC_SECRET;
  if (secret && req.query["secret"] !== secret) {
    res.status(401).json({ error: "No autorizado. Usa: /api/sync?secret=TU_SYNC_SECRET" });
    return;
  }
  try {
    const result = await runSync((msg) => console.log(msg));
    res.json({ message: "Sincronización completada", ...result });
  } catch (err) {
    res.status(500).json({ error: "Error en sincronización", message: String(err) });
  }
});

// GET /api/sync/status
router.get("/sync/status", async (_req, res): Promise<void> => {
  const lastSync = await db.select().from(syncLogTable).orderBy(syncLogTable.fechaEjecucion).limit(1);
  res.json({ ultimaEjecucion: lastSync[0] ?? null });
});

export default router;
