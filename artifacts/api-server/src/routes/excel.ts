import { Router, type IRouter } from "express";
import { db, contratacionesTable, entidadesTable, proveedoresTable, ubigeosTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { GetExcelPreviewQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function buildFilters(params: {
  ubigeo?: string | null;
  tipo?: string | null;
  estado?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  montoMin?: number | null;
  montoMax?: number | null;
  entidadRuc?: string | null;
}) {
  const conditions = [];
  if (params.ubigeo) conditions.push(eq(contratacionesTable.ubigeoCodigo, params.ubigeo));
  if (params.tipo) conditions.push(eq(contratacionesTable.tipo, params.tipo));
  if (params.estado) conditions.push(eq(contratacionesTable.estado, params.estado));
  if (params.fechaDesde) conditions.push(gte(contratacionesTable.fechaConvocatoria, new Date(params.fechaDesde)));
  if (params.fechaHasta) conditions.push(lte(contratacionesTable.fechaConvocatoria, new Date(params.fechaHasta)));
  if (params.montoMin != null) conditions.push(gte(sql`CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL)`, params.montoMin));
  if (params.montoMax != null) conditions.push(lte(sql`CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL)`, params.montoMax));
  if (params.entidadRuc) conditions.push(eq(contratacionesTable.entidadRuc, params.entidadRuc));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

router.get("/excel/preview", async (req, res): Promise<void> => {
  const parsed = GetExcelPreviewQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const where = buildFilters(parsed.data);

  const [result] = await db
    .select({
      totalRegistros: sql<number>`COUNT(*)`,
      montoTotal: sql<string>`SUM(CAST(${contratacionesTable.montoAdjudicado} AS DECIMAL))`,
      entidadesUnicas: sql<number>`COUNT(DISTINCT ${contratacionesTable.entidadRuc})`,
      proveedoresUnicos: sql<number>`COUNT(DISTINCT ${contratacionesTable.proveedorRuc})`,
    })
    .from(contratacionesTable)
    .where(where);

  res.json({
    totalRegistros: Number(result?.totalRegistros ?? 0),
    montoTotal: result?.montoTotal ? parseFloat(result.montoTotal) : null,
    entidadesUnicas: Number(result?.entidadesUnicas ?? 0),
    proveedoresUnicos: Number(result?.proveedoresUnicos ?? 0),
  });
});

router.post("/excel/generate", async (req, res): Promise<void> => {
  try {
    const { ubigeo, tipo, estado, fechaDesde, fechaHasta, montoMin, montoMax, entidadRuc } = req.body as Record<string, string | number | null>;

    const params = {
      ubigeo: ubigeo as string | null,
      tipo: tipo as string | null,
      estado: estado as string | null,
      fechaDesde: fechaDesde as string | null,
      fechaHasta: fechaHasta as string | null,
      montoMin: montoMin != null ? Number(montoMin) : null,
      montoMax: montoMax != null ? Number(montoMax) : null,
      entidadRuc: entidadRuc as string | null,
    };

    const where = buildFilters(params);

    const rows = await db
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
        distrito: ubigeosTable.distrito,
        provincia: ubigeosTable.provincia,
        montoReferencial: contratacionesTable.montoReferencial,
        montoAdjudicado: contratacionesTable.montoAdjudicado,
        moneda: contratacionesTable.moneda,
        fechaConvocatoria: contratacionesTable.fechaConvocatoria,
        fechaAdjudicacion: contratacionesTable.fechaAdjudicacion,
        fechaContrato: contratacionesTable.fechaContrato,
        plazoEjecucionDias: contratacionesTable.plazoEjecucionDias,
      })
      .from(contratacionesTable)
      .leftJoin(entidadesTable, eq(contratacionesTable.entidadRuc, entidadesTable.ruc))
      .leftJoin(proveedoresTable, eq(contratacionesTable.proveedorRuc, proveedoresTable.ruc))
      .leftJoin(ubigeosTable, eq(contratacionesTable.ubigeoCodigo, ubigeosTable.codigo))
      .where(where)
      .orderBy(desc(contratacionesTable.fechaConvocatoria))
      .limit(5000);

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.default.Workbook();
    workbook.creator = "Vecino Vigilante Chanchamayo";
    workbook.created = new Date();

    const PRIMARY_COLOR = "C8102E";
    const ACCENT_COLOR = "1B365D";
    const LIGHT_BG = "FAFAF7";
    const HEADER_STYLE: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ACCENT_COLOR}` } } as ExcelJS.FillPattern,
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      border: {
        top: { style: "thin" }, left: { style: "thin" },
        bottom: { style: "thin" }, right: { style: "thin" },
      },
    };

    const porEntidad = new Map<string, { nombre: string; total: number; monto: number }>();
    const porProveedor = new Map<string, { nombre: string; total: number; monto: number }>();
    const porMes = new Map<string, { total: number; monto: number }>();
    const porDistrito = new Map<string, { nombre: string; total: number; monto: number }>();

    for (const row of rows) {
      const monto = row.montoAdjudicado ? parseFloat(row.montoAdjudicado) : 0;
      if (row.entidadRuc) {
        const existing = porEntidad.get(row.entidadRuc) ?? { nombre: row.entidadNombre ?? "", total: 0, monto: 0 };
        porEntidad.set(row.entidadRuc, { ...existing, total: existing.total + 1, monto: existing.monto + monto });
      }
      if (row.proveedorRuc) {
        const existing = porProveedor.get(row.proveedorRuc) ?? { nombre: row.proveedorNombre ?? "", total: 0, monto: 0 };
        porProveedor.set(row.proveedorRuc, { ...existing, total: existing.total + 1, monto: existing.monto + monto });
      }
      if (row.fechaConvocatoria) {
        const periodo = row.fechaConvocatoria.toISOString().slice(0, 7);
        const existing = porMes.get(periodo) ?? { total: 0, monto: 0 };
        porMes.set(periodo, { total: existing.total + 1, monto: existing.monto + monto });
      }
      if (row.distrito) {
        const existing = porDistrito.get(row.distrito) ?? { nombre: row.distrito, total: 0, monto: 0 };
        porDistrito.set(row.distrito, { ...existing, total: existing.total + 1, monto: existing.monto + monto });
      }
    }

    const totalMonto = rows.reduce((acc, r) => acc + (r.montoAdjudicado ? parseFloat(r.montoAdjudicado) : 0), 0);
    const promedioMonto = rows.length > 0 ? totalMonto / rows.length : 0;

    const sheet1 = workbook.addWorksheet("Resumen Ejecutivo");
    sheet1.mergeCells("A1:F1");
    const titleCell = sheet1.getCell("A1");
    titleCell.value = "VECINO VIGILANTE CHANCHAMAYO";
    titleCell.font = { bold: true, size: 18, color: { argb: `FF${PRIMARY_COLOR}` } };
    titleCell.alignment = { horizontal: "center" };
    sheet1.mergeCells("A2:F2");
    sheet1.getCell("A2").value = "Reporte de Contrataciones Públicas — Datos OSCE/SEACE";
    sheet1.getCell("A2").alignment = { horizontal: "center" };
    sheet1.getCell("A2").font = { size: 12, color: { argb: `FF${ACCENT_COLOR}` } };
    sheet1.addRow([]);
    sheet1.addRow(["Generado el:", new Date().toLocaleDateString("es-PE")]);
    sheet1.addRow(["Filtros aplicados:", `${params.fechaDesde ?? "Todo"} → ${params.fechaHasta ?? "Todo"}`]);
    sheet1.addRow([]);
    const kpiHeaders = sheet1.addRow(["KPI", "Valor"]);
    kpiHeaders.eachCell((cell) => { Object.assign(cell, HEADER_STYLE); });
    sheet1.addRow(["Total Contrataciones", rows.length]);
    sheet1.addRow(["Monto Total Adjudicado", `S/ ${totalMonto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`]);
    sheet1.addRow(["Monto Promedio", `S/ ${promedioMonto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`]);
    sheet1.addRow(["Entidades Únicas", porEntidad.size]);
    sheet1.addRow(["Proveedores Únicos", porProveedor.size]);
    sheet1.columns = [{ width: 30 }, { width: 25 }];
    sheet1.getRow(1).height = 30;

    const sheet2 = workbook.addWorksheet("Contrataciones");
    const headers2 = ["OCID", "Nomenclatura", "Fecha Convocatoria", "Fecha Adjudicación", "Entidad RUC", "Entidad", "Distrito", "Provincia", "Título", "Tipo", "Procedimiento", "Estado", "Proveedor RUC", "Proveedor", "Monto Referencial S/", "Monto Adjudicado S/", "Moneda", "Plazo (días)"];
    const headerRow2 = sheet2.addRow(headers2);
    headerRow2.eachCell((cell) => { Object.assign(cell, HEADER_STYLE); });
    sheet2.views = [{ state: "frozen", ySplit: 1 }];

    for (const row of rows) {
      const dataRow = sheet2.addRow([
        row.ocid,
        row.nomenclatura ?? "",
        row.fechaConvocatoria ? row.fechaConvocatoria.toLocaleDateString("es-PE") : "",
        row.fechaAdjudicacion ? row.fechaAdjudicacion.toLocaleDateString("es-PE") : "",
        row.entidadRuc ?? "",
        row.entidadNombre ?? "",
        row.distrito ?? "",
        row.provincia ?? "",
        row.titulo,
        row.tipo ?? "",
        row.procedimiento ?? "",
        row.estado ?? "",
        row.proveedorRuc ?? "",
        row.proveedorNombre ?? "",
        row.montoReferencial ? parseFloat(row.montoReferencial) : null,
        row.montoAdjudicado ? parseFloat(row.montoAdjudicado) : null,
        row.moneda ?? "PEN",
        row.plazoEjecucionDias ?? "",
      ]);
      if (dataRow.number % 2 === 0) {
        dataRow.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${LIGHT_BG}` } } as ExcelJS.FillPattern;
        });
      }
    }

    const colWidths2 = [30, 18, 16, 16, 14, 35, 18, 18, 50, 12, 15, 15, 14, 35, 18, 18, 8, 12];
    colWidths2.forEach((w, i) => { sheet2.getColumn(i + 1).width = w; });

    const sheet3 = workbook.addWorksheet("Por Entidad");
    const headerRow3 = sheet3.addRow(["Entidad", "N° Contrataciones", "Monto Total S/", "Monto Promedio S/", "% del Total"]);
    headerRow3.eachCell((cell) => { Object.assign(cell, HEADER_STYLE); });
    sheet3.views = [{ state: "frozen", ySplit: 1 }];
    const sortedEntidades = [...porEntidad.entries()].sort((a, b) => b[1].monto - a[1].monto);
    for (const [, v] of sortedEntidades) {
      sheet3.addRow([v.nombre, v.total, v.monto, v.total > 0 ? v.monto / v.total : 0, totalMonto > 0 ? (v.monto / totalMonto) * 100 : 0]);
    }
    [50, 18, 18, 18, 12].forEach((w, i) => { sheet3.getColumn(i + 1).width = w; });

    const sheet4 = workbook.addWorksheet("Por Proveedor");
    const headerRow4 = sheet4.addRow(["Proveedor", "RUC", "N° Adjudicaciones", "Monto Total S/"]);
    headerRow4.eachCell((cell) => { Object.assign(cell, HEADER_STYLE); });
    sheet4.views = [{ state: "frozen", ySplit: 1 }];
    const sortedProveedores = [...porProveedor.entries()].sort((a, b) => b[1].monto - a[1].monto);
    for (const [ruc, v] of sortedProveedores) {
      sheet4.addRow([v.nombre, ruc, v.total, v.monto]);
    }
    [50, 14, 18, 18].forEach((w, i) => { sheet4.getColumn(i + 1).width = w; });

    const sheet5 = workbook.addWorksheet("Por Mes");
    const headerRow5 = sheet5.addRow(["Mes-Año", "N° Contrataciones", "Monto Total S/"]);
    headerRow5.eachCell((cell) => { Object.assign(cell, HEADER_STYLE); });
    sheet5.views = [{ state: "frozen", ySplit: 1 }];
    const sortedMeses = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [mes, v] of sortedMeses) {
      sheet5.addRow([mes, v.total, v.monto]);
    }
    [16, 18, 18].forEach((w, i) => { sheet5.getColumn(i + 1).width = w; });

    const sheet6 = workbook.addWorksheet("Por Distrito");
    const headerRow6 = sheet6.addRow(["Distrito", "N° Contrataciones", "Monto Total S/"]);
    headerRow6.eachCell((cell) => { Object.assign(cell, HEADER_STYLE); });
    sheet6.views = [{ state: "frozen", ySplit: 1 }];
    const sortedDistritos = [...porDistrito.entries()].sort((a, b) => b[1].monto - a[1].monto);
    for (const [, v] of sortedDistritos) {
      sheet6.addRow([v.nombre, v.total, v.monto]);
    }
    [30, 18, 18].forEach((w, i) => { sheet6.getColumn(i + 1).width = w; });

    const desde = params.fechaDesde?.replace(/-/g, "") ?? "todo";
    const hasta = params.fechaHasta?.replace(/-/g, "") ?? "hoy";
    const ambito = params.ubigeo ?? "junin";
    const filename = `contrataciones_${ambito}_${desde}_${hasta}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
  } catch (err) {
    req.log.error({ err }, "Error generating Excel");
    res.status(500).json({ error: "Error al generar el archivo Excel" });
  }
});

export default router;
