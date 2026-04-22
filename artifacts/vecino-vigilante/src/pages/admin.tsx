import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload, CheckCircle, AlertCircle, Loader2, Info,
  FolderOpen, FileArchive, X, Calendar, ChevronDown, ChevronUp,
  RefreshCw, Trash2, CloudDownload,
} from "lucide-react";
import { useGetStats } from "@workspace/api-client-react";
import { apiUrl } from "@/lib/api";

// @ts-ignore
import JSZip from "jszip";

const CHUNK_SIZE = 50;
const OCID_KEY = "Open Contracting ID";
const ARCHIVOS_NECESARIOS = [
  "registros.csv", "ent_partesinvolucradas.csv", "ent_adjudicaciones.csv",
  "ent_contratos.csv", "ent_adj_articulosadjudicados.csv", "ent_ordenes.csv", "ent_observaciones.csv",
];
const MESES_ES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ── CSV parser ───────────────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  function parseLine(line: string): string[] {
    const result: string[] = []; let current = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuotes) { inQuotes = true; }
      else if (ch === '"' && inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else if (ch === '"' && inQuotes) { inQuotes = false; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ""; }
      else { current += ch; }
    }
    result.push(current); return result;
  }
  const headers = parseLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h.trim()] = (values[i] ?? "").trim(); });
    return obj;
  });
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

type UploadState = "idle" | "loading" | "success" | "error";
type AutoState = "idle" | "loading" | "success" | "error";
type ResetState = "idle" | "confirm" | "loading" | "done" | "error";

interface SyncResult {
  chanchamayoEncontrados: number; procesados: number; nuevos: number;
  actualizados: number; errores: number; articulosImportados?: number;
  ordenesImportadas?: number; observacionesImportadas?: number; periodo?: string | null;
}
interface ArchivosDetectados {
  registros: boolean; partes: boolean; adjudicaciones: boolean;
  contratos: boolean; articulos: boolean; ordenes: boolean; observaciones: boolean;
}
interface PeriodoImportado {
  id: string; fechaEjecucion: string; anio: number | null; mes: number | null;
  nombreArchivo: string | null; registrosProcesados: number | null;
  registrosNuevos: number | null; registrosActualizados: number | null; estado: string | null;
}

export default function Admin() {
  const { data: stats, refetch } = useGetStats();
  const secret = import.meta.env.VITE_SYNC_SECRET ?? "";

  // ── Estado carga manual ──────────────────────────────────────────
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [archivosDetectados, setArchivosDetectados] = useState<ArchivosDetectados | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const zipRef = useRef<HTMLInputElement>(null);
  const csvMultiRef = useRef<HTMLInputElement>(null);

  // ── Estado auto-import ───────────────────────────────────────────
  const [autoState, setAutoState] = useState<AutoState>("idle");
  const [autoResult, setAutoResult] = useState<SyncResult & { yaExistia?: boolean } | null>(null);
  const [autoError, setAutoError] = useState("");
  const [autoAnio, setAutoAnio] = useState(() => { const d = new Date(); return d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear(); });
  const [autoMes, setAutoMes] = useState(() => { const d = new Date(); return d.getMonth() === 0 ? 12 : d.getMonth(); });
  const [forzar, setForzar] = useState(false);

  // ── Estado reset ─────────────────────────────────────────────────
  const [resetState, setResetState] = useState<ResetState>("idle");
  const [resetError, setResetError] = useState("");

  // ── Historial ────────────────────────────────────────────────────
  const [periodos, setPeriodos] = useState<PeriodoImportado[]>([]);
  const [loadingPeriodos, setLoadingPeriodos] = useState(false);
  const [showPeriodos, setShowPeriodos] = useState(true);

  useEffect(() => { cargarHistorial(); }, []);

  async function cargarHistorial() {
    setLoadingPeriodos(true);
    try {
      const res = await fetch(apiUrl("/api/sync/history"));
      if (res.ok) { const data = await res.json(); setPeriodos(data.periodos ?? []); }
    } catch { /* silencioso */ } finally { setLoadingPeriodos(false); }
  }

  // ── Auto-import ──────────────────────────────────────────────────
  async function handleAutoImport() {
    setAutoState("loading"); setAutoResult(null); setAutoError("");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["x-sync-secret"] = secret;
    try {
      const res = await fetch(apiUrl("/api/sync/auto"), {
        method: "POST", headers,
        body: JSON.stringify({ anio: autoAnio, mes: autoMes, forzar }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(JSON.parse(text)?.error ?? text);
      const data = JSON.parse(text);
      setAutoResult(data);
      setAutoState("success");
      refetch(); cargarHistorial();
    } catch (err) { setAutoError(String(err)); setAutoState("error"); }
  }

  // ── Reset ────────────────────────────────────────────────────────
  async function handleReset() {
    setResetState("loading"); setResetError("");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["x-sync-secret"] = secret;
    try {
      const res = await fetch(apiUrl("/api/sync/reset"), {
        method: "POST", headers,
        body: JSON.stringify({ confirmar: "BORRAR_TODO" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      setResetState("done");
      setPeriodos([]);
      refetch();
    } catch (err) { setResetError(String(err)); setResetState("error"); }
  }

  // ── Carga manual ─────────────────────────────────────────────────
  async function leerZip(file: File): Promise<Map<string, Record<string, string>[]>> {
    setProgress("Descomprimiendo ZIP...");
    const zip = await JSZip.loadAsync(file);
    const resultado = new Map<string, Record<string, string>[]>();
    const entradas = Object.keys(zip.files).filter(n => ARCHIVOS_NECESARIOS.includes(n.split("/").pop()?.toLowerCase() ?? ""));
    for (let i = 0; i < entradas.length; i++) {
      const entrada = entradas[i]; const base = entrada.split("/").pop()?.toLowerCase() ?? "";
      setProgress(`Leyendo ${entrada.split("/").pop()} (${i+1}/${entradas.length})...`);
      setProgressPct(Math.round(((i+1)/entradas.length)*30));
      resultado.set(base, parseCSV(await zip.files[entrada].async("text")));
    }
    return resultado;
  }

  async function leerCSVsSueltos(files: FileList): Promise<Map<string, Record<string, string>[]>> {
    const resultado = new Map<string, Record<string, string>[]>();
    const arr = Array.from(files);
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i]; const base = file.name.toLowerCase();
      if (!ARCHIVOS_NECESARIOS.includes(base)) continue;
      setProgress(`Leyendo ${file.name} (${i+1}/${arr.length})...`);
      setProgressPct(Math.round(((i+1)/arr.length)*30));
      resultado.set(base, parseCSV(await file.text()));
    }
    return resultado;
  }

  function mostrarDetectados(archivos: Map<string, Record<string, string>[]>) {
    setArchivosDetectados({ registros: archivos.has("registros.csv"), partes: archivos.has("ent_partesinvolucradas.csv"), adjudicaciones: archivos.has("ent_adjudicaciones.csv"), contratos: archivos.has("ent_contratos.csv"), articulos: archivos.has("ent_adj_articulosadjudicados.csv"), ordenes: archivos.has("ent_ordenes.csv"), observaciones: archivos.has("ent_observaciones.csv") });
  }

  async function sendChunk(
    registrosChunk: Record<string, string>[], partesChunk: Record<string, string>[],
    adjChunk: Record<string, string>[], conChunk: Record<string, string>[],
    articulosChunk: Record<string, string>[], ordenesChunk: Record<string, string>[],
    observacionesChunk: Record<string, string>[], archivoNombre: string,
  ): Promise<SyncResult> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["x-sync-secret"] = secret;
    const res = await fetch(apiUrl("/api/sync/csv"), { method: "POST", headers, body: JSON.stringify({ registros: registrosChunk, partes: partesChunk, adjudicaciones: adjChunk, contratos: conChunk, articulosAdj: articulosChunk, ordenes: ordenesChunk, observaciones: observacionesChunk, nombreArchivo: archivoNombre }) });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text || "(respuesta vacía)"}`);
    if (!text.trim()) throw new Error("El servidor no respondió.");
    return JSON.parse(text) as SyncResult;
  }

  async function procesarArchivos(archivos: Map<string, Record<string, string>[]>, archivoNombre: string) {
    const registros = archivos.get("registros.csv") ?? [];
    const partes = archivos.get("ent_partesinvolucradas.csv") ?? [];
    if (!registros.length || !partes.length) throw new Error("Faltan archivos obligatorios.");

    const adjudicaciones = archivos.get("ent_adjudicaciones.csv") ?? [];
    const contratos = archivos.get("ent_contratos.csv") ?? [];
    const articulosAdj = archivos.get("ent_adj_articulosadjudicados.csv") ?? [];
    const ordenes = archivos.get("ent_ordenes.csv") ?? [];
    const observaciones = archivos.get("ent_observaciones.csv") ?? [];

    const partesIdx = new Map<string, Record<string, string>[]>();
    for (const p of partes) { const o = p[OCID_KEY]; if (!partesIdx.has(o)) partesIdx.set(o, []); partesIdx.get(o)!.push(p); }
    const adjIdx = new Map<string, Record<string, string>>();
    for (const a of adjudicaciones) adjIdx.set(a[OCID_KEY], a);
    const conIdx = new Map<string, Record<string, string>>();
    for (const c of contratos) conIdx.set(c[OCID_KEY], c);
    const artIdx = new Map<string, Record<string, string>[]>();
    for (const art of articulosAdj) { const o = art[OCID_KEY]; if (!artIdx.has(o)) artIdx.set(o, []); artIdx.get(o)!.push(art); }
    const ordenesIdx = new Map<string, Record<string, string>[]>();
    for (const ord of ordenes) { const o = ord[OCID_KEY]; if (!ordenesIdx.has(o)) ordenesIdx.set(o, []); ordenesIdx.get(o)!.push(ord); }
    const obsIdx = new Map<string, Record<string, string>[]>();
    for (const obs of observaciones) { const o = obs[OCID_KEY]; if (!obsIdx.has(o)) obsIdx.set(o, []); obsIdx.get(o)!.push(obs); }

    const chunks = chunkArray(registros, CHUNK_SIZE);
    const totals: SyncResult = { chanchamayoEncontrados: 0, procesados: 0, nuevos: 0, actualizados: 0, errores: 0, articulosImportados: 0, ordenesImportadas: 0, observacionesImportadas: 0 };

    for (let i = 0; i < chunks.length; i++) {
      setProgress(`Enviando lote ${i+1} de ${chunks.length}...`);
      setProgressPct(30 + Math.round(((i+1)/chunks.length)*70));
      const ids = new Set(chunks[i].map(r => r[OCID_KEY]));
      const data = await sendChunk(chunks[i], [...ids].flatMap(id => partesIdx.get(id)??[]), [...ids].flatMap(id => adjIdx.has(id)?[adjIdx.get(id)!]:[]), [...ids].flatMap(id => conIdx.has(id)?[conIdx.get(id)!]:[]), [...ids].flatMap(id => artIdx.get(id)??[]), [...ids].flatMap(id => ordenesIdx.get(id)??[]), [...ids].flatMap(id => obsIdx.get(id)??[]), archivoNombre);
      totals.chanchamayoEncontrados = Math.max(totals.chanchamayoEncontrados, data.chanchamayoEncontrados);
      totals.procesados += data.procesados; totals.nuevos += data.nuevos; totals.actualizados += data.actualizados; totals.errores += data.errores;
      totals.articulosImportados! += data.articulosImportados ?? 0; totals.ordenesImportadas! += data.ordenesImportadas ?? 0; totals.observacionesImportadas! += data.observacionesImportadas ?? 0;
      if (data.periodo) totals.periodo = data.periodo;
    }
    return totals;
  }

  async function handleZip() {
    const file = zipRef.current?.files?.[0]; if (!file) return;
    setState("loading"); setErrorMsg(""); setResult(null); setProgressPct(0); setNombreArchivo(file.name);
    try { const archivos = await leerZip(file); mostrarDetectados(archivos); setResult(await procesarArchivos(archivos, file.name)); setState("success"); refetch(); cargarHistorial(); }
    catch (err) { setErrorMsg(String(err)); setState("error"); } finally { setProgress(""); }
  }

  async function handleCSVsSueltos() {
    const files = csvMultiRef.current?.files; if (!files?.length) return;
    setState("loading"); setErrorMsg(""); setResult(null); setProgressPct(0); setNombreArchivo(`${files.length} archivo(s)`);
    try { const archivos = await leerCSVsSueltos(files); mostrarDetectados(archivos); setResult(await procesarArchivos(archivos, Array.from(files).map(f=>f.name).join(", "))); setState("success"); refetch(); cargarHistorial(); }
    catch (err) { setErrorMsg(String(err)); setState("error"); } finally { setProgress(""); }
  }

  function reset() {
    setState("idle"); setResult(null); setErrorMsg(""); setArchivosDetectados(null); setNombreArchivo(""); setProgressPct(0);
    if (zipRef.current) zipRef.current.value = "";
    if (csvMultiRef.current) csvMultiRef.current.value = "";
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-accent">Panel de Administración</h1>
        <p className="text-muted-foreground mt-2">Carga datos del OECE para Chanchamayo</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[{ label: "Contrataciones", value: stats?.totalContrataciones ?? "—" }, { label: "Entidades", value: stats?.entidadesActivas ?? "—" }, { label: "Proveedores", value: stats?.proveedoresUnicos ?? "—" }].map(({ label, value }) => (
          <Card key={label}><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-accent">{value}</p><p className="text-sm text-muted-foreground">{label}</p></CardContent></Card>
        ))}
      </div>

      {/* ── AUTO-IMPORT ─────────────────────────────────────────────── */}
      <Card className="mb-6 border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CloudDownload className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Importación automática desde OECE</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Descarga e importa directamente el ZIP oficial del portal de Contrataciones Abiertas del OECE. El servidor hace la descarga, no tu navegador.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Año:</label>
              <select
                className="border rounded px-2 py-1.5 text-sm bg-background"
                value={autoAnio}
                onChange={e => setAutoAnio(parseInt(e.target.value))}
                disabled={autoState === "loading"}
              >
                {[2023, 2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Mes:</label>
              <select
                className="border rounded px-2 py-1.5 text-sm bg-background"
                value={autoMes}
                onChange={e => setAutoMes(parseInt(e.target.value))}
                disabled={autoState === "loading"}
              >
                {MESES_ES.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={forzar} onChange={e => setForzar(e.target.checked)} disabled={autoState === "loading"} />
              Re-importar si ya existe
            </label>
          </div>

          <Button
            onClick={handleAutoImport}
            disabled={autoState === "loading"}
            className="w-full"
          >
            {autoState === "loading"
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Descargando e importando...</>
              : <><CloudDownload className="h-4 w-4 mr-2" />Importar {MESES_ES[autoMes]} {autoAnio}</>}
          </Button>

          {autoState === "success" && autoResult && (
            <div className={`rounded-lg p-3 text-sm ${autoResult.yaExistia ? "bg-blue-50 border border-blue-200 text-blue-800" : "bg-green-50 border border-green-200 text-green-800"}`}>
              {autoResult.yaExistia
                ? <><CheckCircle className="h-4 w-4 inline mr-1" />El período {autoResult.periodo} ya estaba importado. Marca "Re-importar" para forzarlo.</>
                : <><CheckCircle className="h-4 w-4 inline mr-1" /><strong>¡Completado!</strong> {autoResult.nuevos} nuevos · {autoResult.actualizados} actualizados · {autoResult.errores > 0 ? `${autoResult.errores} con errores` : "sin errores"}</>}
            </div>
          )}
          {autoState === "error" && (
            <div className="rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-800">
              <AlertCircle className="h-4 w-4 inline mr-1" />{autoError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── HISTORIAL ───────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowPeriodos(!showPeriodos)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Períodos importados</CardTitle>
              {periodos.length > 0 && <Badge variant="secondary" className="text-xs">{periodos.length}</Badge>}
            </div>
            {showPeriodos ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        {showPeriodos && (
          <CardContent className="pt-0">
            {loadingPeriodos
              ? <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="h-4 w-4 animate-spin" />Cargando historial...</div>
              : periodos.length === 0
                ? <p className="text-sm text-muted-foreground py-2 text-center">Aún no se ha importado ningún período.</p>
                : <div className="space-y-2">
                    {(() => {
                      const porAnio: Record<number, PeriodoImportado[]> = {};
                      for (const p of periodos) { const a = p.anio ?? 0; if (!porAnio[a]) porAnio[a] = []; porAnio[a].push(p); }
                      return Object.entries(porAnio).sort(([a],[b])=>Number(b)-Number(a)).map(([anio, items]) => (
                        <div key={anio}>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{anio === "0" ? "Período desconocido" : anio}</p>
                          <div className="flex flex-wrap gap-2">
                            {items.map(item => (
                              <div key={item.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${item.estado==="OK" ? "bg-green-50 border-green-200 text-green-800" : "bg-yellow-50 border-yellow-200 text-yellow-800"}`} title={`${item.nombreArchivo??""}\nProcesados: ${item.registrosProcesados??0} | Nuevos: ${item.registrosNuevos??0} | Actualizados: ${item.registrosActualizados??0}`}>
                                {item.estado==="OK" ? <CheckCircle className="h-3 w-3 shrink-0" /> : <AlertCircle className="h-3 w-3 shrink-0" />}
                                {item.mes ? MESES_ES[item.mes] : "Sin fecha"}
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                    <p className="text-xs text-muted-foreground pt-1">Verde = sin errores · Amarillo = parcial</p>
                  </div>}
          </CardContent>
        )}
      </Card>

      {/* ── INSTRUCCIONES CARGA MANUAL ───────────────────────────────── */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 space-y-3">
              <div>
                <p className="font-semibold mb-1">Carga manual (alternativa):</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ve a <a href="https://contratacionesabiertas.oece.gob.pe/descargas" target="_blank" rel="noreferrer" className="underline font-medium">contratacionesabiertas.oece.gob.pe/descargas</a></li>
                  <li>Descarga el ZIP del mes — formato <strong>CSV (ES)</strong></li>
                  <li>Sube el ZIP sin descomprimir, o los CSV sueltos</li>
                </ol>
              </div>
              <div className="border-t border-blue-200 pt-2 text-xs text-blue-700">
                <strong>Archivos reconocidos:</strong> Registros.csv · Partes involucradas · Adjudicaciones · Contratos · Artículos adj. · Órdenes · Observaciones
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── CARGA MANUAL ────────────────────────────────────────────── */}
      {state === "idle" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card className="border-2 border-dashed hover:border-primary transition-colors">
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center"><FileArchive className="h-7 w-7 text-primary" /></div>
              <div><p className="font-semibold text-lg">Subir ZIP</p><p className="text-sm text-muted-foreground mt-1">El archivo ZIP completo del OECE.</p></div>
              <label className="w-full cursor-pointer">
                <input ref={zipRef} type="file" accept=".zip" className="hidden" onChange={handleZip} />
                <div className="w-full bg-primary text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"><Upload className="h-4 w-4" />Seleccionar ZIP</div>
              </label>
            </CardContent>
          </Card>
          <Card className="border-2 border-dashed hover:border-primary transition-colors">
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center"><FolderOpen className="h-7 w-7 text-accent" /></div>
              <div><p className="font-semibold text-lg">Subir CSVs sueltos</p><p className="text-sm text-muted-foreground mt-1">Todos los CSV descomprimidos.</p></div>
              <label className="w-full cursor-pointer">
                <input ref={csvMultiRef} type="file" accept=".csv" multiple className="hidden" onChange={handleCSVsSueltos} />
                <div className="w-full bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"><Upload className="h-4 w-4" />Seleccionar CSVs</div>
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {state === "loading" && (
        <Card className="mb-8">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
              <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{nombreArchivo}</p><p className="text-sm text-muted-foreground">{progress || "Procesando..."}</p></div>
            </div>
            <Progress value={progressPct} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{progressPct}%</p>
            {archivosDetectados && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">Archivos detectados:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[{ key: "registros", label: "Registros.csv", req: true }, { key: "partes", label: "Partes involucradas", req: true }, { key: "adjudicaciones", label: "Adjudicaciones", req: false }, { key: "contratos", label: "Contratos", req: false }, { key: "articulos", label: "Artículos adj.", req: false }, { key: "ordenes", label: "Órdenes", req: false }, { key: "observaciones", label: "Observaciones", req: false }].map(({ key, label, req }) => {
                    const found = archivosDetectados[key as keyof ArchivosDetectados];
                    return <div key={key} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${found ? "bg-green-50 text-green-700" : req ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground"}`}>{found ? <CheckCircle className="h-3 w-3 shrink-0" /> : req ? <AlertCircle className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-40" />}{label}</div>;
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {state === "success" && result && (
        <Card className="border-green-200 mb-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-lg">¡Carga exitosa!</p>
                <p className="text-sm text-green-700">{nombreArchivo}</p>
                {result.periodo && <p className="text-xs text-green-600 mt-0.5 font-medium">Período: {(() => { const [a,m] = result.periodo!.split("-"); return `${MESES_ES[parseInt(m)]} ${a}`; })()}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[{ label: "Chanchamayo encontrados", value: result.chanchamayoEncontrados }, { label: "Registros procesados", value: result.procesados }, { label: "Nuevos", value: result.nuevos }, { label: "Actualizados", value: result.actualizados }, ...(result.articulosImportados ? [{ label: "Artículos importados", value: result.articulosImportados }] : []), ...(result.ordenesImportadas ? [{ label: "Órdenes importadas", value: result.ordenesImportadas }] : []), ...(result.observacionesImportadas ? [{ label: "Observaciones importadas", value: result.observacionesImportadas }] : []), ...(result.errores > 0 ? [{ label: "Con errores", value: result.errores }] : [])].map(({ label, value }) => (
                <div key={label} className={`rounded-lg p-3 text-center ${label==="Con errores" ? "bg-yellow-50" : "bg-green-50"}`}>
                  <p className={`text-2xl font-bold ${label==="Con errores" ? "text-yellow-800" : "text-green-800"}`}>{value}</p>
                  <p className={`text-xs mt-0.5 ${label==="Con errores" ? "text-yellow-600" : "text-green-600"}`}>{label}</p>
                </div>
              ))}
            </div>
            {result.errores > 0 && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800"><strong>Nota:</strong> Los {result.errores} registros con error fueron omitidos. Suele ocurrir por RUCs inválidos en el archivo fuente.</div>}
            <Button onClick={reset} variant="outline" className="w-full">Cargar otro mes</Button>
          </CardContent>
        </Card>
      )}

      {state === "error" && (
        <Card className="border-red-200 mb-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 shrink-0" />
              <div><p className="font-semibold text-red-800">Error al procesar</p><p className="text-sm text-red-600 mt-1">{errorMsg}</p></div>
            </div>
            <Button onClick={reset} variant="outline" className="w-full">Intentar de nuevo</Button>
          </CardContent>
        </Card>
      )}

      {/* ── ZONA DE PELIGRO: RESET ───────────────────────────────────── */}
      <Card className="border-red-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            <CardTitle className="text-base text-red-700">Zona de peligro — Reset de datos</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {resetState === "idle" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Borra <strong>todos</strong> los datos importados (contrataciones, entidades, proveedores, artículos y el historial de importaciones). Las tablas quedan vacías y listas para volver a importar. Los distritos/ubigeos se mantienen.</p>
              <Button variant="destructive" className="w-full" onClick={() => setResetState("confirm")}>
                <Trash2 className="h-4 w-4 mr-2" />Borrar todos los datos importados
              </Button>
            </div>
          )}

          {resetState === "confirm" && (
            <div className="space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-semibold text-red-800">⚠️ ¿Estás seguro? Esta acción no se puede deshacer.</p>
              <p className="text-xs text-red-700">Se borrarán todas las contrataciones, entidades, proveedores, artículos adjudicados y el historial de importaciones. Tendrás que volver a importar todo desde cero.</p>
              <div className="flex gap-2">
                <Button variant="destructive" className="flex-1" onClick={handleReset}>Sí, borrar todo</Button>
                <Button variant="outline" className="flex-1" onClick={() => setResetState("idle")}>Cancelar</Button>
              </div>
            </div>
          )}

          {resetState === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />Borrando datos...
            </div>
          )}

          {resetState === "done" && (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                <CheckCircle className="h-4 w-4 inline mr-1" />Reset completado. Todos los datos fueron eliminados. Las tablas están vacías y listas.
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setResetState("idle"); refetch(); }}>
                <RefreshCw className="h-4 w-4 mr-2" />Listo
              </Button>
            </div>
          )}

          {resetState === "error" && (
            <div className="space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />{resetError}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setResetState("idle")}>Cerrar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
