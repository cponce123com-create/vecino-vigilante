import { Router, type IRouter } from "express";
import { db, contratacionesTable, entidadesTable, proveedoresTable, ubigeosTable } from "@workspace/db";
import { eq, and, sql, desc, gt } from "drizzle-orm";
import { GetRankingsQueryParams, GetAlertasQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/observatorio/rankings", async (req, res): Promise<void> => {
  const parsed = GetRankingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { anio, ubigeo } = parsed.data;
  const conditions = [];
  if (ubigeo) conditions.push(eq(contratacionesTable.ubigeoCodigo, ubigeo));
  if (anio) {
    conditions.push(sql`EXTRACT(YEAR FROM ${contratacionesTable.fechaConvocatoria}) = ${anio}`);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [topEntidades, topProveedores, entidadesMasDirectas] = await Promise.all([
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
      .orderBy(desc(sql`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`))
      .limit(10),
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
      .where(and(where, eq(contratacionesTable.procedimiento, "CD"), sql`${contratacionesTable.entidadRuc} IS NOT NULL`))
      .groupBy(entidadesTable.ruc, entidadesTable.nombre)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10),
  ]);

  res.json({
    topEntidadesMonto: topEntidades.map((e) => ({
      ruc: e.ruc,
      nombre: e.nombre,
      totalContrataciones: Number(e.totalContrataciones),
      montoTotal: e.montoTotal ? parseFloat(e.montoTotal) : null,
    })),
    topProveedoresMonto: topProveedores.map((p) => ({
      ruc: p.ruc,
      razonSocial: p.razonSocial,
      totalAdjudicaciones: Number(p.totalAdjudicaciones),
      montoTotal: p.montoTotal ? parseFloat(p.montoTotal) : null,
    })),
    entidadesMasDirectas: entidadesMasDirectas.map((e) => ({
      ruc: e.ruc,
      nombre: e.nombre,
      totalContrataciones: Number(e.totalContrataciones),
      montoTotal: e.montoTotal ? parseFloat(e.montoTotal) : null,
    })),
  });
});

router.get("/observatorio/alertas", async (req, res): Promise<void> => {
  const parsed = GetAlertasQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ubigeo, limit = 20 } = parsed.data;
  const conditions = [];
  if (ubigeo) conditions.push(eq(contratacionesTable.ubigeoCodigo, ubigeo));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const directas = await db
    .select({
      ocid: contratacionesTable.ocid,
      titulo: contratacionesTable.titulo,
      procedimiento: contratacionesTable.procedimiento,
      montoReferencial: contratacionesTable.montoReferencial,
      montoAdjudicado: contratacionesTable.montoAdjudicado,
      entidadNombre: entidadesTable.nombre,
      ubigeoCodigo: contratacionesTable.ubigeoCodigo,
    })
    .from(contratacionesTable)
    .leftJoin(entidadesTable, eq(contratacionesTable.entidadRuc, entidadesTable.ruc))
    .where(and(where, eq(contratacionesTable.procedimiento, "CD")))
    .orderBy(desc(sql`CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL)`))
    .limit(Math.ceil(limit / 2));

  const diferenciaMonto = await db
    .select({
      ocid: contratacionesTable.ocid,
      titulo: contratacionesTable.titulo,
      procedimiento: contratacionesTable.procedimiento,
      montoReferencial: contratacionesTable.montoReferencial,
      montoAdjudicado: contratacionesTable.montoAdjudicado,
      entidadNombre: entidadesTable.nombre,
      ubigeoCodigo: contratacionesTable.ubigeoCodigo,
    })
    .from(contratacionesTable)
    .leftJoin(entidadesTable, eq(contratacionesTable.entidadRuc, entidadesTable.ruc))
    .where(
      and(
        where,
        sql`${contratacionesTable.montoReferencial} IS NOT NULL`,
        sql`${contratacionesTable.montoAdjudicado} IS NOT NULL`,
        sql`ABS(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL) - CAST(${contratacionesTable.montoReferencial} AS DECIMAL)) / NULLIF(CAST(${contratacionesTable.montoReferencial} AS DECIMAL), 0) > 0.2`
      )
    )
    .orderBy(
      desc(
        sql`ABS(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL) - CAST(${contratacionesTable.montoReferencial} AS DECIMAL)) / NULLIF(CAST(${contratacionesTable.montoReferencial} AS DECIMAL), 0)`
      )
    )
    .limit(Math.ceil(limit / 2));

  const alertas = [
    ...directas.map((c) => ({
      ocid: c.ocid,
      titulo: c.titulo,
      tipoAlerta: "contratacion_directa",
      descripcionAlerta: "Contratación directa sin proceso competitivo",
      montoReferencial: c.montoReferencial != null ? parseFloat(c.montoReferencial) : null,
      montoAdjudicado: c.montoAdjudicado != null ? parseFloat(c.montoAdjudicado) : null,
      entidadNombre: c.entidadNombre,
      distrito: c.ubigeoCodigo,
      procedimiento: c.procedimiento,
    })),
    ...diferenciaMonto.map((c) => ({
      ocid: c.ocid,
      titulo: c.titulo,
      tipoAlerta: "diferencia_monto",
      descripcionAlerta: "Diferencia significativa entre monto referencial y adjudicado (>20%)",
      montoReferencial: c.montoReferencial != null ? parseFloat(c.montoReferencial) : null,
      montoAdjudicado: c.montoAdjudicado != null ? parseFloat(c.montoAdjudicado) : null,
      entidadNombre: c.entidadNombre,
      distrito: c.ubigeoCodigo,
      procedimiento: c.procedimiento,
    })),
  ];

  res.json(alertas.slice(0, limit));
});

// ── GET /api/observatorio/observadas ────────────────────────────────
router.get("/observatorio/observadas", async (req, res): Promise<void> => {
  const ubigeo = req.query.ubigeo as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string ?? "30"), 100);
  const page = Math.max(parseInt(req.query.page as string ?? "1"), 1);
  const offset = (page - 1) * limit;

  const conditions = [gt(contratacionesTable.observacionesCount, 0)];
  if (ubigeo) conditions.push(eq(contratacionesTable.ubigeoCodigo, ubigeo));
  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db.select({
      ocid: contratacionesTable.ocid,
      titulo: contratacionesTable.titulo,
      tipo: contratacionesTable.tipo,
      procedimiento: contratacionesTable.procedimiento,
      estado: contratacionesTable.estado,
      observacionesCount: contratacionesTable.observacionesCount,
      montoReferencial: contratacionesTable.montoReferencial,
      montoAdjudicado: contratacionesTable.montoAdjudicado,
      fechaConvocatoria: contratacionesTable.fechaConvocatoria,
      entidadNombre: entidadesTable.nombre,
      entidadRuc: contratacionesTable.entidadRuc,
      ubigeoDistrito: ubigeosTable.distrito,
      ubigeoCodigo: contratacionesTable.ubigeoCodigo,
    })
    .from(contratacionesTable)
    .leftJoin(entidadesTable, eq(contratacionesTable.entidadRuc, entidadesTable.ruc))
    .leftJoin(ubigeosTable, eq(contratacionesTable.ubigeoCodigo, ubigeosTable.codigo))
    .where(where)
    .orderBy(desc(contratacionesTable.observacionesCount))
    .limit(limit)
    .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(contratacionesTable).where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  res.json({
    data: rows.map((r) => ({
      ...r,
      montoReferencial: r.montoReferencial != null ? parseFloat(r.montoReferencial) : null,
      montoAdjudicado: r.montoAdjudicado != null ? parseFloat(r.montoAdjudicado) : null,
      fechaConvocatoria: r.fechaConvocatoria?.toISOString() ?? null,
    })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

export default router;
