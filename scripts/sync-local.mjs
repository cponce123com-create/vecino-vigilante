#!/usr/bin/env node
/**
 * sync-local.mjs — Sincronización local desde Perú
 * ──────────────────────────────────────────────────
 * Ejecutar desde una máquina con IP peruana (o VPN Peru) ya que la API
 * OCDS bloquea conexiones desde el extranjero.
 *
 * Uso:
 *   node scripts/sync-local.mjs [--url http://localhost:3001] [--mes 2024-03]
 *
 * Dependencias: Node.js 18+, acceso a la API OCDS desde Peru
 */

import { createWriteStream, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Configuración ──────────────────────────────────────────────────────────
const OCDS_BASE = "https://contratacionesabiertas.oece.gob.pe";
const DEFAULT_APP_URL = "http://localhost:3001";
const TMP_DIR = join(__dirname, "..", ".tmp-sync");

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const APP_URL = getArg("--url") ?? DEFAULT_APP_URL;
const MES = getArg("--mes"); // ej: 2024-03 (si null, descarga el más reciente)

// ── Helpers ────────────────────────────────────────────────────────────────
function log(msg, level = "INFO") {
  const ts = new Date().toLocaleTimeString("es-PE", { hour12: false });
  console.log(`[${ts}] ${level.padEnd(4)} ${msg}`);
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "VecinoVigilante-Sync/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

async function downloadFile(url, destPath) {
  const res = await fetch(url, {
    headers: { "User-Agent": "VecinoVigilante-Sync/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} descargando ${url}`);
  const writer = createWriteStream(destPath);
  await pipeline(res.body, writer);
  return destPath;
}

// ── Obtener URL de descarga del ZIP más reciente ───────────────────────────
async function obtenerUrlDescarga() {
  log("Consultando descargas disponibles en OECE...");
  try {
    // Intentar endpoint de descargas
    const data = await fetchJSON(`${OCDS_BASE}/api/descargas`);
    const items = Array.isArray(data) ? data : data.results ?? data.data ?? [];

    if (MES) {
      const item = items.find((d) => d.periodo === MES || d.mes === MES || String(d.fecha ?? "").startsWith(MES));
      if (!item) throw new Error(`No se encontró descarga para el mes ${MES}. Disponibles: ${items.map((i) => i.periodo ?? i.mes ?? i.fecha).join(", ")}`);
      return item.url ?? item.enlace ?? item.archivo;
    }
    // El más reciente
    const ultimo = items[0];
    if (!ultimo) throw new Error("No se encontraron descargas disponibles");
    log(`Descarga más reciente: ${ultimo.periodo ?? ultimo.mes ?? ultimo.fecha}`);
    return ultimo.url ?? ultimo.enlace ?? ultimo.archivo;
  } catch (err) {
    // Si falla el API, intentar URL directa del portal de descargas
    log(`No se pudo consultar la API de descargas: ${err.message}`, "WARN");
    log("Usa --url-zip para especificar la URL directa del ZIP.");
    throw err;
  }
}

// ── Subir ZIP al servidor de Vecino Vigilante ──────────────────────────────
async function subirZip(zipPath) {
  log(`Subiendo ZIP al servidor: ${APP_URL}/api/sync ...`);
  const { default: FormData } = await import("node:buffer").then(() =>
    import("node:stream").then(() => ({ default: FormData }))
  ).catch(() => ({ default: global.FormData }));

  const form = new FormData();
  const { readFileSync } = await import("fs");
  const zipBytes = readFileSync(zipPath);
  const blob = new Blob([zipBytes], { type: "application/zip" });
  form.append("file", blob, "datos-ocds.zip");

  const res = await fetch(`${APP_URL}/api/sync`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Error al subir ZIP (HTTP ${res.status}): ${texto.slice(0, 300)}`);
  }

  return res.json();
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Vecino Vigilante — Sincronización Local     ║");
  console.log("║  Requiere IP peruana (OCDS bloquea extranjeros) ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  log(`Servidor destino: ${APP_URL}`);
  if (MES) log(`Mes solicitado: ${MES}`);

  // Verificar conexión al servidor
  try {
    const ping = await fetch(`${APP_URL}/api/stats`);
    if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
    log("Conexión al servidor OK");
  } catch (err) {
    log(`No se puede conectar al servidor ${APP_URL}: ${err.message}`, "ERROR");
    log("Asegúrate de que el servidor esté corriendo con: pnpm --filter @workspace/api-server run dev", "ERROR");
    process.exit(1);
  }

  // Crear carpeta temporal
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

  // Verificar si el usuario pasó --zip-path directamente
  const zipPathOverride = getArg("--zip-path");

  let zipPath;
  if (zipPathOverride) {
    if (!existsSync(zipPathOverride)) {
      log(`El archivo ZIP no existe: ${zipPathOverride}`, "ERROR");
      process.exit(1);
    }
    zipPath = zipPathOverride;
    log(`Usando ZIP local: ${zipPath}`);
  } else {
    // Descargar desde OCDS
    log("Verificando acceso a la API OCDS (requiere IP peruana)...");
    let zipUrl;
    try {
      zipUrl = await obtenerUrlDescarga();
    } catch (err) {
      log(`Error obteniendo URL de descarga: ${err.message}`, "ERROR");
      log("\nAlternativa manual:", "INFO");
      log("  1. Descarga el ZIP desde: https://contratacionesabiertas.oece.gob.pe/descargas", "INFO");
      log(`  2. Ejecuta: node scripts/sync-local.mjs --zip-path /ruta/al/archivo.zip --url ${APP_URL}`, "INFO");
      process.exit(1);
    }

    const nombreArchivo = `ocds-${MES ?? "reciente"}-${Date.now()}.zip`;
    zipPath = join(TMP_DIR, nombreArchivo);
    log(`Descargando ZIP a: ${zipPath}`);
    await downloadFile(zipUrl, zipPath);
    log("ZIP descargado correctamente");
  }

  // Subir al servidor
  const resultado = await subirZip(zipPath);

  console.log("\n✅ Sincronización completada:\n");
  console.log(`   Chanchamayo encontrados : ${resultado.chanchamayoEncontrados ?? "—"}`);
  console.log(`   Registros procesados    : ${resultado.procesados ?? "—"}`);
  console.log(`   Nuevos                  : ${resultado.nuevos ?? "—"}`);
  console.log(`   Actualizados            : ${resultado.actualizados ?? "—"}`);
  if (resultado.articulosImportados) console.log(`   Artículos importados    : ${resultado.articulosImportados}`);
  if (resultado.ordenesImportadas) console.log(`   Órdenes importadas      : ${resultado.ordenesImportadas}`);
  if (resultado.observacionesImportadas) console.log(`   Observaciones           : ${resultado.observacionesImportadas}`);
  if (resultado.errores > 0) console.log(`   ⚠ Con errores           : ${resultado.errores}`);
  console.log("");
}

main().catch((err) => {
  log(`Error fatal: ${err.message}`, "ERROR");
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
