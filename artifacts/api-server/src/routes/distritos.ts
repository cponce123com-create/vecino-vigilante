import { Router, type IRouter } from "express";
import { db, ubigeosTable, contratacionesTable, entidadesTable, proveedoresTable } from "@workspace/db";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { GetDistritosQueryParams, GetDistritoParams } from "@workspace/api-zod";

const router: IRouter = Router();

const CURRENT_YEAR = new Date().getFullYear();
const START_OF_YEAR = new Date(`${CURRENT_YEAR}-01-01`);

router.get("/distritos", async (req, res): Promise<void> => {
  const parsed = GetDistritosQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const where = parsed.data.provincia
    ? eq(ubigeosTable.provincia, parsed.data.provincia)
    : undefined;

  const ubigeos = await db
    .select()
    .from(ubigeosTable)
    .where(where)
    .orderBy(ubigeosTable.provincia, ubigeosTable.distrito);

  const ubigeoCodigos = ubigeos.map((u) => u.codigo);

  if (ubigeoCodigos.length === 0) {
    res.json([]);
    return;
  }

  const stats = await db
    .select({
      ubigeoCodigo: contratacionesTable.ubigeoCodigo,
      totalContrataciones: sql<number>`COUNT(*)`,
      montoTotal: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
      contratacionesEsteAnio: sql<number>`COUNT(*) FILTER (WHERE ${contratacionesTable.fechaConvocatoria} >= ${START_OF_YEAR})`,
      montoEsteAnio: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL)) FILTER (WHERE ${contratacionesTable.fechaConvocatoria} >= ${START_OF_YEAR})`,
    })
    .from(contratacionesTable)
    .groupBy(contratacionesTable.ubigeoCodigo);

  const statsMap = new Map(stats.map((s) => [s.ubigeoCodigo, s]));

  const result = ubigeos.map((u) => {
    const s = statsMap.get(u.codigo);
    return {
      codigo: u.codigo,
      departamento: u.departamento,
      provincia: u.provincia,
      distrito: u.distrito,
      latitud: u.latitud != null ? parseFloat(u.latitud) : null,
      longitud: u.longitud != null ? parseFloat(u.longitud) : null,
      superficieKm2: u.superficieKm2 != null ? parseFloat(u.superficieKm2) : null,
      totalContrataciones: Number(s?.totalContrataciones ?? 0),
      montoTotal: s?.montoTotal ? parseFloat(s.montoTotal) : null,
      contratacionesEsteAnio: Number(s?.contratacionesEsteAnio ?? 0),
      montoEsteAnio: s?.montoEsteAnio ? parseFloat(s.montoEsteAnio) : null,
    };
  });

  res.json(result);
});

router.get("/distritos/:ubigeo", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.ubigeo) ? req.params.ubigeo[0] : req.params.ubigeo;
  const params = GetDistritoParams.safeParse({ ubigeo: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [ubigeo] = await db
    .select()
    .from(ubigeosTable)
    .where(eq(ubigeosTable.codigo, params.data.ubigeo))
    .limit(1);

  if (!ubigeo) {
    res.status(404).json({ error: "Distrito no encontrado" });
    return;
  }

  const where = eq(contratacionesTable.ubigeoCodigo, params.data.ubigeo);

  const [statsResult, contratacionesRecientes, topProveedoresResult, distribucionResult, evolucionResult] =
    await Promise.all([
      db
        .select({
          totalContrataciones: sql<number>`COUNT(*)`,
          montoTotal: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
          contratacionesEsteAnio: sql<number>`COUNT(*) FILTER (WHERE ${contratacionesTable.fechaConvocatoria} >= ${START_OF_YEAR})`,
          montoEsteAnio: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL)) FILTER (WHERE ${contratacionesTable.fechaConvocatoria} >= ${START_OF_YEAR})`,
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
        .orderBy(desc(contratacionesTable.fechaConvocatoria))
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
        .limit(5),
      db
        .select({
          tipo: contratacionesTable.tipo,
          total: sql<number>`COUNT(*)`,
          monto: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
        })
        .from(contratacionesTable)
        .where(where)
        .groupBy(contratacionesTable.tipo),
      db
        .select({
          mes: sql<string>`TO_CHAR(${contratacionesTable.fechaConvocatoria}, 'Mon')`,
          anio: sql<number>`EXTRACT(YEAR FROM ${contratacionesTable.fechaConvocatoria})`,
          periodo: sql<string>`TO_CHAR(${contratacionesTable.fechaConvocatoria}, 'YYYY-MM')`,
          totalContrataciones: sql<number>`COUNT(*)`,
          montoTotal: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
        })
        .from(contratacionesTable)
        .where(and(where, sql`${contratacionesTable.fechaConvocatoria} IS NOT NULL`))
        .groupBy(
          sql`TO_CHAR(${contratacionesTable.fechaConvocatoria}, 'Mon')`,
          sql`EXTRACT(YEAR FROM ${contratacionesTable.fechaConvocatoria})`,
          sql`TO_CHAR(${contratacionesTable.fechaConvocatoria}, 'YYYY-MM')`
        )
        .orderBy(sql`TO_CHAR(${contratacionesTable.fechaConvocatoria}, 'YYYY-MM')`)
        .limit(24),
    ]);

  const s = statsResult[0];
  const totalContrataciones = Number(s?.totalContrataciones ?? 0);
  const totalMonto = s?.montoTotal ? parseFloat(s.montoTotal) : null;

  res.json({
    codigo: ubigeo.codigo,
    departamento: ubigeo.departamento,
    provincia: ubigeo.provincia,
    distrito: ubigeo.distrito,
    latitud: ubigeo.latitud != null ? parseFloat(ubigeo.latitud) : null,
    longitud: ubigeo.longitud != null ? parseFloat(ubigeo.longitud) : null,
    superficieKm2: ubigeo.superficieKm2 != null ? parseFloat(ubigeo.superficieKm2) : null,
    totalContrataciones,
    montoTotal: totalMonto,
    contratacionesEsteAnio: Number(s?.contratacionesEsteAnio ?? 0),
    montoEsteAnio: s?.montoEsteAnio ? parseFloat(s.montoEsteAnio) : null,
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
    topProveedores: topProveedoresResult.map((p) => ({
      ruc: p.ruc,
      razonSocial: p.razonSocial,
      totalAdjudicaciones: Number(p.totalAdjudicaciones),
      montoTotal: p.montoTotal ? parseFloat(p.montoTotal) : null,
    })),
    distribucionTipo: (() => {
      const totalItems = distribucionResult.reduce((acc, d) => acc + Number(d.total), 0);
      return distribucionResult.map((d) => ({
        tipo: d.tipo ?? "OTROS",
        total: Number(d.total),
        monto: d.monto ? parseFloat(d.monto) : null,
        porcentaje: totalItems > 0 ? (Number(d.total) / totalItems) * 100 : 0,
      }));
    })(),
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
