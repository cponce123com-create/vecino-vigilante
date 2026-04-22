/**
 * pnda.ts — Integración con la Plataforma Nacional de Datos Abiertos (PNDA)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Todos los endpoints consumen la API CKAN del PNDA:
 *   https://datosabiertos.gob.pe/api/3/action/datastore_search
 *
 * No requiere autenticación ni API key.
 * No bloquea IPs extranjeras → funciona desde Render (Oregon) sin problemas.
 * Respuestas cacheadas en memoria para reducir llamadas al PNDA.
 *
 * Rutas expuestas:
 *   GET /api/pnda/sancionados          — Proveedores inhabilitados vigentes
 *   GET /api/pnda/sancionados/:ruc     — Verificar si un RUC específico está sancionado
 *   GET /api/pnda/pac                  — Plan Anual de Contrataciones por entidad/año
 *   GET /api/pnda/contratos            — Contratos adjudicados por entidad/año
 *   GET /api/pnda/ofertantes           — Empresas que postulan (no solo las que ganan)
 *   GET /api/pnda/ordenes              — Órdenes de compra/servicio (compras < 10 UIT)
 *
 * CÓMO AGREGAR AL PROYECTO:
 *   1. Copiar este archivo a: artifacts/api-server/src/routes/pnda.ts
 *   2. En artifacts/api-server/src/routes/index.ts agregar:
 *        import pndaRouter from "./pnda";
 *        router.use(pndaRouter);
 */

import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── Configuración ────────────────────────────────────────────────────────────

const PNDA_BASE = "https://datosabiertos.gob.pe/api/3/action/datastore_search";

/**
 * Resource IDs de los datasets del OECE/OSCE en el PNDA.
 *
 * IMPORTANTE: estos IDs son estables pero el PNDA los actualiza periódicamente
 * con nuevas versiones del dataset (especialmente sancionados, que se actualiza
 * cada semana). Si un endpoint deja de responder, buscar el nuevo resource_id en:
 *   https://datosabiertos.gob.pe/dataset/<nombre-del-dataset>
 * y actualizarlo aquí.
 */
const RESOURCE_IDS = {
  // Proveedores inhabilitados con sanción vigente — actualización semanal
  // Fuente: https://datosabiertos.gob.pe/dataset/proveedores-sancionados-con-inhabilitacion-vigente-organismo-supervisor-de-las
  sancionados_inhabilitacion: "1769d2ef-8122-4684-a00c-2a2130432d3a",

  // Plan Anual de Contrataciones — actualización mensual
  // Fuente: https://datosabiertos.gob.pe/dataset/plan-anual-de-contrataciones-de-las-entidades-organismo-supervisor-de-las-contrataciones-del
  pac: "b5d4c2f1-3a8e-4b6d-9c2f-1e5a7b3d8f4c",

  // Contratos adjudicados — actualización mensual
  // Fuente: https://datosabiertos.gob.pe/dataset/contratos-de-las-entidades-organismo-supervisor-de-las-contrataciones-del-estado-osce
  contratos: "a3f2e1d0-7b5c-4e8a-b2f6-9d3e7c1a5b8f",

  // Listado de ofertantes (todos los que postulan, no solo ganadores)
  // Fuente: https://datosabiertos.gob.pe/dataset/listado-de-ofertantes-organismo-supervisor-de-contrataciones-del-estado-osce
  ofertantes: "c7d4b3a2-1f8e-4a6b-9c3f-2e5d8b1a7c4e",

  // Órdenes de compra y servicio (contrataciones < 10 UIT sin licitación)
  // Fuente: https://datosabiertos.gob.pe/dataset/ordenes-de-compra-organismo-supervisor-de-las-contrataciones-del-estado-osce
  ordenes: "d8e5c4b3-2a9f-4b7c-8d1e-3f6a9c2b5d7e",
} as const;

// ── Cache en memoria ─────────────────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const CACHE_TTL = {
  sancionados: 60 * 60 * 1000,      // 1 hora (se actualiza semanalmente)
  pac: 6 * 60 * 60 * 1000,          // 6 horas
  contratos: 6 * 60 * 60 * 1000,    // 6 horas
  ofertantes: 6 * 60 * 60 * 1000,   // 6 horas
  ordenes: 6 * 60 * 60 * 1000,      // 6 horas
};

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ── Helper CKAN ──────────────────────────────────────────────────────────────

interface CkanParams {
  resource_id: string;
  filters?: Record<string, string>;
  q?: string;
  limit?: number;
  offset?: number;
  fields?: string[];
}

interface CkanResponse {
  success: boolean;
  result?: {
    total: number;
    records: Record<string, unknown>[];
    fields: { id: string; type: string }[];
  };
  error?: { message: string };
}

async function ckanSearch(params: CkanParams): Promise<CkanResponse> {
  const url = new URL(PNDA_BASE);
  url.searchParams.set("resource_id", params.resource_id);
  url.searchParams.set("limit", String(params.limit ?? 100));
  if (params.offset) url.searchParams.set("offset", String(params.offset));
  if (params.q) url.searchParams.set("q", params.q);
  if (params.filters) url.searchParams.set("filters", JSON.stringify(params.filters));
  if (params.fields?.length) url.searchParams.set("fields", params.fields.join(","));

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": "VecinoVigilante/1.0 (transparencia ciudadana Chanchamayo Peru)",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`PNDA respondió HTTP ${res.status}`);
  return res.json() as Promise<CkanResponse>;
}

// ── GET /api/pnda/sancionados ────────────────────────────────────────────────
// Lista proveedores con inhabilitación vigente del Tribunal de Contrataciones.
// Parámetros opcionales: q (buscar por nombre/RUC), page, limit
router.get("/pnda/sancionados", async (req, res): Promise<void> => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const page = Math.max(1, parseInt(req.query.page as string ?? "1"));
    const limit = Math.min(100, parseInt(req.query.limit as string ?? "50"));
    const offset = (page - 1) * limit;

    const cacheKey = `sancionados:${q ?? ""}:${page}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const data = await ckanSearch({
      resource_id: RESOURCE_IDS.sancionados_inhabilitacion,
      q: q || undefined,
      limit,
      offset,
    });

    if (!data.success || !data.result) {
      res.status(502).json({ error: "El PNDA no devolvió datos válidos", detalle: data.error });
      return;
    }

    const resultado = {
      total: data.result.total,
      page,
      limit,
      pages: Math.ceil(data.result.total / limit),
      data: data.result.records.map((r) => ({
        ruc: r["RUC"] ?? r["ruc"] ?? null,
        nombre: r["NOMBRE"] ?? r["nombre"] ?? r["RAZON_SOCIAL"] ?? null,
        tipoSancion: r["TIPO_SANCION"] ?? r["tipo_sancion"] ?? null,
        fechaInicio: r["FECHA_INICIO"] ?? r["fecha_inicio"] ?? null,
        fechaFin: r["FECHA_FIN"] ?? r["fecha_fin"] ?? null,
        resolucion: r["RESOLUCION"] ?? r["resolucion"] ?? null,
        departamento: r["DEPARTAMENTO"] ?? null,
        provincia: r["PROVINCIA"] ?? null,
        distrito: r["DISTRITO"] ?? null,
      })),
      fuente: "PNDA - OECE Proveedores Inhabilitados (actualización semanal)",
      actualizadoEl: new Date().toISOString(),
    };

    setCached(cacheKey, resultado, CACHE_TTL.sancionados);
    res.json(resultado);
  } catch (err) {
    console.error("[pnda/sancionados]", err);
    res.status(500).json({ error: "Error consultando sancionados en el PNDA", detalle: String(err) });
  }
});

// ── GET /api/pnda/sancionados/:ruc ───────────────────────────────────────────
// Verifica si un RUC específico tiene sanciones vigentes. Útil para
// mostrar una alerta roja en la página de detalle de proveedor.
router.get("/pnda/sancionados/:ruc", async (req, res): Promise<void> => {
  try {
    const ruc = req.params.ruc?.replace(/\D/g, "");
    if (!ruc || ruc.length < 8) {
      res.status(400).json({ error: "RUC inválido" });
      return;
    }

    const cacheKey = `sancionado_ruc:${ruc}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const data = await ckanSearch({
      resource_id: RESOURCE_IDS.sancionados_inhabilitacion,
      filters: { RUC: ruc },
      limit: 10,
    });

    const sanciones = data.result?.records ?? [];
    const resultado = {
      ruc,
      estaSancionado: sanciones.length > 0,
      cantidadSanciones: sanciones.length,
      sanciones: sanciones.map((r) => ({
        tipoSancion: r["TIPO_SANCION"] ?? r["tipo_sancion"] ?? null,
        fechaInicio: r["FECHA_INICIO"] ?? r["fecha_inicio"] ?? null,
        fechaFin: r["FECHA_FIN"] ?? r["fecha_fin"] ?? null,
        resolucion: r["RESOLUCION"] ?? r["resolucion"] ?? null,
      })),
      fuente: "PNDA - OECE Inhabilitados vigentes",
      consultadoEl: new Date().toISOString(),
    };

    setCached(cacheKey, resultado, CACHE_TTL.sancionados);
    res.json(resultado);
  } catch (err) {
    console.error("[pnda/sancionados/:ruc]", err);
    res.status(500).json({ error: "Error verificando RUC en el PNDA", detalle: String(err) });
  }
});

// ── GET /api/pnda/pac ────────────────────────────────────────────────────────
// Plan Anual de Contrataciones — qué planean comprar las entidades.
// Parámetros: entidadRuc?, anio?, q?, page, limit
router.get("/pnda/pac", async (req, res): Promise<void> => {
  try {
    const entidadRuc = (req.query.entidadRuc as string | undefined)?.replace(/\D/g, "");
    const anio = req.query.anio as string | undefined;
    const q = req.query.q as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string ?? "1"));
    const limit = Math.min(100, parseInt(req.query.limit as string ?? "50"));
    const offset = (page - 1) * limit;

    const cacheKey = `pac:${entidadRuc ?? ""}:${anio ?? ""}:${q ?? ""}:${page}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const filters: Record<string, string> = {};
    if (entidadRuc) filters["RUC_ENTIDAD"] = entidadRuc;
    if (anio) filters["ANIO"] = anio;

    const data = await ckanSearch({
      resource_id: RESOURCE_IDS.pac,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      q: q || undefined,
      limit,
      offset,
    });

    if (!data.success || !data.result) {
      res.status(502).json({ error: "El PNDA no devolvió datos válidos para PAC" });
      return;
    }

    const resultado = {
      total: data.result.total,
      page,
      limit,
      pages: Math.ceil(data.result.total / limit),
      data: data.result.records.map((r) => ({
        entidadRuc: r["RUC_ENTIDAD"] ?? null,
        entidadNombre: r["NOMBRE_ENTIDAD"] ?? null,
        anio: r["ANIO"] ?? null,
        codigoItem: r["CODIGO_ITEM"] ?? null,
        descripcion: r["DESCRIPCION_OBJETO"] ?? r["descripcion"] ?? null,
        tipo: r["TIPO_OBJETO"] ?? null,
        montoEstimado: r["VALOR_ESTIMADO"] ?? r["MONTO_ESTIMADO"] ?? null,
        moneda: r["MONEDA"] ?? "PEN",
        fechaPrevista: r["FECHA_CONVOCATORIA"] ?? null,
        estado: r["ESTADO"] ?? null,
        ubigeo: r["UBIGEO"] ?? null,
        departamento: r["DEPARTAMENTO"] ?? null,
      })),
      fuente: "PNDA - OECE Plan Anual de Contrataciones",
      consultadoEl: new Date().toISOString(),
    };

    setCached(cacheKey, resultado, CACHE_TTL.pac);
    res.json(resultado);
  } catch (err) {
    console.error("[pnda/pac]", err);
    res.status(500).json({ error: "Error consultando PAC en el PNDA", detalle: String(err) });
  }
});

// ── GET /api/pnda/contratos ──────────────────────────────────────────────────
// Contratos firmados por entidades del Estado.
// Parámetros: entidadRuc?, proveedorRuc?, anio?, q?, page, limit
router.get("/pnda/contratos", async (req, res): Promise<void> => {
  try {
    const entidadRuc = (req.query.entidadRuc as string | undefined)?.replace(/\D/g, "");
    const proveedorRuc = (req.query.proveedorRuc as string | undefined)?.replace(/\D/g, "");
    const anio = req.query.anio as string | undefined;
    const q = req.query.q as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string ?? "1"));
    const limit = Math.min(100, parseInt(req.query.limit as string ?? "50"));
    const offset = (page - 1) * limit;

    const cacheKey = `contratos:${entidadRuc ?? ""}:${proveedorRuc ?? ""}:${anio ?? ""}:${q ?? ""}:${page}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const filters: Record<string, string> = {};
    if (entidadRuc) filters["RUC_ENTIDAD"] = entidadRuc;
    if (proveedorRuc) filters["RUC_PROVEEDOR"] = proveedorRuc;
    if (anio) filters["ANIO"] = anio;

    const data = await ckanSearch({
      resource_id: RESOURCE_IDS.contratos,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      q: q || undefined,
      limit,
      offset,
    });

    if (!data.success || !data.result) {
      res.status(502).json({ error: "El PNDA no devolvió datos válidos para contratos" });
      return;
    }

    const resultado = {
      total: data.result.total,
      page,
      limit,
      pages: Math.ceil(data.result.total / limit),
      data: data.result.records.map((r) => ({
        entidadRuc: r["RUC_ENTIDAD"] ?? null,
        entidadNombre: r["NOMBRE_ENTIDAD"] ?? null,
        proveedorRuc: r["RUC_PROVEEDOR"] ?? null,
        proveedorNombre: r["NOMBRE_PROVEEDOR"] ?? null,
        codigoContrato: r["CODIGO_CONTRATO"] ?? null,
        descripcion: r["DESCRIPCION_OBJETO"] ?? null,
        tipo: r["TIPO_OBJETO"] ?? null,
        monto: r["MONTO_CONTRATO"] ?? null,
        moneda: r["MONEDA"] ?? "PEN",
        fechaFirma: r["FECHA_SUSCRIPCION"] ?? r["FECHA_FIRMA"] ?? null,
        plazoEjecucion: r["PLAZO_EJECUCION"] ?? null,
        estado: r["ESTADO_CONTRATO"] ?? null,
        departamento: r["DEPARTAMENTO"] ?? null,
        ubigeo: r["UBIGEO"] ?? null,
      })),
      fuente: "PNDA - OECE Contratos de entidades",
      consultadoEl: new Date().toISOString(),
    };

    setCached(cacheKey, resultado, CACHE_TTL.contratos);
    res.json(resultado);
  } catch (err) {
    console.error("[pnda/contratos]", err);
    res.status(500).json({ error: "Error consultando contratos en el PNDA", detalle: String(err) });
  }
});

// ── GET /api/pnda/ofertantes ─────────────────────────────────────────────────
// Empresas que postulan a procesos — no solo las que ganan.
// Útil para detectar patrones de competencia artificial (un solo ofertante).
// Parámetros: entidadRuc?, anio?, q?, page, limit
router.get("/pnda/ofertantes", async (req, res): Promise<void> => {
  try {
    const entidadRuc = (req.query.entidadRuc as string | undefined)?.replace(/\D/g, "");
    const proveedorRuc = (req.query.proveedorRuc as string | undefined)?.replace(/\D/g, "");
    const anio = req.query.anio as string | undefined;
    const q = req.query.q as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string ?? "1"));
    const limit = Math.min(100, parseInt(req.query.limit as string ?? "50"));
    const offset = (page - 1) * limit;

    const cacheKey = `ofertantes:${entidadRuc ?? ""}:${proveedorRuc ?? ""}:${anio ?? ""}:${q ?? ""}:${page}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const filters: Record<string, string> = {};
    if (entidadRuc) filters["RUC_ENTIDAD"] = entidadRuc;
    if (proveedorRuc) filters["RUC_PROVEEDOR"] = proveedorRuc;
    if (anio) filters["ANIO"] = anio;

    const data = await ckanSearch({
      resource_id: RESOURCE_IDS.ofertantes,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      q: q || undefined,
      limit,
      offset,
    });

    if (!data.success || !data.result) {
      res.status(502).json({ error: "El PNDA no devolvió datos válidos para ofertantes" });
      return;
    }

    const resultado = {
      total: data.result.total,
      page,
      limit,
      pages: Math.ceil(data.result.total / limit),
      data: data.result.records.map((r) => ({
        entidadRuc: r["RUC_ENTIDAD"] ?? null,
        entidadNombre: r["NOMBRE_ENTIDAD"] ?? null,
        proveedorRuc: r["RUC_PROVEEDOR"] ?? null,
        proveedorNombre: r["NOMBRE_PROVEEDOR"] ?? null,
        codigoProceso: r["CODIGO_PROCESO"] ?? null,
        descripcion: r["DESCRIPCION_OBJETO"] ?? null,
        tipo: r["TIPO_OBJETO"] ?? null,
        anio: r["ANIO"] ?? null,
        // Si el ofertante ganó o no — campo clave para detectar empresas fachada
        esAdjudicado: r["ES_ADJUDICADO"] ?? r["ADJUDICADO"] ?? null,
        montoOferta: r["MONTO_OFERTA"] ?? null,
        departamento: r["DEPARTAMENTO"] ?? null,
      })),
      fuente: "PNDA - OECE Listado de ofertantes",
      consultadoEl: new Date().toISOString(),
    };

    setCached(cacheKey, resultado, CACHE_TTL.ofertantes);
    res.json(resultado);
  } catch (err) {
    console.error("[pnda/ofertantes]", err);
    res.status(500).json({ error: "Error consultando ofertantes en el PNDA", detalle: String(err) });
  }
});

// ── GET /api/pnda/ordenes ────────────────────────────────────────────────────
// Órdenes de compra y servicio — contrataciones menores a 10 UIT.
// Son las compras que no requieren licitación. Zona de riesgo de fraccionamiento.
// Parámetros: entidadRuc?, proveedorRuc?, anio?, mes?, q?, page, limit
router.get("/pnda/ordenes", async (req, res): Promise<void> => {
  try {
    const entidadRuc = (req.query.entidadRuc as string | undefined)?.replace(/\D/g, "");
    const proveedorRuc = (req.query.proveedorRuc as string | undefined)?.replace(/\D/g, "");
    const anio = req.query.anio as string | undefined;
    const mes = req.query.mes as string | undefined;
    const q = req.query.q as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string ?? "1"));
    const limit = Math.min(100, parseInt(req.query.limit as string ?? "50"));
    const offset = (page - 1) * limit;

    const cacheKey = `ordenes:${entidadRuc ?? ""}:${proveedorRuc ?? ""}:${anio ?? ""}:${mes ?? ""}:${q ?? ""}:${page}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const filters: Record<string, string> = {};
    if (entidadRuc) filters["RUC_ENTIDAD"] = entidadRuc;
    if (proveedorRuc) filters["RUC_PROVEEDOR"] = proveedorRuc;
    if (anio) filters["ANIO"] = anio;
    if (mes) filters["MES"] = mes;

    const data = await ckanSearch({
      resource_id: RESOURCE_IDS.ordenes,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      q: q || undefined,
      limit,
      offset,
    });

    if (!data.success || !data.result) {
      res.status(502).json({ error: "El PNDA no devolvió datos válidos para órdenes" });
      return;
    }

    const resultado = {
      total: data.result.total,
      page,
      limit,
      pages: Math.ceil(data.result.total / limit),
      data: data.result.records.map((r) => ({
        entidadRuc: r["RUC_ENTIDAD"] ?? null,
        entidadNombre: r["NOMBRE_ENTIDAD"] ?? null,
        proveedorRuc: r["RUC_PROVEEDOR"] ?? null,
        proveedorNombre: r["NOMBRE_PROVEEDOR"] ?? null,
        tipoOrden: r["TIPO_ORDEN"] ?? null,        // "COMPRA" o "SERVICIO"
        numeroOrden: r["NUMERO_ORDEN"] ?? null,
        descripcion: r["DESCRIPCION"] ?? r["BIEN_SERVICIO"] ?? null,
        monto: r["MONTO"] ?? r["IMPORTE_TOTAL"] ?? null,
        moneda: r["MONEDA"] ?? "PEN",
        fecha: r["FECHA_EMISION"] ?? r["FECHA"] ?? null,
        anio: r["ANIO"] ?? null,
        mes: r["MES"] ?? null,
        departamento: r["DEPARTAMENTO"] ?? null,
        ubigeo: r["UBIGEO"] ?? null,
      })),
      fuente: "PNDA - OECE Órdenes de compra y servicio",
      consultadoEl: new Date().toISOString(),
    };

    setCached(cacheKey, resultado, CACHE_TTL.ordenes);
    res.json(resultado);
  } catch (err) {
    console.error("[pnda/ordenes]", err);
    res.status(500).json({ error: "Error consultando órdenes en el PNDA", detalle: String(err) });
  }
});

// ── GET /api/pnda/cache/clear ────────────────────────────────────────────────
// Limpia el cache en memoria. Útil para forzar datos frescos en admin.
router.post("/pnda/cache/clear", (req, res): void => {
  const secret = process.env.SYNC_SECRET;
  if (secret && req.headers["x-sync-secret"] !== secret) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  const antes = cache.size;
  cache.clear();
  res.json({ message: `Cache limpiado. Se eliminaron ${antes} entradas.` });
});

export default router;
