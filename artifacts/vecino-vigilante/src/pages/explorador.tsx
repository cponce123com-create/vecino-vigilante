import { useState } from "react";
import { useGetContrataciones, getGetContratacionesQueryKey } from "@workspace/api-client-react";
import { ContratacionCard } from "@/components/contratacion-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Search, Filter, Download, X, LayoutGrid, Table2, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ESTADO_MAPPING, TIPO_MAPPING } from "@/lib/constants";
import { apiUrl } from "@/lib/api";

type Vista = "cards" | "tabla";
type ColOrden = "fecha" | "monto" | "titulo" | "entidad";

export default function Explorador() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [estado, setEstado] = useState<string>("");
  const [procedimiento, setProcedimiento] = useState<string>("");
  const [ordenar, setOrdenar] = useState<string>("");
  const [page, setPage] = useState(1);
  const [vista, setVista] = useState<Vista>("cards");
  const [colOrden, setColOrden] = useState<ColOrden>("fecha");
  const [colDir, setColDir] = useState<"asc" | "desc">("desc");
  const limit = 12;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedQ(q);
    setPage(1);
  };

  const handleReset = () => {
    setQ(""); setDebouncedQ(""); setTipo(""); setEstado("");
    setProcedimiento(""); setOrdenar(""); setPage(1);
  };

  const hayFiltros = debouncedQ || tipo || estado || procedimiento;

  const { data, isLoading } = useGetContrataciones({
    q: debouncedQ || undefined,
    tipo: tipo && tipo !== "todos" ? tipo : undefined,
    estado: estado && estado !== "todos" ? estado : undefined,
    procedimiento: procedimiento && procedimiento !== "todos" ? procedimiento : undefined,
    ordenar: ordenar && ordenar !== "default" ? ordenar as "fecha_asc" | "monto_desc" | "monto_asc" : undefined,
    page,
    limit,
  }, { query: { queryKey: getGetContratacionesQueryKey({ q: debouncedQ, tipo, estado, procedimiento, ordenar, page, limit }) } });

  const handleDownloadExcel = () => {
    fetch(apiUrl("/api/excel/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: debouncedQ || null,
        tipo: tipo && tipo !== "todos" ? tipo : null,
        estado: estado && estado !== "todos" ? estado : null,
        procedimiento: procedimiento && procedimiento !== "todos" ? procedimiento : null,
      }),
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `contrataciones-${new Date().toISOString().split("T")[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => console.error("Error descargando excel", err));
  };

  // Ordenamiento local para la vista tabla
  const filas = data?.data ? [...data.data].sort((a, b) => {
    let va: string | number = "";
    let vb: string | number = "";
    if (colOrden === "fecha") { va = a.fechaConvocatoria ?? ""; vb = b.fechaConvocatoria ?? ""; }
    else if (colOrden === "monto") { va = a.montoAdjudicado ?? a.montoReferencial ?? 0; vb = b.montoAdjudicado ?? b.montoReferencial ?? 0; }
    else if (colOrden === "titulo") { va = a.titulo ?? ""; vb = b.titulo ?? ""; }
    else if (colOrden === "entidad") { va = a.entidadNombre ?? ""; vb = b.entidadNombre ?? ""; }
    if (va < vb) return colDir === "asc" ? -1 : 1;
    if (va > vb) return colDir === "asc" ? 1 : -1;
    return 0;
  }) : [];

  const toggleCol = (col: ColOrden) => {
    if (colOrden === col) setColDir(d => d === "asc" ? "desc" : "asc");
    else { setColOrden(col); setColDir("desc"); }
  };

  const IconOrden = ({ col }: { col: ColOrden }) => {
    if (colOrden !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
    return colDir === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  };

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">

      {/* ── Sidebar filtros ── */}
      <aside className="w-full md:w-64 shrink-0 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-2xl font-bold">Filtros</h2>
            {hayFiltros && (
              <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Búsqueda</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Obras, entidades, proveedores..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="OBRAS">Construcciones (Obras)</SelectItem>
                  <SelectItem value="BIENES">Productos (Bienes)</SelectItem>
                  <SelectItem value="SERVICIOS">Servicios</SelectItem>
                  <SelectItem value="CONSULTORIA">Estudios Técnicos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={estado} onValueChange={(v) => { setEstado(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Todos los estados" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="CONVOCADO">Convocatoria abierta</SelectItem>
                  <SelectItem value="ADJUDICADO">Ya se eligió ganador</SelectItem>
                  <SelectItem value="CONTRATADO">En ejecución</SelectItem>
                  <SelectItem value="FINALIZADO">Terminado</SelectItem>
                  <SelectItem value="DESIERTO">Sin postores</SelectItem>
                  <SelectItem value="NULO">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Procedimiento</label>
              <Select value={procedimiento} onValueChange={(v) => { setProcedimiento(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="LP">Licitación Pública</SelectItem>
                  <SelectItem value="AS">Adjudicación Simplificada</SelectItem>
                  <SelectItem value="SM">Subasta Inversa</SelectItem>
                  <SelectItem value="CP">Concurso Público</SelectItem>
                  <SelectItem value="CD">Contratación Directa</SelectItem>
                  <SelectItem value="CE">Comparación de Precios</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full">
              <Search className="mr-2 h-4 w-4" /> Buscar
            </Button>
          </form>
        </div>

        <Button variant="outline" className="w-full text-primary border-primary hover:bg-primary hover:text-white" onClick={handleDownloadExcel}>
          <Download className="mr-2 h-4 w-4" /> Exportar a Excel
        </Button>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="flex-1 space-y-5 min-w-0">

        {/* Título + controles */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="font-serif text-4xl font-bold text-accent">Explorador</h1>
          <div className="flex items-center gap-2">
            {vista === "cards" && (
              <Select value={ordenar} onValueChange={(v) => { setOrdenar(v); setPage(1); }}>
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue placeholder="Ordenar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Más reciente</SelectItem>
                  <SelectItem value="fecha_asc">Más antiguo</SelectItem>
                  <SelectItem value="monto_desc">Mayor monto</SelectItem>
                  <SelectItem value="monto_asc">Menor monto</SelectItem>
                </SelectContent>
              </Select>
            )}
            {/* Toggle cards / tabla */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setVista("cards")}
                className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${vista === "cards" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => setVista("tabla")}
                className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${vista === "tabla" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                <Table2 className="h-4 w-4" />
                <span className="hidden sm:inline">Tabla</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chips de filtros activos */}
        {hayFiltros && (
          <div className="flex flex-wrap gap-2">
            {debouncedQ && (
              <Badge variant="secondary" className="gap-1">
                "{debouncedQ}"
                <button onClick={() => { setQ(""); setDebouncedQ(""); }}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {tipo && tipo !== "todos" && (
              <Badge variant="secondary" className="gap-1">
                {tipo}<button onClick={() => setTipo("")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {estado && estado !== "todos" && (
              <Badge variant="secondary" className="gap-1">
                {ESTADO_MAPPING[estado] || estado}<button onClick={() => setEstado("")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {procedimiento && procedimiento !== "todos" && (
              <Badge variant="secondary" className="gap-1">
                {procedimiento}<button onClick={() => setProcedimiento("")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
          </div>
        )}

        {/* Contador */}
        {!isLoading && data && (
          <div className="text-sm text-muted-foreground flex justify-between items-center">
            <span><span className="font-bold text-foreground">{data.total}</span> contrataciones encontradas</span>
            <span className="font-medium text-foreground">Total: {formatCurrency(data.montoTotal)}</span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        )}

        {/* Sin resultados */}
        {!isLoading && data && data.data.length === 0 && (
          <div className="text-center py-20 bg-muted/50 rounded-xl border border-dashed">
            <Filter className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No se encontraron resultados</h3>
            <p className="text-muted-foreground mb-4">Prueba ajustando los filtros</p>
            <Button variant="outline" onClick={handleReset}>Limpiar filtros</Button>
          </div>
        )}

        {/* ── VISTA CARDS ── */}
        {!isLoading && data && data.data.length > 0 && vista === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {data.data.map((item) => <ContratacionCard key={item.ocid} contratacion={item} />)}
          </div>
        )}

        {/* ── VISTA TABLA ── */}
        {!isLoading && data && data.data.length > 0 && vista === "tabla" && (
          <div className="rounded-xl border overflow-x-auto bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium w-[36%]">
                    <button onClick={() => toggleCol("titulo")} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                      Contratación <IconOrden col="titulo" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium w-[22%]">
                    <button onClick={() => toggleCol("entidad")} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                      Entidad <IconOrden col="entidad" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium w-[12%]">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium w-[12%]">
                    <button onClick={() => toggleCol("fecha")} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                      Fecha <IconOrden col="fecha" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 font-medium w-[14%]">
                    <button onClick={() => toggleCol("monto")} className="flex items-center gap-1.5 hover:text-primary transition-colors ml-auto">
                      Monto <IconOrden col="monto" />
                    </button>
                  </th>
                  <th className="px-3 py-3 w-[4%]" />
                </tr>
              </thead>
              <tbody>
                {filas.map((item, i) => {
                  const esDirecta = item.procedimiento === "CD";
                  const estadoColor =
                    item.estado === "CONVOCADO" ? "bg-blue-50 text-blue-700" :
                    item.estado === "ADJUDICADO" ? "bg-amber-50 text-amber-700" :
                    item.estado === "CONTRATADO" ? "bg-green-50 text-green-700" :
                    item.estado === "FINALIZADO" ? "bg-gray-100 text-gray-600" :
                    "bg-red-50 text-red-700";
                  return (
                    <tr key={item.ocid} className={`border-b last:border-0 hover:bg-primary/5 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {esDirecta && <span className="mt-1.5 w-2 h-2 rounded-full bg-alerta shrink-0" title="Contratación directa — sin competencia" />}
                          <div className="min-w-0">
                            <Link href={`/contratacion/${item.ocid}`}>
                              <span className="font-medium text-accent hover:text-primary transition-colors line-clamp-2 cursor-pointer leading-snug">
                                {item.titulo || "Sin título"}
                              </span>
                            </Link>
                            <span className={`mt-1 inline-block text-xs px-1.5 py-0.5 rounded font-medium ${estadoColor}`}>
                              {ESTADO_MAPPING[item.estado || ""] || item.estado || "—"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="line-clamp-2 text-xs">{item.entidadNombre || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <span className="block text-xs text-muted-foreground">{TIPO_MAPPING[item.tipo || ""] || item.tipo || "—"}</span>
                          <span className="block text-xs font-medium">{item.procedimiento || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(item.fechaConvocatoria)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-sm whitespace-nowrap">
                        {formatCurrency(item.montoAdjudicado ?? item.montoReferencial)}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/contratacion/${item.ocid}`}>
                          <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {!isLoading && data && data.pages > 1 && (
          <div className="flex justify-center gap-2 pt-4">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
            <span className="flex items-center px-4 text-sm font-medium">Página {page} de {data.pages}</span>
            <Button variant="outline" disabled={page === data.pages} onClick={() => setPage((p) => Math.min(data.pages, p + 1))}>Siguiente</Button>
          </div>
        )}

        {!isLoading && !data && (
          <div className="text-center py-20 text-destructive">Error al cargar los datos</div>
        )}
      </main>
    </div>
  );
}
