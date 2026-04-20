import { Router, type IRouter } from "express";
import { db, contratacionesTable, entidadesTable, proveedoresTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
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

export default router;
