import { Router, type IRouter } from "express";
import { db, contratacionesTable, entidadesTable, proveedoresTable, ubigeosTable, articulosAdjudicadosTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, sql, desc, asc, or } from "drizzle-orm";
import {
  GetContratacionesQueryParams,
  GetContratacionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function buildContratacionFilters(params: {
  ubigeo?: string | null;
  tipo?: string | null;
  estado?: string | null;
  procedimiento?: string | null;
  entidadRuc?: string | null;
  proveedorRuc?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  montoMin?: number | null;
  montoMax?: number | null;
  q?: string | null;
}) {
  const conditions = [];
  if (params.ubigeo) conditions.push(eq(contratacionesTable.ubigeoCodigo, params.ubigeo));
  if (params.tipo) conditions.push(eq(contratacionesTable.tipo, params.tipo));
  if (params.estado) conditions.push(eq(contratacionesTable.estado, params.estado));
  if (params.procedimiento) conditions.push(eq(contratacionesTable.procedimiento, params.procedimiento));
  if (params.entidadRuc) conditions.push(eq(contratacionesTable.entidadRuc, params.entidadRuc));
  if (params.proveedorRuc) conditions.push(eq(contratacionesTable.proveedorRuc, params.proveedorRuc));
  if (params.fechaDesde) conditions.push(gte(contratacionesTable.fechaConvocatoria, new Date(params.fechaDesde)));
  if (params.fechaHasta) conditions.push(lte(contratacionesTable.fechaConvocatoria, new Date(params.fechaHasta)));
  if (params.montoMin != null) conditions.push(gte(sql`CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL)`, params.montoMin));
  if (params.montoMax != null) conditions.push(lte(sql`CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL)`, params.montoMax));
  if (params.q) {
    conditions.push(
      or(
        ilike(contratacionesTable.titulo, `%${params.q}%`),
        ilike(contratacionesTable.nomenclatura, `%${params.q}%`),
        ilike(contratacionesTable.descripcion, `%${params.q}%`)
      )
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

// ── GET /api/contrataciones ──────────────────────────────────────────
router.get("/contrataciones", async (req, res): Promise<void> => {
  const parsed = GetContratacionesQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { page = 1, limit = 20, ubigeo, tipo, estado, procedimiento, entidadRuc, proveedorRuc,
    fechaDesde, fechaHasta, montoMin, montoMax, q, ordenar } = parsed.data;

  const where = buildContratacionFilters({ ubigeo, tipo, estado, procedimiento, entidadRuc,
    proveedorRuc, fechaDesde, fechaHasta, montoMin, montoMax, q });

  const orderBy = (() => {
    switch (ordenar) {
      case "fecha_asc": return asc(contratacionesTable.fechaConvocatoria);
      case "monto_desc": return desc(sql`CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL)`);
      case "monto_asc": return asc(sql`CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL)`);
      default: return desc(contratacionesTable.fechaConvocatoria);
    }
  })();

  const offset = (page - 1) * limit;

  const [rows, countResult, montoResult] = await Promise.all([
    db.select({
        ocid: contratacionesTable.ocid,
        nomenclatura: contratacionesTable.nomenclatura,
        titulo: contratacionesTable.titulo,
        descripcion: contratacionesTable.descripcion,
        tipo: contratacionesTable.tipo,
        procedimiento: contratacionesTable.procedimiento,
        estado: contratacionesTable.estado,
        entidadRuc: contratacionesTable.entidadRuc,
        entidadNombre: entidadesTable.nombre,
        proveedorRuc: contratacionesTable.proveedorRuc,
        proveedorNombre: proveedoresTable.razonSocial,
        ubigeoCodigo: contratacionesTable.ubigeoCodigo,
        ubigeoDistrito: ubigeosTable.distrito,
        ubigeoProvincia: ubigeosTable.provincia,
        montoReferencial: contratacionesTable.montoReferencial,
        montoAdjudicado: contratacionesTable.montoAdjudicado,
        moneda: contratacionesTable.moneda,
        fechaConvocatoria: contratacionesTable.fechaConvocatoria,
        fechaAdjudicacion: contratacionesTable.fechaAdjudicacion,
        fechaContrato: contratacionesTable.fechaContrato,
        plazoEjecucionDias: contratacionesTable.plazoEjecucionDias,
        createdAt: contratacionesTable.createdAt,
        updatedAt: contratacionesTable.updatedAt,
      })
      .from(contratacionesTable)
      .leftJoin(entidadesTable, eq(contratacionesTable.entidadRuc, entidadesTable.ruc))
      .leftJoin(proveedoresTable, eq(contratacionesTable.proveedorRuc, proveedoresTable.ruc))
      .leftJoin(ubigeosTable, eq(contratacionesTable.ubigeoCodigo, ubigeosTable.codigo))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(contratacionesTable).where(where),
    db.select({ total: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))` })
      .from(contratacionesTable).where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const montoTotal = montoResult[0]?.total ? parseFloat(montoResult[0].total) : null;

  res.json({
    data: rows.map((r) => ({
      ...r,
      montoReferencial: r.montoReferencial != null ? parseFloat(r.montoReferencial) : null,
      montoAdjudicado: r.montoAdjudicado != null ? parseFloat(r.montoAdjudicado) : null,
      fechaConvocatoria: r.fechaConvocatoria?.toISOString() ?? null,
      fechaAdjudicacion: r.fechaAdjudicacion?.toISOString() ?? null,
      fechaContrato: r.fechaContrato?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString() ?? null,
      updatedAt: r.updatedAt?.toISOString() ?? null,
    })),
    total, page, limit, pages: Math.ceil(total / limit), montoTotal,
  });
});

// ── GET /api/contrataciones/:ocid ────────────────────────────────────
router.get("/contrataciones/:ocid", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.ocid) ? req.params.ocid[0] : req.params.ocid;
  const params = GetContratacionParams.safeParse({ ocid: raw });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const rows = await db.select({
      ocid: contratacionesTable.ocid,
      nomenclatura: contratacionesTable.nomenclatura,
      titulo: contratacionesTable.titulo,
      descripcion: contratacionesTable.descripcion,
      tipo: contratacionesTable.tipo,
      procedimiento: contratacionesTable.procedimiento,
      estado: contratacionesTable.estado,
      entidadRuc: contratacionesTable.entidadRuc,
      entidadNombre: entidadesTable.nombre,
      proveedorRuc: contratacionesTable.proveedorRuc,
      proveedorNombre: proveedoresTable.razonSocial,
      ubigeoCodigo: contratacionesTable.ubigeoCodigo,
      ubigeoDistrito: ubigeosTable.distrito,
      ubigeoProvincia: ubigeosTable.provincia,
      montoReferencial: contratacionesTable.montoReferencial,
      montoAdjudicado: contratacionesTable.montoAdjudicado,
      moneda: contratacionesTable.moneda,
      fechaConvocatoria: contratacionesTable.fechaConvocatoria,
      fechaAdjudicacion: contratacionesTable.fechaAdjudicacion,
      fechaContrato: contratacionesTable.fechaContrato,
      plazoEjecucionDias: contratacionesTable.plazoEjecucionDias,
      rawOcds: contratacionesTable.rawOcds,
      createdAt: contratacionesTable.createdAt,
      updatedAt: contratacionesTable.updatedAt,
    })
    .from(contratacionesTable)
    .leftJoin(entidadesTable, eq(contratacionesTable.entidadRuc, entidadesTable.ruc))
    .leftJoin(proveedoresTable, eq(contratacionesTable.proveedorRuc, proveedoresTable.ruc))
    .leftJoin(ubigeosTable, eq(contratacionesTable.ubigeoCodigo, ubigeosTable.codigo))
    .where(eq(contratacionesTable.ocid, params.data.ocid))
    .limit(1);

  if (!rows[0]) { res.status(404).json({ error: "Contratación no encontrada" }); return; }

  const r = rows[0];
  res.json({
    ...r,
    montoReferencial: r.montoReferencial != null ? parseFloat(r.montoReferencial) : null,
    montoAdjudicado: r.montoAdjudicado != null ? parseFloat(r.montoAdjudicado) : null,
    fechaConvocatoria: r.fechaConvocatoria?.toISOString() ?? null,
    fechaAdjudicacion: r.fechaAdjudicacion?.toISOString() ?? null,
    fechaContrato: r.fechaContrato?.toISOString() ?? null,
    createdAt: r.createdAt?.toISOString() ?? null,
    updatedAt: r.updatedAt?.toISOString() ?? null,
    entidad: r.entidadRuc ? { ruc: r.entidadRuc, nombre: r.entidadNombre ?? "" } : null,
    proveedor: r.proveedorRuc ? { ruc: r.proveedorRuc, razonSocial: r.proveedorNombre ?? "" } : null,
    ubigeo: r.ubigeoCodigo ? {
      codigo: r.ubigeoCodigo,
      departamento: "Junín",
      provincia: r.ubigeoProvincia ?? "",
      distrito: r.ubigeoDistrito ?? "",
    } : null,
  });
});

// ── GET /api/contrataciones/:ocid/articulos ──────────────────────────
router.get("/contrataciones/:ocid/articulos", async (req, res): Promise<void> => {
  const ocid = Array.isArray(req.params.ocid) ? req.params.ocid[0] : req.params.ocid;
  if (!ocid) { res.status(400).json({ error: "OCID requerido" }); return; }

  const articulos = await db
    .select()
    .from(articulosAdjudicadosTable)
    .where(eq(articulosAdjudicadosTable.ocid, ocid))
    .orderBy(articulosAdjudicadosTable.posicion);

  res.json(
    articulos.map((a) => ({
      ...a,
      cantidad: a.cantidad != null ? parseFloat(a.cantidad) : null,
      montoTotal: a.montoTotal != null ? parseFloat(a.montoTotal) : null,
    }))
  );
});

export default router;
