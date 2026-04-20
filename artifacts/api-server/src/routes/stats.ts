import { Router, type IRouter } from "express";
import { db, contratacionesTable, entidadesTable, proveedoresTable, syncLogTable } from "@workspace/db";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { GetStatsQueryParams, GetEvolucionMensualQueryParams, GetTipoDistribucionQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

const CURRENT_YEAR = new Date().getFullYear();
const START_OF_YEAR = new Date(`${CURRENT_YEAR - 1}-01-01`);

router.get("/stats", async (req, res): Promise<void> => {
  const parsed = GetStatsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { anio, ubigeo } = parsed.data;

  const conditions = [];
  if (ubigeo) conditions.push(eq(contratacionesTable.ubigeoCodigo, ubigeo));

  const yearStart = anio ? new Date(`${anio}-01-01`) : START_OF_YEAR;
  const yearEnd = anio ? new Date(`${anio}-12-31`) : new Date();

  const conditionsThisYear = [
    ...conditions,
    gte(contratacionesTable.fechaConvocatoria, yearStart),
    sql`${contratacionesTable.fechaConvocatoria} <= ${yearEnd}`,
  ];

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const whereThisYear = and(...conditionsThisYear);

  const [totalesResult, anoResult, obrasResult, entidadesResult, proveedoresResult, syncResult] = await Promise.all([
    db
      .select({
        totalContrataciones: sql<number>`COUNT(*)`,
        montoTotal: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
      })
      .from(contratacionesTable)
      .where(where),
    db
      .select({
        contratacionesEsteAnio: sql<number>`COUNT(*)`,
        montoEsteAnio: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
      })
      .from(contratacionesTable)
      .where(whereThisYear),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(contratacionesTable)
      .where(and(where, eq(contratacionesTable.tipo, "OBRAS"), eq(contratacionesTable.estado, "CONTRATADO"))),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${contratacionesTable.entidadRuc})` })
      .from(contratacionesTable)
      .where(where),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${contratacionesTable.proveedorRuc})` })
      .from(contratacionesTable)
      .where(where),
    db
      .select({ fechaEjecucion: syncLogTable.fechaEjecucion })
      .from(syncLogTable)
      .where(eq(syncLogTable.estado, "OK"))
      .orderBy(desc(syncLogTable.fechaEjecucion))
      .limit(1),
  ]);

  const total = Number(totalesResult[0]?.totalContrataciones ?? 0);
  const thisAnioTotal = Number(anoResult[0]?.contratacionesEsteAnio ?? 0);
  const thisAnioMonto = anoResult[0]?.montoEsteAnio ? parseFloat(anoResult[0].montoEsteAnio) : null;

  const directasResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(contratacionesTable)
    .where(and(where, eq(contratacionesTable.procedimiento, "CD")));

  const totalCount = Number(totalesResult[0]?.totalContrataciones ?? 0);
  const directasCount = Number(directasResult[0]?.count ?? 0);
  const porcentajeDirectas = totalCount > 0 ? (directasCount / totalCount) * 100 : 0;

  res.json({
    totalContrataciones: totalCount,
    montoTotal: totalesResult[0]?.montoTotal ? parseFloat(totalesResult[0].montoTotal) : null,
    contratacionesEsteAnio: thisAnioTotal,
    montoEsteAnio: thisAnioMonto,
    obrasEnEjecucion: Number(obrasResult[0]?.count ?? 0),
    entidadesActivas: Number(entidadesResult[0]?.count ?? 0),
    proveedoresUnicos: Number(proveedoresResult[0]?.count ?? 0),
    ultimaSincronizacion: syncResult[0]?.fechaEjecucion?.toISOString() ?? null,
    porcentajeDirectas,
    porcentajeCompetitivas: 100 - porcentajeDirectas,
  });
});

router.get("/stats/evolucion", async (req, res): Promise<void> => {
  const parsed = GetEvolucionMensualQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ubigeo, anios = 2 } = parsed.data;
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - (anios ?? 2));

  const conditions = [
    gte(contratacionesTable.fechaConvocatoria, startDate),
    sql`${contratacionesTable.fechaConvocatoria} IS NOT NULL`,
  ];
  if (ubigeo) conditions.push(eq(contratacionesTable.ubigeoCodigo, ubigeo));

  const result = await db
    .select({
      mes: sql<string>`TO_CHAR(${contratacionesTable.fechaConvocatoria}, 'Mon')`,
      anio: sql<number>`EXTRACT(YEAR FROM ${contratacionesTable.fechaConvocatoria})`,
      periodo: sql<string>`TO_CHAR(${contratacionesTable.fechaConvocatoria}, 'YYYY-MM')`,
      totalContrataciones: sql<number>`COUNT(*)`,
      montoTotal: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
    })
    .from(contratacionesTable)
    .where(and(...conditions))
    .groupBy(
      sql`TO_CHAR(${contratacionesTable.fechaConvocatoria}, 'Mon')`,
      sql`EXTRACT(YEAR FROM ${contratacionesTable.fechaConvocatoria})`,
      sql`TO_CHAR(${contratacionesTable.fechaConvocatoria}, 'YYYY-MM')`
    )
    .orderBy(sql`TO_CHAR(${contratacionesTable.fechaConvocatoria}, 'YYYY-MM')`);

  res.json(
    result.map((e) => ({
      mes: e.mes,
      anio: Number(e.anio),
      periodo: e.periodo,
      totalContrataciones: Number(e.totalContrataciones),
      montoTotal: e.montoTotal ? parseFloat(e.montoTotal) : null,
    }))
  );
});

router.get("/stats/tipo-distribucion", async (req, res): Promise<void> => {
  const parsed = GetTipoDistribucionQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ubigeo, anio } = parsed.data;
  const conditions = [];
  if (ubigeo) conditions.push(eq(contratacionesTable.ubigeoCodigo, ubigeo));
  if (anio) {
    conditions.push(gte(contratacionesTable.fechaConvocatoria, new Date(`${anio}-01-01`)));
    conditions.push(sql`${contratacionesTable.fechaConvocatoria} <= ${new Date(`${anio}-12-31`)}`);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({
      tipo: contratacionesTable.tipo,
      total: sql<number>`COUNT(*)`,
      monto: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
    })
    .from(contratacionesTable)
    .where(where)
    .groupBy(contratacionesTable.tipo);

  const totalItems = result.reduce((acc, d) => acc + Number(d.total), 0);

  res.json(
    result.map((d) => ({
      tipo: d.tipo ?? "OTROS",
      total: Number(d.total),
      monto: d.monto ? parseFloat(d.monto) : null,
      porcentaje: totalItems > 0 ? (Number(d.total) / totalItems) * 100 : 0,
    }))
  );
});

export default router;
