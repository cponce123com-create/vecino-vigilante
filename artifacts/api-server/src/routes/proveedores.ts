import { Router, type IRouter } from "express";
import { db, proveedoresTable, contratacionesTable, entidadesTable, ubigeosTable } from "@workspace/db";
import { eq, and, ilike, sql, desc, or } from "drizzle-orm";
import { GetProveedoresQueryParams, GetProveedorParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/proveedores", async (req, res): Promise<void> => {
  const parsed = GetProveedoresQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page = 1, limit = 50, q } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (q) {
    conditions.push(or(ilike(proveedoresTable.razonSocial, `%${q}%`), ilike(proveedoresTable.ruc, `%${q}%`)));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        ruc: proveedoresTable.ruc,
        razonSocial: proveedoresTable.razonSocial,
        ubigeoCodigo: proveedoresTable.ubigeoCodigo,
        vigenteRnp: proveedoresTable.vigenteRnp,
      })
      .from(proveedoresTable)
      .where(where)
      .orderBy(proveedoresTable.razonSocial)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(proveedoresTable).where(where),
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

router.get("/proveedores/:ruc", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.ruc) ? req.params.ruc[0] : req.params.ruc;
  const params = GetProveedorParams.safeParse({ ruc: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [proveedor] = await db
    .select()
    .from(proveedoresTable)
    .where(eq(proveedoresTable.ruc, params.data.ruc))
    .limit(1);

  if (!proveedor) {
    res.status(404).json({ error: "Proveedor no encontrado" });
    return;
  }

  const where = and(
    eq(contratacionesTable.proveedorRuc, params.data.ruc),
    sql`${contratacionesTable.proveedorRuc} IS NOT NULL`
  );

  const [statsResult, adjudicacionesRecientes, topEntidadesResult, evolucionResult] = await Promise.all([
    db
      .select({
        totalAdjudicaciones: sql<number>`COUNT(*)`,
        montoTotalGanado: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
        entidadesUnicas: sql<number>`COUNT(DISTINCT ${contratacionesTable.entidadRuc})`,
      })
      .from(contratacionesTable)
      .where(where),
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
      .orderBy(desc(contratacionesTable.fechaAdjudicacion))
      .limit(10),
    db
      .select({
        ruc: entidadesTable.ruc,
        nombre: entidadesTable.nombre,
        totalContrataciones: sql<number>`COUNT(*)`,
        montoTotal: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
      })
      .from(contratacionesTable)
      .innerJoin(entidadesTable, eq(contratacionesTable.entidadRuc, entidadesTable.ruc))
      .where(and(where, sql`${contratacionesTable.entidadRuc} IS NOT NULL`))
      .groupBy(entidadesTable.ruc, entidadesTable.nombre)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5),
    db
      .select({
        mes: sql<string>`TO_CHAR(${contratacionesTable.fechaAdjudicacion}, 'Mon')`,
        anio: sql<number>`EXTRACT(YEAR FROM ${contratacionesTable.fechaAdjudicacion})`,
        periodo: sql<string>`TO_CHAR(${contratacionesTable.fechaAdjudicacion}, 'YYYY-MM')`,
        totalContrataciones: sql<number>`COUNT(*)`,
        montoTotal: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
      })
      .from(contratacionesTable)
      .where(and(where, sql`${contratacionesTable.fechaAdjudicacion} IS NOT NULL`))
      .groupBy(
        sql`TO_CHAR(${contratacionesTable.fechaAdjudicacion}, 'Mon')`,
        sql`EXTRACT(YEAR FROM ${contratacionesTable.fechaAdjudicacion})`,
        sql`TO_CHAR(${contratacionesTable.fechaAdjudicacion}, 'YYYY-MM')`
      )
      .orderBy(sql`TO_CHAR(${contratacionesTable.fechaAdjudicacion}, 'YYYY-MM')`)
      .limit(24),
  ]);

  const s = statsResult[0];

  res.json({
    ruc: proveedor.ruc,
    razonSocial: proveedor.razonSocial,
    ubigeoCodigo: proveedor.ubigeoCodigo,
    vigenteRnp: proveedor.vigenteRnp,
    totalAdjudicaciones: Number(s?.totalAdjudicaciones ?? 0),
    montoTotalGanado: s?.montoTotalGanado ? parseFloat(s.montoTotalGanado) : null,
    entidadesUnicas: Number(s?.entidadesUnicas ?? 0),
    adjudicacionesRecientes: adjudicacionesRecientes.map((r) => ({
      ...r,
      montoReferencial: r.montoReferencial != null ? parseFloat(r.montoReferencial) : null,
      montoAdjudicado: r.montoAdjudicado != null ? parseFloat(r.montoAdjudicado) : null,
      fechaConvocatoria: r.fechaConvocatoria?.toISOString() ?? null,
      fechaAdjudicacion: r.fechaAdjudicacion?.toISOString() ?? null,
      fechaContrato: r.fechaContrato?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString() ?? null,
      updatedAt: r.updatedAt?.toISOString() ?? null,
    })),
    topEntidades: topEntidadesResult.map((e) => ({
      ruc: e.ruc,
      nombre: e.nombre,
      totalContrataciones: Number(e.totalContrataciones),
      montoTotal: e.montoTotal ? parseFloat(e.montoTotal) : null,
    })),
    evolucionMensual: evolucionResult.map((e) => ({
      mes: e.mes,
      anio: Number(e.anio),
      periodo: e.periodo,
      totalContrataciones: Number(e.totalContrataciones),
      montoTotal: e.montoTotal ? parseFloat(e.montoTotal) : null,
    })),
  });
});

export default router;
