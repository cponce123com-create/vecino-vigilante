import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle, Loader2, FileText, Info } from "lucide-react";
import { useGetStats } from "@workspace/api-client-react";

const CHUNK_SIZE = 200; // filas por lote (más pequeño = más seguro)

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
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

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

type UploadState = "idle" | "loading" | "success" | "error";
interface r { chanchamayoEncontrados: number; procesados: number; nuevos: number; actualizados: number; errores: number; }

export default function Admin() {
  const { data: stats, refetch } = useGetStats();
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<r | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState("");
  const registrosRef = useRef<HTMLInputElement>(null);
  const partesRef = useRef<HTMLInputElement>(null);
  const adjRef = useRef<HTMLInputElement>(null);
  const conRef = useRef<HTMLInputElement>(null);
  const secret = import.meta.env.VITE_SYNC_SECRET ?? "";

  async function readFile(file: File): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => { try { resolve(parseCSV(e.target?.result as string)); } catch (err) { reject(err); } };
      reader.onerror = () => reject(new Error("Error leyendo archivo"));
      reader.readAsText(file, "utf-8");
    });
  }

  async function sendChunk(
    registrosChunk: Record<string, string>[],
    partes: Record<string, string>[],
    adjudicaciones: Record<string, string>[],
    contratos: Record<string, string>[],
  ): Promise<r> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["x-sync-secret"] = secret;

    const res = await fetch("/api/sync/csv", {
      method: "POST",
      headers,
      body: JSON.stringify({ registros: registrosChunk, partes, adjudicaciones, contratos }),
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text || "(respuesta vacía)"}`);
    }

    if (!text || text.trim() === "") {
      throw new Error(`El servidor devolvió una respuesta vacía (lote ${CHUNK_SIZE} filas)`);
    }

    try {
      return JSON.parse(text) as r;
    } catch {
      throw new Error(`Respuesta inválida del servidor: ${text.slice(0, 200)}`);
    }
  }

  async function handleUpload() {
    const registrosFile = registrosRef.current?.files?.[0];
    const partesFile = partesRef.current?.files?.[0];
    if (!registrosFile || !partesFile) {
      setErrorMsg("Los archivos Registros.csv y Ent_PartesInvolucradas.csv son obligatorios");
      setState("error");
      return;
    }
    setState("loading"); setErrorMsg(""); setResult(null);

    try {
      setProgress("Leyendo Registros.csv...");
      const registros = await readFile(registrosFile);

      setProgress("Leyendo Ent_PartesInvolucradas.csv...");
      const partes = await readFile(partesFile);

      let adjudicaciones: Record<string, string>[] = [];
      let contratos: Record<string, string>[] = [];
      if (adjRef.current?.files?.[0]) {
        setProgress("Leyendo Ent_Adjudicaciones.csv...");
        adjudicaciones = await readFile(adjRef.current.files[0]);
      }
      if (conRef.current?.files?.[0]) {
        setProgress("Leyendo Ent_Contratos.csv...");
        contratos = await readFile(conRef.current.files[0]);
      }

      // Enviar registros en lotes para evitar HTTP 413
      const chunks = chunkArray(registros, CHUNK_SIZE);
      const totals: r = { chanchamayoEncontrados: 0, procesados: 0, nuevos: 0, actualizados: 0, errores: 0 };

      for (let i = 0; i < chunks.length; i++) {
        setProgress(`Enviando lote ${i + 1} de ${chunks.length} (${registros.length} registros total)...`);
        const data = await sendChunk(chunks[i], partes, adjudicaciones, contratos);
        totals.chanchamayoEncontrados = Math.max(totals.chanchamayoEncontrados, data.chanchamayoEncontrados);
        totals.procesados += data.procesados;
        totals.nuevos += data.nuevos;
        totals.actualizados += data.actualizados;
        totals.errores += data.errores;
      }

      setResult(totals);
      setState("success");
      refetch();
    } catch (err) {
      setErrorMsg(String(err));
      setState("error");
    } finally {
      setProgress("");
    }
  }

  function reset() {
    setState("idle"); setResult(null); setErrorMsg("");
    if (registrosRef.current) registrosRef.current.value = "";
    if (partesRef.current) partesRef.current.value = "";
    if (adjRef.current) adjRef.current.value = "";
    if (conRef.current) conRef.current.value = "";
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-accent">Panel de Administraci&#243;n</h1>
        <p className="text-muted-foreground mt-2">Carga datos del OECE para Chanchamayo</p>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Contrataciones", value: stats?.totalContrataciones ?? "\u2014" },
          { label: "Entidades", value: stats?.entidadesActivas ?? "\u2014" },
          { label: "Proveedores", value: stats?.proveedoresUnicos ?? "\u2014" },
        ].map(({ label, value }) => (
          <Card key={label}><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-accent">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </CardContent></Card>
        ))}
      </div>
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-semibold">C&#243;mo obtener los archivos:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Ve a <a href="https://contratacionesabiertas.oece.gob.pe/descargas" target="_blank" rel="noreferrer" className="underline font-medium">contratacionesabiertas.oece.gob.pe/descargas</a></li>
                <li>Descarga el ZIP del mes (formato <strong>CSV (ES)</strong>)</li>
                <li>Descomprime y sube los archivos aqu&#237;</li>
                <li>Solo se importar&#225;n registros de <strong>Chanchamayo</strong></li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Cargar archivos CSV</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FileInput label="Registros.csv" required inputRef={registrosRef} disabled={state === "loading"} />
          <FileInput label="Ent_PartesInvolucradas.csv" required inputRef={partesRef} disabled={state === "loading"} />
          <FileInput label="Ent_Adjudicaciones.csv" inputRef={adjRef} disabled={state === "loading"} />
          <FileInput label="Ent_Contratos.csv" inputRef={conRef} disabled={state === "loading"} />
          {state === "loading" && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />{progress || "Procesando..."}
            </div>
          )}
          {state === "success" && result && (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-semibold mb-1">&#161;Carga exitosa!</p>
                <ul className="space-y-0.5">
                  <li>Chanchamayo encontrados: <strong>{result.chanchamayoEncontrados}</strong></li>
                  <li>Procesados: <strong>{result.procesados}</strong></li>
                  <li>Nuevos: <strong>{result.nuevos}</strong></li>
                  <li>Actualizados: <strong>{result.actualizados}</strong></li>
                  {result.errores > 0 && <li className="text-orange-700">Con errores: <strong>{result.errores}</strong></li>}
                </ul>
              </div>
            </div>
          )}
          {state === "error" && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800"><p className="font-semibold">Error</p><p>{errorMsg}</p></div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            {(state === "success" || state === "error") ? (
              <Button onClick={reset} variant="outline">Cargar otro mes</Button>
            ) : (
              <Button onClick={handleUpload} disabled={state === "loading"} className="bg-primary hover:bg-primary/90">
                {state === "loading" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</> : <><Upload className="mr-2 h-4 w-4" />Importar datos</>}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FileInput({ label, required, inputRef, disabled }: { label: string; required?: boolean; inputRef: React.RefObject<HTMLInputElement>; disabled: boolean; }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <input ref={inputRef} type="file" accept=".csv" disabled={disabled}
          className="text-sm text-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-primary file:text-white hover:file:bg-primary/90 file:cursor-pointer cursor-pointer flex-1 disabled:opacity-50" />
      </div>
    </div>
  );
}
