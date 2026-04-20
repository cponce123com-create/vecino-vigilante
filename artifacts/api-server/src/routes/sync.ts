import { Router, type IRouter } from "express";
import {
  db,
  contratacionesTable,
  entidadesTable,
  proveedoresTable,
  syncLogTable,
  ubigeosTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

// ─── Fuentes de datos configurables ───────────────────────────────────────────
// 1. API OCDS (contratacionesabiertas.osce.gob.pe) — puede estar bloqueada fuera de Perú
// 2. Descarga masiva JSON del SEACE (datosabiertos.seace.gob.pe)
const OCDS_BASE =
  process.env.OCDS_API_BASE ??
  "https://contratacionesabiertas.osce.gob.pe/api";

// Endpoint de descarga masiva JSON OCDS del OSCE/SEACE
// Estos archivos se generan diariamente y contienen todas las contrataciones
const SEACE_FILES_BASE =
  process.env.SEACE_FILES_BASE ??
  "https://contratacionesabiertas.osce.gob.pe/api/files";

const JUNIN_UBIGEO_PREFIX = "12";
const MAX_PAGES = 100;
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 200;
const FETCH_TIMEOUT_MS = 30_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "VecinoVigilante/1.0 (Chanchamayo civic portal; contacto@vecinov.pe)",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`HTTP ${response.status}`);
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) await sleep(1000 * Math.pow(2, attempt));
    }
  }
  throw lastError;
}

// ─── Chequeo de disponibilidad del API OCDS ───────────────────────────────────
async function checkOcdsAvailability(): Promise<boolean> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${OCDS_BASE}/releases/?page=1&size=1`, {
      headers: { Accept: "application/json", "User-Agent": "VecinoVigilante/1.0" },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Extracción de ubigeo ──────────────────────────────────────────────────────
function extractUbigeo(release: Record<string, unknown>): string | null {
  const buyer = release.buyer as Record<string, unknown> | undefined;
  if (buyer) {
    const ids = (buyer.additionalIdentifiers as Record<string, unknown>[] | undefined) ?? [];
    const found = ids.find(
      (i) => (i as Record<string, unknown>).scheme === "PE-UBIGEO",
    ) as Record<string, unknown> | undefined;
    if (found?.id) return String(found.id);

    const address = buyer.address as Record<string, unknown> | undefined;
    if (address?.postalCode) return String(address.postalCode);
  }

  const tender = release.tender as Record<string, unknown> | undefined;
  if (tender) {
    const pe = tender.procuringEntity as Record<string, unknown> | undefined;
    if (pe) {
      const ids = (pe.additionalIdentifiers as Record<string, unknown>[] | undefined) ?? [];
      const found = ids.find(
        (i) => (i as Record<string, unknown>).scheme === "PE-UBIGEO",
      ) as Record<string, unknown> | undefined;
      if (found?.id) return String(found.id);
    }
  }

  return null;
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
  const m = (method ?? "").toUpperCase();
  if (m.includes("LICITACION") || m.includes(" LP") || m === "LP") return "LP";
  if (m.includes("ADJUDICACION SIMPLIFICADA") || m.includes(" AS") || m === "AS") return "AS";
  if (m.includes("SUBASTA") || m === "SM") return "SM";
  if (m.includes("CONCURSO") || m === "CP") return "CP";
  if (m.includes("DIRECTA") || m.includes(" CD") || m === "CD") return "CD";
  if (m.includes("COMPARACION") || m === "CE") return "CE";
  return (method ?? "").slice(0, 10) || "AS";
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
  return map[(status ?? "").toLowerCase()] ?? "CONVOCADO";
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

// ─── Guardar un release en la base de datos ────────────────────────────────────
async function upsertContratacion(
  mapped: ReturnType<typeof mapOcdsToContratacion>,
): Promise<"nuevo" | "actualizado"> {
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

  if (mapped.proveedorRuc) {
    await db
      .insert(proveedoresTable)
      .values({
        ruc: mapped.proveedorRuc,
        razonSocial: mapped.proveedorNombre ?? mapped.proveedorRuc,
      })
      .onConflictDoNothing();
  }

  // Verificar si el ubigeo existe antes de insertar (para evitar FK error)
  let ubigeoCodigo = mapped.ubigeoCodigo;
  if (ubigeoCodigo) {
    const ubigeoExists = await db
      .select({ codigo: ubigeosTable.codigo })
      .from(ubigeosTable)
      .where(eq(ubigeosTable.codigo, ubigeoCodigo))
      .limit(1);
    if (ubigeoExists.length === 0) {
      ubigeoCodigo = null; // No insertar FK inválida
    }
  }

  const { entidadNombre: _en, proveedorNombre: _pn, ...contratacionData } =
    mapped;
  const dataToInsert = { ...contratacionData, ubigeoCodigo };

  const existing = await db
    .select({ ocid: contratacionesTable.ocid })
    .from(contratacionesTable)
    .where(eq(contratacionesTable.ocid, mapped.ocid))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(contratacionesTable).values({
      ...dataToInsert,
      rawOcds: dataToInsert.rawOcds as Record<string, unknown>,
    });
    return "nuevo";
  } else {
    await db
      .update(contratacionesTable)
      .set({
        estado: dataToInsert.estado,
        montoAdjudicado: dataToInsert.montoAdjudicado,
        fechaAdjudicacion: dataToInsert.fechaAdjudicacion,
        fechaContrato: dataToInsert.fechaContrato,
        proveedorRuc: dataToInsert.proveedorRuc,
        rawOcds: dataToInsert.rawOcds as Record<string, unknown>,
        ubigeoCodigo: ubigeoCodigo,
      })
      .where(eq(contratacionesTable.ocid, mapped.ocid));
    return "actualizado";
  }
}

// ─── Estrategia 1: API OCDS paginada ──────────────────────────────────────────
async function syncViaOcdsApi(log: (msg: string) => void): Promise<{
  procesados: number;
  nuevos: number;
  actualizados: number;
  encontrados: number;
  paginas: number;
  errores: unknown[];
}> {
  let procesados = 0, nuevos = 0, actualizados = 0, encontrados = 0, paginas = 0;
  const errores: unknown[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${OCDS_BASE}/releases/?page=${page}&size=${PAGE_SIZE}`;
    log(`[OCDS-API] Página ${page}: ${url}`);

    let data: {
      results?: Record<string, unknown>[];
      data?: Record<string, unknown>[];
      releases?: Record<string, unknown>[];
      pagination?: { total_pages?: number; count?: number };
      count?: number;
    };

    try {
      const response = await fetchWithRetry(url);
      paginas++;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (err) {
      log(`[OCDS-API] Error en página ${page}: ${String(err)}`);
      errores.push({ pagina: page, error: String(err) });
      break;
    }

    const releases = data.results ?? data.data ?? data.releases ?? [];
    if (releases.length === 0) {
      log(`[OCDS-API] Página ${page} vacía, deteniendo.`);
      break;
    }

    // Filtrar por Junín (ubigeo 12XXXX)
    const juninReleases = releases.filter((r) => {
      const ubigeo = extractUbigeo(r);
      return ubigeo?.startsWith(JUNIN_UBIGEO_PREFIX);
    });
    encontrados += juninReleases.length;
    log(`[OCDS-API] Página ${page}: ${releases.length} total, ${juninReleases.length} de Junín`);

    for (const release of juninReleases) {
      try {
        procesados++;
        const mapped = mapOcdsToContratacion(release);
        if (!mapped.ocid || !mapped.titulo) {
          errores.push({ motivo: "OCID o título faltante", ocid: mapped.ocid });
          continue;
        }
        const result = await upsertContratacion(mapped);
        if (result === "nuevo") nuevos++;
        else actualizados++;
      } catch (err) {
        errores.push({ ocid: (release as Record<string, unknown>).ocid, error: String(err) });
      }
    }

    // Verificar paginación
    const totalPages = data.pagination?.total_pages;
    if (totalPages && page >= totalPages) {
      log(`[OCDS-API] Última página ${page}/${totalPages}`);
      break;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return { procesados, nuevos, actualizados, encontrados, paginas, errores };
}

// ─── Estrategia 2: Descarga de archivos OCDS masivos ──────────────────────────
// El OSCE publica archivos JSON descargables con todos los datos
async function syncViaFileDownload(log: (msg: string) => void): Promise<{
  procesados: number;
  nuevos: number;
  actualizados: number;
  encontrados: number;
  errores: unknown[];
}> {
  let procesados = 0, nuevos = 0, actualizados = 0, encontrados = 0;
  const errores: unknown[] = [];

  // Intentar obtener el listado de archivos disponibles
  const filesUrl = `${SEACE_FILES_BASE}/`;
  log(`[FILES] Obteniendo listado de archivos: ${filesUrl}`);

  let filesData: { results?: Array<{ url: string; name?: string; date?: string }> } = { results: [] };
  try {
    const response = await fetchWithRetry(filesUrl, 2, 15_000);
    if (response.ok) {
      filesData = await response.json();
    }
  } catch (err) {
    log(`[FILES] No se pudo obtener listado: ${String(err)}`);
    return { procesados, nuevos, actualizados, encontrados, errores };
  }

  const files = filesData.results ?? [];
  if (files.length === 0) {
    log("[FILES] No hay archivos disponibles");
    return { procesados, nuevos, actualizados, encontrados, errores };
  }

  // Procesar los últimos 3 archivos (más recientes)
  const recentFiles = files.slice(-3);
  log(`[FILES] Procesando ${recentFiles.length} archivos recientes`);

  for (const fileInfo of recentFiles) {
    const fileUrl = fileInfo.url;
    log(`[FILES] Descargando: ${fileUrl}`);

    try {
      const response = await fetchWithRetry(fileUrl, 2, 120_000);
      if (!response.ok) {
        errores.push({ archivo: fileUrl, error: `HTTP ${response.status}` });
        continue;
      }

      const pkg = await response.json() as {
        releases?: Record<string, unknown>[];
        records?: Array<{ releases?: Record<string, unknown>[] }>;
      };

      const releases: Record<string, unknown>[] = [];
      if (pkg.releases) releases.push(...pkg.releases);
      if (pkg.records) {
        for (const record of pkg.records) {
          if (record.releases) releases.push(...record.releases);
        }
      }

      log(`[FILES] Archivo con ${releases.length} releases`);

      const juninReleases = releases.filter((r) =>
        extractUbigeo(r)?.startsWith(JUNIN_UBIGEO_PREFIX),
      );
      encontrados += juninReleases.length;
      log(`[FILES] Junín: ${juninReleases.length}`);

      for (const release of juninReleases) {
        try {
          procesados++;
          const mapped = mapOcdsToContratacion(release);
          if (!mapped.ocid || !mapped.titulo) continue;
          const result = await upsertContratacion(mapped);
          if (result === "nuevo") nuevos++;
          else actualizados++;
        } catch (err) {
          errores.push({ ocid: (release as Record<string, unknown>).ocid, error: String(err) });
        }
      }
    } catch (err) {
      errores.push({ archivo: fileUrl, error: String(err) });
    }
  }

  return { procesados, nuevos, actualizados, encontrados, errores };
}

// ─── Orquestador principal de sincronización ──────────────────────────────────
async function runSync(log: (msg: string) => void) {
  const syncId = randomUUID();
  const startedAt = Date.now();
  const errores: unknown[] = [];
  let registrosProcesados = 0, registrosNuevos = 0, registrosActualizados = 0;
  let juninEncontrados = 0, paginasRecorridas = 0;
  let estrategia = "ninguna";

  log("=== Iniciando sincronización Vecino Vigilante ===");

  // ── Estrategia 1: API OCDS paginada ──
  log("Verificando disponibilidad de API OCDS...");
  const ocdsDisponible = await checkOcdsAvailability();

  if (ocdsDisponible) {
    log("✓ API OCDS disponible. Usando paginación directa.");
    estrategia = "ocds-api";
    const result = await syncViaOcdsApi(log);
    registrosProcesados = result.procesados;
    registrosNuevos = result.nuevos;
    registrosActualizados = result.actualizados;
    juninEncontrados = result.encontrados;
    paginasRecorridas = result.paginas;
    errores.push(...result.errores);
  } else {
    log("✗ API OCDS no disponible desde este servidor.");
    log("  Intentando descarga de archivos masivos...");
    estrategia = "files";
    const result = await syncViaFileDownload(log);
    registrosProcesados = result.procesados;
    registrosNuevos = result.nuevos;
    registrosActualizados = result.actualizados;
    juninEncontrados = result.encontrados;
    errores.push(...result.errores);

    if (registrosProcesados === 0) {
      log("✗ Ambas estrategias fallaron.");
      log("  AVISO: La API de contrataciones del OSCE puede estar:");
      log("  1. Bloqueada para servidores fuera de Perú");
      log("  2. Temporalmente caída");
      log("  Solución: Despliega el servidor en un proveedor peruano (p.ej. AWS Lima)");
      log("  o usa la sincronización manual vía POST /api/sync/manual con datos JSON");
    }
  }

  const duracionMs = Date.now() - startedAt;
  const estado =
    errores.length === 0
      ? "OK"
      : errores.length < Math.max(registrosProcesados / 2, 1)
        ? "PARCIAL"
        : registrosProcesados > 0
          ? "PARCIAL"
          : "ERROR";

  await db.insert(syncLogTable).values({
    id: syncId,
    registrosProcesados,
    registrosNuevos,
    registrosActualizados,
    errores: errores.length > 0 ? errores.slice(0, 50) : null,
    estado,
  });

  log(`=== Sincronización finalizada: ${estado} ===`);
  log(`Estrategia: ${estrategia} | Procesados: ${registrosProcesados} | Nuevos: ${registrosNuevos}`);

  return {
    estado,
    estrategia,
    duracionSegundos: Math.round(duracionMs / 1000),
    paginasRecorridas,
    juninEncontrados,
    registrosProcesados,
    registrosNuevos,
    registrosActualizados,
    erroresCount: errores.length,
    mensaje:
      registrosProcesados === 0
        ? "La API del OSCE no está disponible desde este servidor. Despliega en un servidor con IP peruana o usa /api/sync/upload para cargar datos manualmente."
        : undefined,
  };
}

// ─── Rutas ─────────────────────────────────────────────────────────────────────

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
    res.status(401).json({
      error: "No autorizado. Usa: /api/sync?secret=TU_SYNC_SECRET",
    });
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
  const lastSync = await db
    .select()
    .from(syncLogTable)
    .orderBy(syncLogTable.fechaEjecucion)
    .limit(1);
  res.json({ ultimaEjecucion: lastSync[0] ?? null });
});

// ─── Endpoint de carga manual de datos OCDS ───────────────────────────────────
// Permite subir un JSON con releases OCDS directamente (por si la API está bloqueada)
// POST /api/sync/upload  { releases: [...] }
router.post("/sync/upload", async (req, res): Promise<void> => {
  const secret = process.env.SYNC_SECRET;
  if (secret && req.headers["x-sync-secret"] !== secret) {
    res.status(401).json({ error: "No autorizado. Incluye el header x-sync-secret" });
    return;
  }

  const body = req.body as {
    releases?: Record<string, unknown>[];
    records?: Array<{ releases?: Record<string, unknown>[] }>;
    filtrarJunin?: boolean;
  };

  const releases: Record<string, unknown>[] = [];
  if (Array.isArray(body?.releases)) releases.push(...body.releases);
  if (Array.isArray(body?.records)) {
    for (const rec of body.records) {
      if (Array.isArray(rec.releases)) releases.push(...rec.releases);
    }
  }

  if (releases.length === 0) {
    res.status(400).json({ error: "Debes enviar { releases: [...] } o { records: [...] }" });
    return;
  }

  const filtrarJunin = body.filtrarJunin !== false; // por defecto sí filtra
  const toProcess = filtrarJunin
    ? releases.filter((r) => extractUbigeo(r)?.startsWith(JUNIN_UBIGEO_PREFIX))
    : releases;

  let nuevos = 0, actualizados = 0;
  const errores: unknown[] = [];

  for (const release of toProcess) {
    try {
      const mapped = mapOcdsToContratacion(release);
      if (!mapped.ocid || !mapped.titulo) continue;
      const result = await upsertContratacion(mapped);
      if (result === "nuevo") nuevos++;
      else actualizados++;
    } catch (err) {
      errores.push({ ocid: (release as Record<string, unknown>).ocid, error: String(err) });
    }
  }

  res.json({
    message: "Carga completada",
    totalRecibidos: releases.length,
    filtradosJunin: toProcess.length,
    nuevos,
    actualizados,
    errores: errores.slice(0, 20),
  });
});

// ─── Endpoint de seed con datos de ejemplo ────────────────────────────────────
// GET /api/sync/seed-demo — carga datos de muestra para ver la web funcionando
router.post("/sync/seed-demo", async (req, res): Promise<void> => {
  const secret = process.env.SYNC_SECRET;
  if (secret && req.headers["x-sync-secret"] !== secret) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  const DEMO_ENTIDADES = [
    { ruc: "20155234461", nombre: "MUNICIPALIDAD PROVINCIAL DE CHANCHAMAYO", ubigeo: "120301" },
    { ruc: "20155252861", nombre: "MUNICIPALIDAD DISTRITAL DE SAN RAMON", ubigeo: "120305" },
    { ruc: "20156104048", nombre: "MUNICIPALIDAD DISTRITAL DE PICHANAQUI", ubigeo: "120303" },
    { ruc: "20155254466", nombre: "MUNICIPALIDAD DISTRITAL DE PERENE", ubigeo: "120302" },
    { ruc: "20155246761", nombre: "MUNICIPALIDAD DISTRITAL DE SAN LUIS DE SHUARO", ubigeo: "120304" },
    { ruc: "20155270061", nombre: "MUNICIPALIDAD DISTRITAL DE VITOC", ubigeo: "120306" },
  ];

  const DEMO_PROVEEDORES = [
    { ruc: "20601234567", razonSocial: "CONSTRUCTORA SELVA CENTRAL SAC" },
    { ruc: "20602345678", razonSocial: "INVERSIONES Y SERVICIOS JUNIN EIRL" },
    { ruc: "20603456789", razonSocial: "CONSORCIO CHANCHAMAYO SRL" },
    { ruc: "20604567890", razonSocial: "SERVICIOS GENERALES PICHANAQUI SAC" },
    { ruc: "20605678901", razonSocial: "INGENIERIA Y CONSTRUCCION PERENE EIRL" },
    { ruc: "20606789012", razonSocial: "GRUPO CONSTRUCTOR SAN RAMON SA" },
    { ruc: "20607890123", razonSocial: "MULTISERVICIOS VITOC EIRL" },
    { ruc: "20608901234", razonSocial: "TECNOSERVICIOS DEL CENTRO SAC" },
  ];

  const now = new Date();
  const DEMO_CONTRATACIONES = [
    {
      ocid: "ocds-abcd-demo-001",
      nomenclatura: "AS-SM-1-2026-MPCh-1",
      titulo: "MEJORAMIENTO DE PISTAS Y VEREDAS EN AVENIDA TARMA - CHANCHAMAYO",
      descripcion: "Construcción de pistas y veredas en la Av. Tarma, tramo Jr. Lima - Jr. Junín",
      tipo: "OBRAS", procedimiento: "AS", estado: "ADJUDICADO",
      entidadRuc: "20155234461", proveedorRuc: "20601234567",
      ubigeoCodigo: "120301", montoReferencial: "850000.00", montoAdjudicado: "810000.00",
      moneda: "PEN", fechaConvocatoria: new Date("2026-01-15"),
      fechaAdjudicacion: new Date("2026-02-10"), fechaContrato: new Date("2026-02-20"),
      plazoEjecucionDias: 180,
    },
    {
      ocid: "ocds-abcd-demo-002",
      nomenclatura: "LP-SM-1-2026-MDSR-1",
      titulo: "CONSTRUCCION DE PUENTE VEHICULAR RIO SAN RAMON",
      descripcion: "Construcción de puente vehicular de 40 metros de longitud sobre el río San Ramón",
      tipo: "OBRAS", procedimiento: "LP", estado: "CONTRATADO",
      entidadRuc: "20155252861", proveedorRuc: "20606789012",
      ubigeoCodigo: "120305", montoReferencial: "3200000.00", montoAdjudicado: "3150000.00",
      moneda: "PEN", fechaConvocatoria: new Date("2025-10-01"),
      fechaAdjudicacion: new Date("2025-11-15"), fechaContrato: new Date("2025-12-01"),
      plazoEjecucionDias: 365,
    },
    {
      ocid: "ocds-abcd-demo-003",
      nomenclatura: "AS-SM-2-2026-MDP-1",
      titulo: "SUMINISTRO DE MATERIALES EDUCATIVOS PARA INSTITUCIONES EDUCATIVAS - PICHANAQUI",
      descripcion: "Compra de útiles escolares, libros y materiales didácticos para 25 colegios",
      tipo: "BIENES", procedimiento: "AS", estado: "ADJUDICADO",
      entidadRuc: "20156104048", proveedorRuc: "20604567890",
      ubigeoCodigo: "120303", montoReferencial: "420000.00", montoAdjudicado: "398000.00",
      moneda: "PEN", fechaConvocatoria: new Date("2026-01-20"),
      fechaAdjudicacion: new Date("2026-02-05"), fechaContrato: null,
      plazoEjecucionDias: 45,
    },
    {
      ocid: "ocds-abcd-demo-004",
      nomenclatura: "CP-SM-1-2025-MDP-1",
      titulo: "CONSULTORIA PARA EXPEDIENTE TECNICO DE SANEAMIENTO PERENE",
      descripcion: "Elaboración del expediente técnico para el sistema de agua potable y alcantarillado",
      tipo: "CONSULTORIA", procedimiento: "CP", estado: "ADJUDICADO",
      entidadRuc: "20155254466", proveedorRuc: "20605678901",
      ubigeoCodigo: "120302", montoReferencial: "180000.00", montoAdjudicado: "175000.00",
      moneda: "PEN", fechaConvocatoria: new Date("2025-08-10"),
      fechaAdjudicacion: new Date("2025-09-05"), fechaContrato: new Date("2025-09-15"),
      plazoEjecucionDias: 90,
    },
    {
      ocid: "ocds-abcd-demo-005",
      nomenclatura: "SM-SM-1-2026-MPCh-2",
      titulo: "ADQUISICION DE COMBUSTIBLE PARA MAQUINARIA MUNICIPAL - CHANCHAMAYO",
      descripcion: "Adquisición de diésel B5 y gasolina 90 octanos para la flota municipal",
      tipo: "BIENES", procedimiento: "SM", estado: "CONVOCADO",
      entidadRuc: "20155234461", proveedorRuc: null,
      ubigeoCodigo: "120301", montoReferencial: "95000.00", montoAdjudicado: null,
      moneda: "PEN", fechaConvocatoria: new Date("2026-03-01"),
      fechaAdjudicacion: null, fechaContrato: null,
      plazoEjecucionDias: 30,
    },
    {
      ocid: "ocds-abcd-demo-006",
      nomenclatura: "CD-SM-1-2026-MDSLS-1",
      titulo: "SERVICIO DE LIMPIEZA Y MANTENIMIENTO DE LOCALES MUNICIPALES - SAN LUIS DE SHUARO",
      descripcion: "Contratación de servicio de limpieza para las instalaciones de la municipalidad",
      tipo: "SERVICIOS", procedimiento: "CD", estado: "CONTRATADO",
      entidadRuc: "20155246761", proveedorRuc: "20607890123",
      ubigeoCodigo: "120304", montoReferencial: "28000.00", montoAdjudicado: "28000.00",
      moneda: "PEN", fechaConvocatoria: new Date("2026-02-01"),
      fechaAdjudicacion: new Date("2026-02-01"), fechaContrato: new Date("2026-02-05"),
      plazoEjecucionDias: 365,
    },
    {
      ocid: "ocds-abcd-demo-007",
      nomenclatura: "AS-SM-1-2025-MDV-1",
      titulo: "REHABILITACION DE CAMINO VECINAL SECTOR NINABAMBA - VITOC",
      descripcion: "Rehabilitación y mejoramiento de 8.5 km de camino vecinal",
      tipo: "OBRAS", procedimiento: "AS", estado: "ADJUDICADO",
      entidadRuc: "20155270061", proveedorRuc: "20603456789",
      ubigeoCodigo: "120306", montoReferencial: "650000.00", montoAdjudicado: "628000.00",
      moneda: "PEN", fechaConvocatoria: new Date("2025-11-15"),
      fechaAdjudicacion: new Date("2025-12-10"), fechaContrato: new Date("2025-12-20"),
      plazoEjecucionDias: 120,
    },
    {
      ocid: "ocds-abcd-demo-008",
      nomenclatura: "AS-SM-3-2026-MPCh-3",
      titulo: "ADQUISICION DE EQUIPOS INFORMATICOS PARA MODERNIZACION ADMINISTRATIVA",
      descripcion: "Compra de computadoras, laptops e impresoras para oficinas municipales",
      tipo: "BIENES", procedimiento: "AS", estado: "ADJUDICADO",
      entidadRuc: "20155234461", proveedorRuc: "20608901234",
      ubigeoCodigo: "120301", montoReferencial: "145000.00", montoAdjudicado: "138500.00",
      moneda: "PEN", fechaConvocatoria: new Date("2026-01-25"),
      fechaAdjudicacion: new Date("2026-02-15"), fechaContrato: new Date("2026-02-22"),
      plazoEjecucionDias: 15,
    },
    {
      ocid: "ocds-abcd-demo-009",
      nomenclatura: "LP-SM-2-2025-MDSR-2",
      titulo: "MEJORAMIENTO DEL SISTEMA DE AGUA POTABLE ZONA URBANA SAN RAMON",
      descripcion: "Mejoramiento de la red de distribución de agua potable en el sector urbano",
      tipo: "OBRAS", procedimiento: "LP", estado: "CONTRATADO",
      entidadRuc: "20155252861", proveedorRuc: "20602345678",
      ubigeoCodigo: "120305", montoReferencial: "2850000.00", montoAdjudicado: "2790000.00",
      moneda: "PEN", fechaConvocatoria: new Date("2025-06-01"),
      fechaAdjudicacion: new Date("2025-07-20"), fechaContrato: new Date("2025-08-01"),
      plazoEjecucionDias: 270,
    },
    {
      ocid: "ocds-abcd-demo-010",
      nomenclatura: "CE-SM-1-2026-MDP-2",
      titulo: "SERVICIO DE SERENAZGO Y SEGURIDAD CIUDADANA PICHANAQUI",
      descripcion: "Contratación de servicio de vigilancia y seguridad para el distrito",
      tipo: "SERVICIOS", procedimiento: "CE", estado: "CONVOCADO",
      entidadRuc: "20156104048", proveedorRuc: null,
      ubigeoCodigo: "120303", montoReferencial: "72000.00", montoAdjudicado: null,
      moneda: "PEN", fechaConvocatoria: new Date("2026-03-10"),
      fechaAdjudicacion: null, fechaContrato: null,
      plazoEjecucionDias: 180,
    },
    {
      ocid: "ocds-abcd-demo-011",
      nomenclatura: "AS-SM-1-2026-MDPE-1",
      titulo: "CONSTRUCCION DE LOSA DEPORTIVA MULTIUSOS CENTRO POBLADO PAMPA YURINAKI",
      descripcion: "Construcción de losa deportiva de 44x22 metros con iluminación LED",
      tipo: "OBRAS", procedimiento: "AS", estado: "ADJUDICADO",
      entidadRuc: "20155254466", proveedorRuc: "20601234567",
      ubigeoCodigo: "120302", montoReferencial: "520000.00", montoAdjudicado: "495000.00",
      moneda: "PEN", fechaConvocatoria: new Date("2026-02-05"),
      fechaAdjudicacion: new Date("2026-03-01"), fechaContrato: null,
      plazoEjecucionDias: 90,
    },
    {
      ocid: "ocds-abcd-demo-012",
      nomenclatura: "CD-SM-2-2026-MPCh-4",
      titulo: "SERVICIO DE IMPRESION Y FOTOCOPIADO PARA MUNICIPALIDAD PROVINCIAL",
      descripcion: "Alquiler de fotocopiadoras y servicio de impresión documentaria",
      tipo: "SERVICIOS", procedimiento: "CD", estado: "ADJUDICADO",
      entidadRuc: "20155234461", proveedorRuc: "20607890123",
      ubigeoCodigo: "120301", montoReferencial: "18000.00", montoAdjudicado: "17500.00",
      moneda: "PEN", fechaConvocatoria: new Date("2026-01-10"),
      fechaAdjudicacion: new Date("2026-01-10"), fechaContrato: new Date("2026-01-15"),
      plazoEjecucionDias: 365,
    },
  ];

  let insertados = 0, omitidos = 0;
  const errores: unknown[] = [];

  // Insertar entidades demo
  for (const ent of DEMO_ENTIDADES) {
    try {
      await db.insert(entidadesTable).values({
        ruc: ent.ruc,
        nombre: ent.nombre,
        tipo: "MUNICIPALIDAD",
        nivelGobierno: "LOCAL",
        ubigeoCodigo: ent.ubigeo,
      }).onConflictDoNothing();
    } catch (err) {
      errores.push({ ruc: ent.ruc, error: String(err) });
    }
  }

  // Insertar proveedores demo
  for (const prov of DEMO_PROVEEDORES) {
    try {
      await db.insert(proveedoresTable).values(prov).onConflictDoNothing();
    } catch (err) {
      errores.push({ ruc: prov.ruc, error: String(err) });
    }
  }

  // Insertar contrataciones demo
  for (const c of DEMO_CONTRATACIONES) {
    try {
      const existing = await db
        .select({ ocid: contratacionesTable.ocid })
        .from(contratacionesTable)
        .where(eq(contratacionesTable.ocid, c.ocid))
        .limit(1);

      if (existing.length > 0) {
        omitidos++;
        continue;
      }

      await db.insert(contratacionesTable).values({
        ocid: c.ocid,
        nomenclatura: c.nomenclatura,
        titulo: c.titulo,
        descripcion: c.descripcion,
        tipo: c.tipo,
        procedimiento: c.procedimiento,
        estado: c.estado,
        entidadRuc: c.entidadRuc,
        proveedorRuc: c.proveedorRuc,
        ubigeoCodigo: c.ubigeoCodigo,
        montoReferencial: c.montoReferencial,
        montoAdjudicado: c.montoAdjudicado ?? null,
        moneda: c.moneda,
        fechaConvocatoria: c.fechaConvocatoria,
        fechaAdjudicacion: c.fechaAdjudicacion,
        fechaContrato: c.fechaContrato,
        plazoEjecucionDias: c.plazoEjecucionDias,
        rawOcds: { _demo: true, source: "seed-demo" },
      });
      insertados++;
    } catch (err) {
      errores.push({ ocid: c.ocid, error: String(err) });
    }
  }

  // Log de seed
  await db.insert(syncLogTable).values({
    id: randomUUID(),
    registrosProcesados: DEMO_CONTRATACIONES.length,
    registrosNuevos: insertados,
    registrosActualizados: 0,
    errores: errores.length > 0 ? errores : null,
    estado: errores.length === 0 ? "OK" : "PARCIAL",
  });

  res.json({
    message: "Datos de demostración cargados correctamente",
    entidades: DEMO_ENTIDADES.length,
    proveedores: DEMO_PROVEEDORES.length,
    contrataciones: { insertadas: insertados, omitidas: omitidos },
    errores,
  });
});

export default router;
