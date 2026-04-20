import { Router, type IRouter } from "express";
import { db, entidadesTable, contratacionesTable, proveedoresTable, ubigeosTable } from "@workspace/db";
import { eq, and, ilike, sql, desc, or } from "drizzle-orm";
import { GetEntidadesQueryParams, GetEntidadParams } from "@workspace/api-zod";

const router: IRouter = Router();

const CURRENT_YEAR = new Date().getFullYear();
const START_OF_YEAR = new Date(`${CURRENT_YEAR}-01-01`);

router.get("/entidades", async (req, res): Promise<void> => {
  const parsed = GetEntidadesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page = 1, limit = 50, q, ubigeo } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (q) {
    conditions.push(or(ilike(entidadesTable.nombre, `%${q}%`), ilike(entidadesTable.ruc, `%${q}%`)));
  }
  if (ubigeo) {
    conditions.push(eq(entidadesTable.ubigeoCodigo, ubigeo));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        ruc: entidadesTable.ruc,
        nombre: entidadesTable.nombre,
        tipo: entidadesTable.tipo,
        nivelGobierno: entidadesTable.nivelGobierno,
        ubigeoCodigo: entidadesTable.ubigeoCodigo,
      })
      .from(entidadesTable)
      .where(where)
      .orderBy(entidadesTable.nombre)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(entidadesTable).where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  res.json({
    data: rows,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

router.get("/entidades/:ruc", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.ruc) ? req.params.ruc[0] : req.params.ruc;
  const params = GetEntidadParams.safeParse({ ruc: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entidad] = await db
    .select()
    .from(entidadesTable)
    .where(eq(entidadesTable.ruc, params.data.ruc))
    .limit(1);

  if (!entidad) {
    res.status(404).json({ error: "Entidad no encontrada" });
    return;
  }

  const where = eq(contratacionesTable.entidadRuc, params.data.ruc);

  const [statsResult, topProveedoresResult, contratacionesRecientes, distribucionResult] = await Promise.all([
    db
      .select({
        totalContrataciones: sql<number>`COUNT(*)`,
        montoTotal: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
        contratacionesEsteAnio: sql<number>`COUNT(*) FILTER (WHERE ${contratacionesTable.fechaConvocatoria} >= ${START_OF_YEAR})`,
      })
      .from(contratacionesTable)
      .where(where),
    db
      .select({
        ruc: proveedoresTable.ruc,
        razonSocial: proveedoresTable.razonSocial,
        totalAdjudicaciones: sql<number>`COUNT(*)`,
        montoTotal: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
      })
      .from(contratacionesTable)
      .innerJoin(proveedoresTable, eq(contratacionesTable.proveedorRuc, proveedoresTable.ruc))
      .where(and(where, sql`${contratacionesTable.proveedorRuc} IS NOT NULL`))
      .groupBy(proveedoresTable.ruc, proveedoresTable.razonSocial)
      .orderBy(desc(sql`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`))
      .limit(5),
    db
      .select({
        ocid: contratacionesTable.ocid,
        nomenclatura: contratacionesTable.nomenclatura,
        titulo: contratacionesTable.titulo,
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
        descripcion: contratacionesTable.descripcion,
        createdAt: contratacionesTable.createdAt,
        updatedAt: contratacionesTable.updatedAt,
      })
      .from(contratacionesTable)
      .leftJoin(entidadesTable, eq(contratacionesTable.entidadRuc, entidadesTable.ruc))
      .leftJoin(proveedoresTable, eq(contratacionesTable.proveedorRuc, proveedoresTable.ruc))
      .leftJoin(ubigeosTable, eq(contratacionesTable.ubigeoCodigo, ubigeosTable.codigo))
      .where(where)
      .orderBy(desc(contratacionesTable.fechaConvocatoria))
      .limit(10),
    db
      .select({
        tipo: contratacionesTable.tipo,
        total: sql<number>`COUNT(*)`,
        monto: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
      })
      .from(contratacionesTable)
      .where(where)
      .groupBy(contratacionesTable.tipo),
  ]);

  const s = statsResult[0];
  const totalContrataciones = Number(s?.totalContrataciones ?? 0);
  const totalItems = distribucionResult.reduce((acc, d) => acc + Number(d.total), 0);

  let ubigeoData = null;
  if (entidad.ubigeoCodigo) {
    const [u] = await db
      .select()
      .from(ubigeosTable)
      .where(eq(ubigeosTable.codigo, entidad.ubigeoCodigo))
      .limit(1);
    if (u) {
      ubigeoData = {
        codigo: u.codigo,
        departamento: u.departamento,
        provincia: u.provincia,
        distrito: u.distrito,
        latitud: u.latitud != null ? parseFloat(u.latitud) : null,
        longitud: u.longitud != null ? parseFloat(u.longitud) : null,
      };
    }
  }

  res.json({
    ruc: entidad.ruc,
    nombre: entidad.nombre,
    tipo: entidad.tipo,
    nivelGobierno: entidad.nivelGobierno,
    ubigeoCodigo: entidad.ubigeoCodigo,
    ubigeo: ubigeoData,
    totalContrataciones,
    montoTotal: s?.montoTotal ? parseFloat(s.montoTotal) : null,
    contratacionesEsteAnio: Number(s?.contratacionesEsteAnio ?? 0),
    topProveedores: topProveedoresResult.map((p) => ({
      ruc: p.ruc,
      razonSocial: p.razonSocial,
      totalAdjudicaciones: Number(p.totalAdjudicaciones),
      montoTotal: p.montoTotal ? parseFloat(p.montoTotal) : null,
    })),
    contratacionesRecientes: contratacionesRecientes.map((r) => ({
      ...r,
      montoReferencial: r.montoReferencial != null ? parseFloat(r.montoReferencial) : null,
      montoAdjudicado: r.montoAdjudicado != null ? parseFloat(r.montoAdjudicado) : null,
      fechaConvocatoria: r.fechaConvocatoria?.toISOString() ?? null,
      fechaAdjudicacion: r.fechaAdjudicacion?.toISOString() ?? null,
      fechaContrato: r.fechaContrato?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString() ?? null,
      updatedAt: r.updatedAt?.toISOString() ?? null,
    })),
    distribucionTipo: distribucionResult.map((d) => ({
      tipo: d.tipo ?? "OTROS",
      total: Number(d.total),
      monto: d.monto ? parseFloat(d.monto) : null,
      porcentaje: totalItems > 0 ? (Number(d.total) / totalItems) * 100 : 0,
    })),
  });
});

export default router;
