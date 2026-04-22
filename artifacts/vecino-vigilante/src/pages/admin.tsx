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

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g,"\n").replace(/\r/g,"\n").trim().split("\n");
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

type ResetState = "idle" | "confirm" | "loading" | "done" | "error";

interface SyncResult {
  chanchamayoEncontrados: number; procesados: number; nuevos: number;
  actualizados: number; errores: number; articulosImportados?: number;
  ordenesImportadas?: number; observacionesImportadas?: number; periodo?: string | null;
}

// Resultado por ZIP en la multicarga
interface ZipResult {
  nombre: string;
  estado: "pendiente" | "procesando" | "ok" | "error";
  resultado?: SyncResult;
  error?: string;
}

interface PeriodoImportado {
  id: string; fechaEjecucion: string; anio: number | null; mes: number | null;
  nombreArchivo: string | null; registrosProcesados: number | null;
  registrosNuevos: number | null; registrosActualizados: number | null; estado: string | null;
}

export default function Admin() {
  const { data: stats, refetch } = useGetStats();
  const secret = import.meta.env.VITE_SYNC_SECRET ?? "";

  // ── Multicarga de ZIPs ───────────────────────────────────────────
  const [cargando, setCargando] = useState(false);
  const [zipResults, setZipResults] = useState<ZipResult[]>([]);
  const [progreso, setProgreso] = useState("");
  const [progresoPct, setProgresoPct] = useState(0);
  const [reindexResult, setReindexResult] = useState<{ contratacionesActualizadas: number; entidadesActualizadas: number } | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);
  const zipMultiRef = useRef<HTMLInputElement>(null);
  const csvMultiRef = useRef<HTMLInputElement>(null);

  // ── Estado auto-import ───────────────────────────────────────────
  const [autoState, setAutoState] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [autoResult, setAutoResult] = useState<SyncResult & { yaExistia?: boolean } | null>(null);
  const [autoError, setAutoError] = useState("");
  const [autoAnio, setAutoAnio] = useState(() => { const d = new Date(); return d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear(); });
  const [autoMes, setAutoMes] = useState(() => { const d = new Date(); return d.getMonth() === 0 ? 12 : d.getMonth(); });
  const [forzar, setForzar] = useState(false);

  // ── Reset ────────────────────────────────────────────────────────
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

  // ── Leer un ZIP y extraer CSVs ───────────────────────────────────
  async function leerZip(file: File): Promise<Map<string, Record<string, string>[]>> {
    const zip = await JSZip.loadAsync(file);
    const resultado = new Map<string, Record<string, string>[]>();
    const entradas = Object.keys(zip.files).filter(n => ARCHIVOS_NECESARIOS.includes(n.split("/").pop()?.toLowerCase() ?? ""));
    for (const entrada of entradas) {
      const base = entrada.split("/").pop()?.toLowerCase() ?? "";
      const texto = await zip.files[entrada].async("text");
      resultado.set(base, parseCSV(texto));
    }
    return resultado;
  }

  async function leerCSVsSueltos(files: FileList): Promise<Map<string, Record<string, string>[]>> {
    const resultado = new Map<string, Record<string, string>[]>();
    for (const file of Array.from(files)) {
      const base = file.name.toLowerCase();
      if (ARCHIVOS_NECESARIOS.includes(base)) resultado.set(base, parseCSV(await file.text()));
    }
    return resultado;
  }

  // ── Enviar un lote al servidor ───────────────────────────────────
  async function sendChunk(
    registrosChunk: Record<string, string>[], partesChunk: Record<string, string>[],
    adjChunk: Record<string, string>[], conChunk: Record<string, string>[],
    articulosChunk: Record<string, string>[], ordenesChunk: Record<string, string>[],
    observacionesChunk: Record<string, string>[], archivoNombre: string,
  ): Promise<SyncResult> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["x-sync-secret"] = secret;
    const res = await fetch(apiUrl("/api/sync/csv"), {
      method: "POST", headers,
      body: JSON.stringify({ registros: registrosChunk, partes: partesChunk, adjudicaciones: adjChunk, contratos: conChunk, articulosAdj: articulosChunk, ordenes: ordenesChunk, observaciones: observacionesChunk, nombreArchivo: archivoNombre }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text || "(vacío)"}`);
    if (!text.trim()) throw new Error("Servidor sin respuesta");
    return JSON.parse(text) as SyncResult;
  }

  // ── Procesar un mapa de CSVs ─────────────────────────────────────
  async function procesarCsvs(
    archivos: Map<string, Record<string, string>[]>,
    archivoNombre: string,
    onProgreso: (msg: string, pct: number) => void,
  ): Promise<SyncResult> {
    const registros    = archivos.get("registros.csv") ?? [];
    const partes       = archivos.get("ent_partesinvolucradas.csv") ?? [];
    const adjudicaciones = archivos.get("ent_adjudicaciones.csv") ?? [];
    const contratos    = archivos.get("ent_contratos.csv") ?? [];
    const articulosAdj = archivos.get("ent_adj_articulosadjudicados.csv") ?? [];
    const ordenes      = archivos.get("ent_ordenes.csv") ?? [];
    const observaciones = archivos.get("ent_observaciones.csv") ?? [];

    if (!registros.length || !partes.length) throw new Error("Faltan archivos obligatorios (registros / partes)");

    const partesIdx = new Map<string, Record<string, string>[]>();
    for (const p of partes) { const o = p[OCID_KEY]; if (!partesIdx.has(o)) partesIdx.set(o,[]); partesIdx.get(o)!.push(p); }
    const adjIdx = new Map<string, Record<string, string>>(); for (const a of adjudicaciones) adjIdx.set(a[OCID_KEY], a);
    const conIdx = new Map<string, Record<string, string>>(); for (const c of contratos) conIdx.set(c[OCID_KEY], c);
    const artIdx = new Map<string, Record<string, string>[]>();
    for (const a of articulosAdj) { const o=a[OCID_KEY]; if(!artIdx.has(o)) artIdx.set(o,[]); artIdx.get(o)!.push(a); }
    const ordIdx = new Map<string, Record<string, string>[]>();
    for (const o of ordenes) { const id=o[OCID_KEY]; if(!ordIdx.has(id)) ordIdx.set(id,[]); ordIdx.get(id)!.push(o); }
    const obsIdx = new Map<string, Record<string, string>[]>();
    for (const o of observaciones) { const id=o[OCID_KEY]; if(!obsIdx.has(id)) obsIdx.set(id,[]); obsIdx.get(id)!.push(o); }

    const chunks = chunkArray(registros, CHUNK_SIZE);
    const totals: SyncResult = { chanchamayoEncontrados:0, procesados:0, nuevos:0, actualizados:0, errores:0, articulosImportados:0, ordenesImportadas:0, observacionesImportadas:0 };

    for (let i = 0; i < chunks.length; i++) {
      onProgreso(`Lote ${i+1}/${chunks.length}`, Math.round(((i+1)/chunks.length)*100));
      const ids = new Set(chunks[i].map(r => r[OCID_KEY]));
      const data = await sendChunk(
        chunks[i],
        [...ids].flatMap(id => partesIdx.get(id)??[]),
        [...ids].flatMap(id => adjIdx.has(id)?[adjIdx.get(id)!]:[]),
        [...ids].flatMap(id => conIdx.has(id)?[conIdx.get(id)!]:[]),
        [...ids].flatMap(id => artIdx.get(id)??[]),
        [...ids].flatMap(id => ordIdx.get(id)??[]),
        [...ids].flatMap(id => obsIdx.get(id)??[]),
        archivoNombre,
      );
      totals.chanchamayoEncontrados = Math.max(totals.chanchamayoEncontrados, data.chanchamayoEncontrados);
      totals.procesados += data.procesados; totals.nuevos += data.nuevos;
      totals.actualizados += data.actualizados; totals.errores += data.errores;
      totals.articulosImportados! += data.articulosImportados ?? 0;
      totals.ordenesImportadas! += data.ordenesImportadas ?? 0;
      totals.observacionesImportadas! += data.observacionesImportadas ?? 0;
      if (data.periodo) totals.periodo = data.periodo;
    }
    return totals;
  }

  // ── Procesar múltiples ZIPs en secuencia ─────────────────────────
  async function handleMultiZip() {
    const files = zipMultiRef.current?.files;
    if (!files?.length) return;

    // Ordenar los archivos por nombre (cronológicamente: 2025-01, 2025-02, ...)
    const sorted = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
    const inicial: ZipResult[] = sorted.map(f => ({ nombre: f.name, estado: "pendiente" }));
    setZipResults(inicial);
    setCargando(true);
    setProgresoPct(0);

    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i];

      // Marcar como procesando
      setZipResults(prev => prev.map((r, idx) => idx === i ? { ...r, estado: "procesando" } : r));
      setProgreso(`ZIP ${i+1}/${sorted.length}: descomprimiendo ${file.name}...`);
      setProgresoPct(Math.round((i / sorted.length) * 100));

      try {
        const archivos = await leerZip(file);
        const resultado = await procesarCsvs(archivos, file.name, (msg, pct) => {
          setProgreso(`ZIP ${i+1}/${sorted.length} — ${msg}`);
          setProgresoPct(Math.round((i / sorted.length) * 100 + pct / sorted.length));
        });
        setZipResults(prev => prev.map((r, idx) => idx === i ? { ...r, estado: "ok", resultado } : r));
      } catch (err) {
        setZipResults(prev => prev.map((r, idx) => idx === i ? { ...r, estado: "error", error: String(err) } : r));
      }
    }

    setProgreso("");
    setProgresoPct(100);
    setCargando(false);
    refetch();
    cargarHistorial();
    if (zipMultiRef.current) zipMultiRef.current.value = "";
  }

  // ── Procesar CSVs sueltos (un solo mes) ──────────────────────────
  async function handleCSVsSueltos() {
    const files = csvMultiRef.current?.files;
    if (!files?.length) return;
    const nombre = `${files.length} archivos CSV`;
    setZipResults([{ nombre, estado: "procesando" }]);
    setCargando(true); setProgresoPct(0);
    try {
      const archivos = await leerCSVsSueltos(files);
      const resultado = await procesarCsvs(archivos, nombre, (msg, pct) => {
        setProgreso(msg); setProgresoPct(pct);
      });
      setZipResults([{ nombre, estado: "ok", resultado }]);
      refetch(); cargarHistorial();
    } catch (err) {
      setZipResults([{ nombre, estado: "error", error: String(err) }]);
    } finally {
      setCargando(false); setProgreso("");
      if (csvMultiRef.current) csvMultiRef.current.value = "";
    }
  }

  function resetCarga() {
    setZipResults([]); setCargando(false); setProgreso(""); setProgresoPct(0);
    if (zipMultiRef.current) zipMultiRef.current.value = "";
    if (csvMultiRef.current) csvMultiRef.current.value = "";
  }

  // ── Auto-import ──────────────────────────────────────────────────
  async function handleAutoImport() {
    setAutoState("loading"); setAutoResult(null); setAutoError("");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["x-sync-secret"] = secret;
    try {
      const res = await fetch(apiUrl("/api/sync/auto"), { method:"POST", headers, body: JSON.stringify({ anio: autoAnio, mes: autoMes, forzar }) });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAutoResult(data); setAutoState("success");
      refetch(); cargarHistorial();
    } catch (err) { setAutoError(String(err)); setAutoState("error"); }
  }

  // ── Reset ────────────────────────────────────────────────────────
  async function handleReset() {
    setResetState("loading"); setResetError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (secret) headers["x-sync-secret"] = secret;
      const res = await fetch(apiUrl("/api/sync/reset"), { method:"POST", headers, body: JSON.stringify({ confirmar:"BORRAR_TODO" }) });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
      setResetState("done"); setPeriodos([]); refetch();
    } catch (err) { setResetError(String(err)); setResetState("error"); }
  }

  async function handleReindex() {
    setIsReindexing(true);
    setReindexResult(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (secret) headers["x-sync-secret"] = secret;
      const res = await fetch(apiUrl("/api/sync/reindex"), { method: "POST", headers });
      if (!res.ok) throw new Error(`Error ${res.status} al reindexar`);
      const data = await res.json();
      setReindexResult(data);
      refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setIsReindexing(false);
    }
  }

  // ── Totales de la multicarga ─────────────────────────────────────
  const totalMulti = zipResults.reduce((acc, r) => {
    if (r.resultado) {
      acc.nuevos += r.resultado.nuevos; acc.actualizados += r.resultado.actualizados; acc.errores += r.resultado.errores;
    }
    return acc;
  }, { nuevos:0, actualizados:0, errores:0 });

  const hayResultados = zipResults.length > 0;
  const todosTerminados = hayResultados && !cargando;
  const algunoOk = zipResults.some(r => r.estado === "ok");

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-accent">Panel de Administración</h1>
        <p className="text-muted-foreground mt-2">Carga datos del OECE para Chanchamayo</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[{ label:"Contrataciones", value: stats?.totalContrataciones ?? "—" }, { label:"Entidades", value: stats?.entidadesActivas ?? "—" }, { label:"Proveedores", value: stats?.proveedoresUnicos ?? "—" }].map(({ label, value }) => (
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
          <p className="text-sm text-muted-foreground">El servidor descarga e importa directamente. Selecciona el mes y pulsa importar.</p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Año:</label>
              <select className="border rounded px-2 py-1.5 text-sm bg-background" value={autoAnio} onChange={e => setAutoAnio(parseInt(e.target.value))} disabled={autoState==="loading"}>
                {[2022,2023,2024,2025,2026].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Mes:</label>
              <select className="border rounded px-2 py-1.5 text-sm bg-background" value={autoMes} onChange={e => setAutoMes(parseInt(e.target.value))} disabled={autoState==="loading"}>
                {MESES_ES.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={forzar} onChange={e => setForzar(e.target.checked)} disabled={autoState==="loading"} />
              Re-importar si ya existe
            </label>
          </div>
          <Button onClick={handleAutoImport} disabled={autoState==="loading"} className="w-full">
            {autoState==="loading" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Descargando e importando...</> : <><CloudDownload className="h-4 w-4 mr-2"/>Importar {MESES_ES[autoMes]} {autoAnio}</>}
          </Button>
          {autoState==="success" && autoResult && (
            <div className={`rounded-lg p-3 text-sm ${autoResult.yaExistia ? "bg-blue-50 border border-blue-200 text-blue-800" : "bg-green-50 border border-green-200 text-green-800"}`}>
              {autoResult.yaExistia ? <><CheckCircle className="h-4 w-4 inline mr-1"/>Ya estaba importado. Marca "Re-importar" para forzarlo.</> : <><CheckCircle className="h-4 w-4 inline mr-1"/><strong>¡Completado!</strong> {autoResult.nuevos} nuevos · {autoResult.actualizados} actualizados{(autoResult.errores??0)>0?` · ${autoResult.errores} con errores`:""}</>}
            </div>
          )}
          {autoState==="error" && <div className="rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-800"><AlertCircle className="h-4 w-4 inline mr-1"/>{autoError}</div>}
        </CardContent>
      </Card>

      {/* ── HISTORIAL ───────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowPeriodos(!showPeriodos)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary"/>
              <CardTitle className="text-base">Períodos importados</CardTitle>
              {periodos.length > 0 && <Badge variant="secondary" className="text-xs">{periodos.length}</Badge>}
            </div>
            {showPeriodos ? <ChevronUp className="h-4 w-4 text-muted-foreground"/> : <ChevronDown className="h-4 w-4 text-muted-foreground"/>}
          </div>
        </CardHeader>
        {showPeriodos && (
          <CardContent className="pt-0">
            {loadingPeriodos
              ? <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="h-4 w-4 animate-spin"/>Cargando...</div>
              : periodos.length === 0
                ? <p className="text-sm text-muted-foreground py-2 text-center">Aún no se ha importado ningún período.</p>
                : <div className="space-y-2">
                    {(() => {
                      const porAnio: Record<number, PeriodoImportado[]> = {};
                      for (const p of periodos) { const a=p.anio??0; if(!porAnio[a]) porAnio[a]=[]; porAnio[a].push(p); }
                      return Object.entries(porAnio).sort(([a],[b])=>Number(b)-Number(a)).map(([anio,items]) => (
                        <div key={anio}>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{anio==="0"?"Período desconocido":anio}</p>
                          <div className="flex flex-wrap gap-2">
                            {items.map(item => (
                              <div key={item.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${item.estado==="OK"?"bg-green-50 border-green-200 text-green-800":"bg-yellow-50 border-yellow-200 text-yellow-800"}`} title={`${item.nombreArchivo??""}\nNuevos: ${item.registrosNuevos??0} | Actualizados: ${item.registrosActualizados??0}`}>
                                {item.estado==="OK" ? <CheckCircle className="h-3 w-3 shrink-0"/> : <AlertCircle className="h-3 w-3 shrink-0"/>}
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

      {/* ── INSTRUCCIONES ───────────────────────────────────────────── */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5"/>
            <div className="text-sm text-blue-800 space-y-2">
              <p className="font-semibold">Carga manual de ZIPs:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Ve a <a href="https://contratacionesabiertas.oece.gob.pe/descargas" target="_blank" rel="noreferrer" className="underline font-medium">contratacionesabiertas.oece.gob.pe/descargas</a></li>
                <li>Descarga los ZIPs de los meses que necesites — formato <strong>CSV (ES)</strong></li>
                <li>Selecciona <strong>todos los ZIPs a la vez</strong> — se importarán en orden cronológico automáticamente</li>
              </ol>
              <p className="text-xs text-blue-700 pt-1"><strong>Tip:</strong> Puedes seleccionar múltiples archivos con Ctrl+clic o Shift+clic en el selector de archivos.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── CARGA MANUAL ────────────────────────────────────────────── */}
      {!hayResultados && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Múltiples ZIPs */}
          <Card className="border-2 border-dashed hover:border-primary transition-colors">
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center relative">
                <FileArchive className="h-7 w-7 text-primary"/>
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">+</span>
              </div>
              <div>
                <p className="font-semibold text-lg">Subir ZIP(s)</p>
                <p className="text-sm text-muted-foreground mt-1">Uno o varios ZIPs del OECE. Se importan en orden cronológico.</p>
              </div>
              <label className="w-full cursor-pointer">
                <input ref={zipMultiRef} type="file" accept=".zip" multiple className="hidden" onChange={handleMultiZip}/>
                <div className="w-full bg-primary text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                  <Upload className="h-4 w-4"/>Seleccionar ZIP(s)
                </div>
              </label>
            </CardContent>
          </Card>

          {/* CSVs sueltos */}
          <Card className="border-2 border-dashed hover:border-primary transition-colors">
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center">
                <FolderOpen className="h-7 w-7 text-accent"/>
              </div>
              <div>
                <p className="font-semibold text-lg">Subir CSVs sueltos</p>
                <p className="text-sm text-muted-foreground mt-1">Todos los CSV de un mes descomprimidos.</p>
              </div>
              <label className="w-full cursor-pointer">
                <input ref={csvMultiRef} type="file" accept=".csv" multiple className="hidden" onChange={handleCSVsSueltos}/>
                <div className="w-full bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2">
                  <Upload className="h-4 w-4"/>Seleccionar CSVs
                </div>
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── PROGRESO Y RESULTADOS DE LA MULTICARGA ──────────────────── */}
      {hayResultados && (
        <Card className="mb-8">
          <CardContent className="p-6 space-y-4">
            {/* Barra de progreso global */}
            {cargando && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0"/>
                  <p className="text-sm text-muted-foreground truncate">{progreso || "Procesando..."}</p>
                </div>
                <Progress value={progresoPct} className="h-2"/>
              </div>
            )}

            {/* Resumen total cuando termina */}
            {todosTerminados && algunoOk && (
              <div className="grid grid-cols-3 gap-3 pb-2 border-b">
                {[{ label:"Nuevos", value: totalMulti.nuevos, color:"text-green-700" }, { label:"Actualizados", value: totalMulti.actualizados, color:"text-blue-700" }, { label:"Con errores", value: totalMulti.errores, color:"text-yellow-700" }].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Lista de ZIPs con su estado */}
            <div className="space-y-2">
              {zipResults.map((r, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg text-sm ${r.estado==="ok" ? "bg-green-50" : r.estado==="error" ? "bg-red-50" : r.estado==="procesando" ? "bg-blue-50" : "bg-muted/50"}`}>
                  <div className="shrink-0">
                    {r.estado==="pendiente"  && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30"/>}
                    {r.estado==="procesando" && <Loader2 className="h-4 w-4 animate-spin text-primary"/>}
                    {r.estado==="ok"         && <CheckCircle className="h-4 w-4 text-green-600"/>}
                    {r.estado==="error"      && <AlertCircle className="h-4 w-4 text-red-600"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.nombre}</p>
                    {r.resultado && (
                      <p className="text-xs text-muted-foreground">
                        {r.resultado.periodo && <span className="font-medium mr-2">{(() => { const [a,m] = r.resultado.periodo!.split("-"); return `${MESES_ES[parseInt(m)]} ${a}`; })()}</span>}
                        {r.resultado.nuevos} nuevos · {r.resultado.actualizados} actualizados
                        {(r.resultado.errores??0)>0 && ` · ${r.resultado.errores} con errores`}
                      </p>
                    )}
                    {r.error && <p className="text-xs text-red-600 truncate">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>

            {todosTerminados && (
              <Button onClick={resetCarga} variant="outline" className="w-full">
                <Upload className="h-4 w-4 mr-2"/>Cargar más ZIPs
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── ZONA DE PELIGRO ─────────────────────────────────────────── */}
      <Card className="border-red-200 mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600"/>
            <CardTitle className="text-base text-red-700">Zona de peligro — Reset de datos</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {resetState==="idle" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Borra <strong>todos</strong> los datos importados. Las tablas quedan vacías y listas para reimportar. Los distritos/ubigeos se mantienen.</p>
              <Button variant="destructive" className="w-full" onClick={() => setResetState("confirm")}><Trash2 className="h-4 w-4 mr-2"/>Borrar todos los datos importados</Button>
            </div>
          )}
          {resetState==="confirm" && (
            <div className="space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-semibold text-red-800">⚠️ ¿Estás seguro? Esta acción no se puede deshacer.</p>
              <p className="text-xs text-red-700">Se borrarán todas las contrataciones, entidades, proveedores, artículos y el historial de importaciones.</p>
              <div className="flex gap-2">
                <Button variant="destructive" className="flex-1" onClick={handleReset}>Sí, borrar todo</Button>
                <Button variant="outline" className="flex-1" onClick={() => setResetState("idle")}>Cancelar</Button>
              </div>
            </div>
          )}
          {resetState==="loading" && <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="h-4 w-4 animate-spin"/>Borrando datos...</div>}
          {resetState==="done" && (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800"><CheckCircle className="h-4 w-4 inline mr-1"/>Reset completado. Tablas vacías y listas.</div>
              <Button variant="outline" className="w-full" onClick={() => { setResetState("idle"); refetch(); }}><RefreshCw className="h-4 w-4 mr-2"/>Listo</Button>
            </div>
          )}
          {resetState==="error" && (
            <div className="space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"><AlertCircle className="h-4 w-4 inline mr-1"/>{resetError}</div>
              <Button variant="outline" className="w-full" onClick={() => setResetState("idle")}>Cerrar</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── REINDEXACIÓN ─────────────────────────────────────────────── */}
      <Card className="border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600"/>
            <CardTitle className="text-base text-blue-700">Mantenimiento — Reindexar ubigeos</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Si los mapas aparecen vacíos tras una importación, usa esta herramienta para intentar asignar el distrito correcto a cada contratación basándose en el nombre de la entidad.
          </p>
          <Button 
            variant="outline" 
            className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={handleReindex}
            disabled={isReindexing || cargando}
          >
            {isReindexing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Reindexando...</> : <><RefreshCw className="h-4 w-4 mr-2"/>Reindexar ubigeos ahora</>}
          </Button>

          {reindexResult && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Reindexación completada</p>
                <ul className="space-y-0.5">
                  <li>Contrataciones actualizadas: <strong>{reindexResult.contratacionesActualizadas}</strong></li>
                  <li>Entidades actualizadas: <strong>{reindexResult.entidadesActualizadas}</strong></li>
                </ul>
                <Button variant="link" size="sm" onClick={() => setReindexResult(null)} className="p-0 h-auto text-blue-600 mt-2">Cerrar aviso</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
