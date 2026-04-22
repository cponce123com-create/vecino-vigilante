import { Router, type IRouter } from "express";
import {
  db,
  contratacionesTable,
  entidadesTable,
  proveedoresTable,
  articulosAdjudicadosTable,
  syncLogTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import https from "https";
import http from "http";
import { createWriteStream, unlinkSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────
function isChanchamayo(region: string): boolean {
  return region.toUpperCase().includes("CHANCHAMAYO");
}
function mapProcedimiento(method: string): string {
  const m = method.toUpperCase();
  if (m.includes("LICITACION")) return "LP";
  if (m.includes("ADJUDICACION SIMPLIFICADA")) return "AS";
  if (m.includes("SUBASTA")) return "SM";
  if (m.includes("CONCURSO")) return "CP";
  if (m.includes("DIRECTA")) return "CD";
  if (m.includes("COMPARACION")) return "CE";
  return method.slice(0, 10) || "AS";
}
function mapTipo(cat: string): string {
  const m: Record<string, string> = {
    goods: "BIENES", services: "SERVICIOS", works: "OBRAS", consultingServices: "CONSULTORIA",
  };
  return m[cat] ?? "SERVICIOS";
}
function safeDecimal(v: string | undefined | null): string | null {
  if (!v) return null;
  const f = parseFloat(v);
  return isNaN(f) || f <= 0 ? null : String(f);
}
function safeDate(v: string | undefined | null): Date | null {
  if (!v) return null;
  try {
    const d = new Date(v.trim().slice(0, 19));
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}
function safeRuc(v: string | undefined | null): string | null {
  if (!v) return null;
  const clean = v.replace(/\D/g, "");
  if (clean.length < 8 || clean.length > 11) return null;
  return clean;
}

const CHANCHAMAYO_MAP: Record<string, string> = {
  "CHANCHAMAYO": "120301", "PERENE": "120302", "PICHANAQUI": "120303",
  "SAN LUIS DE SHUARO": "120304", "SAN RAMON": "120305", "VITOC": "120306",
};

// ── CSV parser ────────────────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  if (lines.length < 2) return [];
  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuotes) { inQuotes = true; }
      else if (ch === '"' && inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"' && inQuotes) { inQuotes = false; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ""; }
      else { current += ch; }
    }
    result.push(current);
    return result;
  }
  const headers = parseLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h.trim()] = (values[i] ?? "").trim(); });
    return obj;
  });
}

// ── Descarga un ZIP desde una URL a un archivo temporal ───────────────
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const protocol = url.startsWith("https") ? https : http;
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        downloadFile(response.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${response.statusCode} al descargar ${url}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    });
    request.on("error", (err) => { file.close(); reject(err); });
    request.setTimeout(120000, () => { request.destroy(); reject(new Error("Timeout descargando ZIP")); });
  });
}

// ── Lógica central de importación (compartida por upload y auto-import) ──
async function importarDesdeCsvs(
  csvMap: Map<string, Record<string, string>[]>,
  nombreArchivo: string,
): Promise<{
  chanchamayoEncontrados: number; procesados: number; nuevos: number;
  actualizados: number; errores: number; articulosImportados: number;
  ordenesImportadas: number; observacionesImportadas: number; periodo: string | null;
}> {
  const OCID_KEY = "Open Contracting ID";
  const registros = csvMap.get("registros.csv") ?? [];
  const partes = csvMap.get("ent_partesinvolucradas.csv") ?? [];
  const adjudicaciones = csvMap.get("ent_adjudicaciones.csv") ?? [];
  const contratos = csvMap.get("ent_contratos.csv") ?? [];
  const articulosAdj = csvMap.get("ent_adj_articulosadjudicados.csv") ?? [];
  const ordenes = csvMap.get("ent_ordenes.csv") ?? [];
  const observaciones = csvMap.get("ent_observaciones.csv") ?? [];

  if (!registros.length || !partes.length) {
    throw new Error("Faltan archivos obligatorios: registros.csv y ent_partesinvolucradas.csv");
  }

  const chanchamayoOcids = new Set<string>();
  const entidadMap: Record<string, { ruc: string; nombre: string; distrito: string }> = {};
  const proveedorMap: Record<string, { ruc: string; nombre: string }> = {};

  for (const p of partes) {
    const region = p["Entrega compilada:Partes involucradas:Dirección:Región"] ?? "";
    const roles = p["Entrega compilada:Partes involucradas:Roles de las partes"] ?? "";
    const ocid = p[OCID_KEY];
    const ruc = safeRuc(p["Entrega compilada:Partes involucradas:Identificador principal:ID"]);
    const nombre = p["Entrega compilada:Partes involucradas:Nombre común"]?.trim();
    const distrito = p["Entrega compilada:Partes involucradas:Dirección:Localidad"]?.trim() || "";
    if (isChanchamayo(region)) chanchamayoOcids.add(ocid);
    if (roles.includes("buyer") && ruc) entidadMap[ocid] = { ruc, nombre: nombre || ruc, distrito };
    if (roles.includes("supplier") && ruc && !proveedorMap[ocid]) proveedorMap[ocid] = { ruc, nombre: nombre || ruc };
  }

  const adjMap: Record<string, { monto: string; fecha: string }> = {};
  for (const a of adjudicaciones) {
    const ocid = a[OCID_KEY];
    adjMap[ocid] = { monto: a["Entrega compilada:Adjudicaciones:Valor:Monto"] ?? "", fecha: a["Entrega compilada:Adjudicaciones:Fecha de adjudicación"] ?? "" };
  }
  const conMap: Record<string, { fecha: string; plazo: string }> = {};
  for (const c of contratos) {
    const ocid = c[OCID_KEY];
    conMap[ocid] = { fecha: c["Entrega compilada:Contratos:Fecha de firma"] ?? "", plazo: c["Entrega compilada:Contratos:Periodo:Duración (días)"] ?? "" };
  }
  const observacionesMap: Record<string, number> = {};
  for (const obs of observaciones) {
    const ocid = obs[OCID_KEY];
    if (ocid) observacionesMap[ocid] = (observacionesMap[ocid] ?? 0) + 1;
  }

  const chanRegs = registros.filter(r => chanchamayoOcids.has(r[OCID_KEY]));
  let nuevos = 0, actualizados = 0, errores = 0;
  const erroresList: Array<{ ocid: string; mensaje: string }> = [];
  const seenEntidades = new Set<string>();
  const seenProveedores = new Set<string>();
  const procesadosOcids = new Set<string>();

  for (const reg of chanRegs) {
    const ocid = reg[OCID_KEY];
    try {
      const entidad = entidadMap[ocid];
      const proveedor = proveedorMap[ocid];
      const adj = adjMap[ocid] ?? {};
      const con = conMap[ocid] ?? {};
      const titulo = reg["Entrega compilada:Licitación:Título de la licitación"]?.trim().slice(0, 500) || ocid;
      const descripcion = reg["Entrega compilada:Licitación:Descripción de la licitación"]?.trim().slice(0, 2000) || null;
      const tipo = mapTipo(reg["Entrega compilada:Licitación:Categoría principal de contratación"] ?? "");
      const procedimiento = mapProcedimiento(reg["Entrega compilada:Licitación:Detalles del método de contratación"] ?? "");
      const montoRef = safeDecimal(reg["Entrega compilada:Licitación:Valor:Monto"]);
      const montoAdj = safeDecimal(adj.monto);
      const fechaConv = safeDate(reg["Entrega compilada:Licitación:Periodo de licitación:Fecha de inicio"]);
      const fechaAdj = safeDate(adj.fecha);
      const fechaCon = safeDate(con.fecha);
      let plazo: number | null = null;
      try { plazo = con.plazo ? Math.round(parseFloat(con.plazo)) : null; } catch { plazo = null; }
      const ubigeoCodigo = entidad?.distrito ? (CHANCHAMAYO_MAP[entidad.distrito.toUpperCase()] || null) : null;

      if (entidad && !seenEntidades.has(entidad.ruc)) {
        seenEntidades.add(entidad.ruc);
        await db.insert(entidadesTable).values({ ruc: entidad.ruc, nombre: entidad.nombre.slice(0, 500), tipo: "MUNICIPALIDAD", nivelGobierno: "LOCAL", ubigeoCodigo }).onConflictDoUpdate({ target: [entidadesTable.ruc], set: { ubigeoCodigo } });
      }
      if (proveedor && !seenProveedores.has(proveedor.ruc)) {
        seenProveedores.add(proveedor.ruc);
        await db.insert(proveedoresTable).values({ ruc: proveedor.ruc, razonSocial: proveedor.nombre.slice(0, 500), ubigeoCodigo: null, vigenteRnp: null }).onConflictDoNothing();
      }

      const existing = await db.select({ ocid: contratacionesTable.ocid }).from(contratacionesTable).where(eq(contratacionesTable.ocid, ocid)).limit(1);
      let estadoReal = "CONVOCADO";
      if (fechaCon) estadoReal = "CONTRATADO";
      else if (fechaAdj) estadoReal = "ADJUDICADO";
      const obsCount = observacionesMap[ocid] ?? 0;

      if (existing.length === 0) {
        await db.insert(contratacionesTable).values({ ocid, titulo: titulo.slice(0, 500), descripcion, tipo, procedimiento, estado: estadoReal, entidadRuc: entidad?.ruc ?? null, proveedorRuc: proveedor?.ruc ?? null, ubigeoCodigo, montoReferencial: montoRef, montoAdjudicado: montoAdj, moneda: "PEN", fechaConvocatoria: fechaConv, fechaAdjudicacion: fechaAdj, fechaContrato: fechaCon, plazoEjecucionDias: plazo, observacionesCount: obsCount, rawOcds: reg as Record<string, unknown> });
        nuevos++;
      } else {
        await db.update(contratacionesTable).set({ estado: estadoReal, ubigeoCodigo, montoAdjudicado: montoAdj, ...(fechaConv ? { fechaConvocatoria: fechaConv } : {}), fechaAdjudicacion: fechaAdj, fechaContrato: fechaCon, proveedorRuc: proveedor?.ruc ?? null, ...(obsCount > 0 ? { observacionesCount: obsCount } : {}) }).where(eq(contratacionesTable.ocid, ocid));
        actualizados++;
      }
      procesadosOcids.add(ocid);
    } catch (err) {
      console.error(`Error procesando ${ocid}:`, err);
      errores++;
      erroresList.push({ ocid, mensaje: String(err).slice(0, 200) });
    }
  }

  // Artículos
  let articulosImportados = 0;
  for (const art of articulosAdj) {
    const ocid = art[OCID_KEY];
    if (!procesadosOcids.has(ocid)) continue;
    const id = art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:ID"];
    if (!id) continue;
    try {
      await db.insert(articulosAdjudicadosTable).values({ id, ocid, posicion: art["compiledRelease/awards/0/items/0/position"] ? parseInt(art["compiledRelease/awards/0/items/0/position"]) : null, descripcion: (art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:Descripción"] || "Sin descripción").slice(0, 500), clasificacionId: art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:Clasificación:ID"] || null, clasificacionDesc: (art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:Clasificación:Descripción"] || null)?.slice(0, 500), cantidad: art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:Cantidad"] || null, unidadNombre: art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:Unidad:Nombre"] || null, montoTotal: art["compiledRelease/awards/0/items/0/totalValue/amount"] || null, moneda: art["compiledRelease/awards/0/items/0/totalValue/currency"] || "PEN", estado: art["compiledRelease/awards/0/items/0/statusDetails"] || null }).onConflictDoNothing();
      articulosImportados++;
    } catch (err) { console.error(`Error artículo ${id}:`, err); }
  }

  // Órdenes
  let ordenesImportadas = 0;
  for (const ord of ordenes) {
    const ocid = ord[OCID_KEY];
    if (!procesadosOcids.has(ocid)) continue;
    try {
      const fechaOrden = safeDate(ord["Entrega compilada:Contratos:Fecha de firma"] ?? ord["Entrega compilada:Implementación:Transacciones:Fecha"]);
      const montoOrden = safeDecimal(ord["Entrega compilada:Implementación:Transacciones:Valor:Monto"] ?? ord["Entrega compilada:Contratos:Valor:Monto"]);
      if (fechaOrden || montoOrden) {
        await db.update(contratacionesTable).set({ ...(fechaOrden && !conMap[ocid]?.fecha ? { fechaContrato: fechaOrden } : {}), ...(montoOrden ? { montoAdjudicado: montoOrden } : {}), estado: "CONTRATADO" }).where(eq(contratacionesTable.ocid, ocid));
      }
      ordenesImportadas++;
    } catch (err) { console.error(`Error orden ${ocid}:`, err); }
  }

  const observacionesImportadas = Object.values(observacionesMap).reduce((s, v) => s + v, 0);

  // Inferir período
  let anioImportado: number | null = null;
  let mesImportado: number | null = null;
  const match = nombreArchivo.match(/(\d{4})[_-](\d{2})/);
  if (match) { anioImportado = parseInt(match[1]); mesImportado = parseInt(match[2]); }
  if (!anioImportado) {
    for (const reg of chanRegs) {
      const f = safeDate(reg["Entrega compilada:Licitación:Periodo de licitación:Fecha de inicio"]);
      if (f) { anioImportado = f.getFullYear(); mesImportado = f.getMonth() + 1; break; }
    }
  }

  await db.insert(syncLogTable).values({
    id: randomUUID(), anio: anioImportado, mes: mesImportado,
    nombreArchivo: nombreArchivo.slice(0, 200),
    registrosProcesados: chanRegs.length, registrosNuevos: nuevos,
    registrosActualizados: actualizados,
    errores: erroresList.length > 0 ? erroresList.slice(0, 20) : null,
    estado: errores === 0 ? "OK" : "PARCIAL",
  });

  const periodo = anioImportado ? `${anioImportado}-${String(mesImportado).padStart(2, "0")}` : null;
  return { chanchamayoEncontrados: chanchamayoOcids.size, procesados: chanRegs.length, nuevos, actualizados, errores, articulosImportados, ordenesImportadas, observacionesImportadas, periodo };
}

// ── POST /api/sync/csv  (carga manual desde el panel) ─────────────────
router.post("/sync/csv", async (req, res): Promise<void> => {
  const secret = process.env.SYNC_SECRET;
  if (secret && req.headers["x-sync-secret"] !== secret) { res.status(401).json({ error: "No autorizado" }); return; }
  try {
    const { registros, partes, adjudicaciones, contratos, articulosAdj, ordenes, observaciones, nombreArchivo } = req.body as {
      registros: Record<string, string>[]; partes: Record<string, string>[];
      adjudicaciones: Record<string, string>[]; contratos: Record<string, string>[];
      articulosAdj?: Record<string, string>[]; ordenes?: Record<string, string>[];
      observaciones?: Record<string, string>[]; nombreArchivo?: string;
    };
    if (!registros?.length || !partes?.length) { res.status(400).json({ error: "Se requieren los arrays: registros, partes" }); return; }

    const csvMap = new Map<string, Record<string, string>[]>([
      ["registros.csv", registros],
      ["ent_partesinvolucradas.csv", partes],
      ["ent_adjudicaciones.csv", adjudicaciones ?? []],
      ["ent_contratos.csv", contratos ?? []],
      ["ent_adj_articulosadjudicados.csv", articulosAdj ?? []],
      ["ent_ordenes.csv", ordenes ?? []],
      ["ent_observaciones.csv", observaciones ?? []],
    ]);

    const result = await importarDesdeCsvs(csvMap, nombreArchivo ?? "manual");
    res.json({ message: "Carga completada", ...result });
  } catch (err) {
    console.error("CSV upload error:", err);
    res.status(500).json({ error: "Error procesando CSV", message: String(err) });
  }
});

// ── POST /api/sync/auto  (importación automática desde OECE) ──────────
// Descarga el ZIP del mes indicado (o el mes anterior si no se especifica),
// lo descomprime en memoria y lo importa igual que la carga manual.
router.post("/sync/auto", async (req, res): Promise<void> => {
  const secret = process.env.SYNC_SECRET;
  if (secret && req.headers["x-sync-secret"] !== secret) { res.status(401).json({ error: "No autorizado" }); return; }

  try {
    // Determinar el año/mes a importar: por defecto el mes anterior al actual
    const ahora = new Date();
    let { anio, mes } = req.body as { anio?: number; mes?: number };
    if (!anio || !mes) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
      anio = d.getFullYear();
      mes = d.getMonth() + 1;
    }
    const mesStr = String(mes).padStart(2, "0");
    const nombreArchivo = `${anio}-${mesStr}_seace_v3_csv_es.zip`;

    // Verificar si ya fue importado
    const yaImportado = await db.select({ id: syncLogTable.id })
      .from(syncLogTable)
      .where(sql`${syncLogTable.anio} = ${anio} AND ${syncLogTable.mes} = ${mes} AND ${syncLogTable.estado} = 'OK'`)
      .limit(1);

    if (yaImportado.length > 0 && !req.body.forzar) {
      res.json({ message: `El período ${anio}-${mesStr} ya fue importado.`, yaExistia: true, periodo: `${anio}-${mesStr}` });
      return;
    }

    // URL del ZIP en el portal OECE
    const url = `https://contratacionesabiertas.oece.gob.pe/downloads/${nombreArchivo}`;
    console.log(`[auto-sync] Descargando ${url}`);

    // Descargar a archivo temporal
    const tmpPath = join(tmpdir(), `oece_${Date.now()}_${nombreArchivo}`);
    try {
      await downloadFile(url, tmpPath);
    } catch (err) {
      res.status(404).json({ error: `No se pudo descargar ${nombreArchivo}. El OECE aún no ha publicado ese mes, o la URL cambió.`, detalle: String(err) });
      return;
    }

    // Extraer ZIP usando el comando `unzip` del sistema (disponible en Linux/Render)
    console.log(`[auto-sync] Descomprimiendo ${tmpPath}`);
    const extractDir = `${tmpPath}_extracted`;
    mkdirSync(extractDir, { recursive: true });

    await new Promise<void>((resolve, reject) => {
      execFile("unzip", ["-o", tmpPath, "-d", extractDir], (err, stdout, stderr) => {
        if (err) { reject(new Error(`unzip falló: ${stderr || err.message}`)); return; }
        resolve();
      });
    });

    // Limpiar ZIP temporal
    try { unlinkSync(tmpPath); } catch { /* ignorar */ }

    const ARCHIVOS_NECESARIOS = ["registros.csv", "ent_partesinvolucradas.csv", "ent_adjudicaciones.csv", "ent_contratos.csv", "ent_adj_articulosadjudicados.csv", "ent_ordenes.csv", "ent_observaciones.csv"];
    const csvMap = new Map<string, Record<string, string>[]>();

    // Buscar los CSV recursivamente dentro del directorio extraído
    const { execSync } = await import("child_process");
    const findOutput = execSync(`find "${extractDir}" -type f -iname "*.csv"`, { encoding: "utf8" });
    const csvFiles = findOutput.trim().split("\n").filter(Boolean);

    for (const filePath of csvFiles) {
      const base = filePath.split("/").pop()?.toLowerCase() ?? "";
      if (ARCHIVOS_NECESARIOS.includes(base)) {
        const texto = readFileSync(filePath, "utf8");
        csvMap.set(base, parseCSV(texto));
        console.log(`[auto-sync] Leído ${base}: ${csvMap.get(base)!.length} filas`);
      }
    }

    // Limpiar directorio extraído
    try { rmSync(extractDir, { recursive: true, force: true }); } catch { /* ignorar */ }

    // Importar
    console.log(`[auto-sync] Importando datos para ${anio}-${mesStr}`);
    const result = await importarDesdeCsvs(csvMap, nombreArchivo);
    console.log(`[auto-sync] Completado:`, result);

    res.json({ message: `Importación automática completada para ${anio}-${mesStr}`, ...result });
  } catch (err) {
    console.error("auto-sync error:", err);
    res.status(500).json({ error: "Error en importación automática", message: String(err) });
  }
});

// ── POST /api/sync/reset  (borrar todos los datos, mantener tablas) ───
router.post("/sync/reset", async (req, res): Promise<void> => {
  const secret = process.env.SYNC_SECRET;
  if (secret && req.headers["x-sync-secret"] !== secret) { res.status(401).json({ error: "No autorizado" }); return; }

  // Doble confirmación requerida
  if (req.body?.confirmar !== "BORRAR_TODO") {
    res.status(400).json({ error: "Debes enviar { confirmar: 'BORRAR_TODO' } en el body para confirmar el reset." });
    return;
  }

  try {
    // Borrar en orden correcto respetando FK: primero las tablas hijas
    await db.delete(articulosAdjudicadosTable);
    await db.delete(contratacionesTable);
    await db.delete(proveedoresTable);
    // Las entidades tienen FK a ubigeos, no borramos ubigeos (son datos maestros)
    await db.delete(entidadesTable);
    await db.delete(syncLogTable);

    console.log("[reset] Todos los datos eliminados correctamente.");
    res.json({
      message: "Reset completado. Todas las tablas vaciadas. Los ubigeos (distritos) se mantuvieron.",
      tablasBorradas: ["articulos_adjudicados", "contrataciones", "proveedores", "entidades", "sync_log"],
    });
  } catch (err) {
    console.error("reset error:", err);
    res.status(500).json({ error: "Error durante el reset", message: String(err) });
  }
});

// ── GET /api/sync/status ─────────────────────────────────────────────
router.get("/sync/status", async (_req, res): Promise<void> => {
  const lastSync = await db.select().from(syncLogTable).orderBy(desc(syncLogTable.fechaEjecucion)).limit(1);
  res.json({ ultimaEjecucion: lastSync[0] ?? null });
});

// ── GET /api/sync/history ─────────────────────────────────────────────
router.get("/sync/history", async (_req, res): Promise<void> => {
  try {
    const logs = await db.select({
      id: syncLogTable.id, fechaEjecucion: syncLogTable.fechaEjecucion,
      anio: syncLogTable.anio, mes: syncLogTable.mes,
      nombreArchivo: syncLogTable.nombreArchivo,
      registrosProcesados: syncLogTable.registrosProcesados,
      registrosNuevos: syncLogTable.registrosNuevos,
      registrosActualizados: syncLogTable.registrosActualizados,
      estado: syncLogTable.estado,
    }).from(syncLogTable).orderBy(desc(syncLogTable.fechaEjecucion));

    const porPeriodo: Record<string, typeof logs[0]> = {};
    for (const log of logs) {
      const key = log.anio && log.mes ? `${log.anio}-${String(log.mes).padStart(2, "0")}` : log.id;
      if (!porPeriodo[key]) porPeriodo[key] = log;
    }
    const periodos = Object.values(porPeriodo).sort((a, b) => {
      if (a.anio && b.anio && a.anio !== b.anio) return b.anio - a.anio;
      if (a.mes && b.mes) return b.mes - a.mes;
      return 0;
    });
    res.json({ periodos, total: periodos.length });
  } catch (err) {
    console.error("sync/history error:", err);
    res.status(500).json({ error: "Error obteniendo historial", message: String(err) });
  }
});

export default router;
