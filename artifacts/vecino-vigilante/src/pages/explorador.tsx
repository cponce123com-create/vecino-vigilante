import { useState } from "react";
import { useGetContrataciones, getGetContratacionesQueryKey } from "@workspace/api-client-react";
import { ContratacionCard } from "@/components/contratacion-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";

export default function Explorador() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [estado, setEstado] = useState<string>("");
  const [procedimiento, setProcedimiento] = useState<string>("");
  const [ordenar, setOrdenar] = useState<string>("");
  const [page, setPage] = useState(1);
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
    fetch("/api/excel/generate", {
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

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      {/* ── Sidebar filtros ── */}
      <aside className="w-full md:w-64 shrink-0 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-2xl font-bold">Filtros</h2>
            {hayFiltros && (
              <button
                onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            {/* Búsqueda */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Búsqueda</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Obras, entidades, proveedores..."
                  className="pl-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            {/* Tipo — valores en MAYÚSCULAS como están en la DB */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="OBRAS">Construcciones (Obras)</SelectItem>
                  <SelectItem value="BIENES">Productos (Bienes)</SelectItem>
                  <SelectItem value="SERVICIOS">Servicios</SelectItem>
                  <SelectItem value="CONSULTORIA">Estudios Técnicos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={estado} onValueChange={(v) => { setEstado(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
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

            {/* Procedimiento — nuevo filtro que ya existía en el backend */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Procedimiento</label>
              <Select value={procedimiento} onValueChange={(v) => { setProcedimiento(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los procedimientos" />
                </SelectTrigger>
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
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </form>
        </div>

        <Button
          variant="outline"
          className="w-full text-primary border-primary hover:bg-primary hover:text-white"
          onClick={handleDownloadExcel}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar a Excel
        </Button>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="flex-1 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="font-serif text-4xl font-bold text-accent">
            Explorador de Contrataciones
          </h1>

          {/* Ordenar */}
          <Select value={ordenar} onValueChange={(v) => { setOrdenar(v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Ordenar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Más reciente primero</SelectItem>
              <SelectItem value="fecha_asc">Más antiguo primero</SelectItem>
              <SelectItem value="monto_desc">Mayor monto primero</SelectItem>
              <SelectItem value="monto_asc">Menor monto primero</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Chips de filtros activos */}
        {hayFiltros && (
          <div className="flex flex-wrap gap-2">
            {debouncedQ && (
              <Badge variant="secondary" className="gap-1">
                Búsqueda: "{debouncedQ}"
                <button onClick={() => { setQ(""); setDebouncedQ(""); }}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {tipo && tipo !== "todos" && (
              <Badge variant="secondary" className="gap-1">
                Tipo: {tipo}
                <button onClick={() => setTipo("")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {estado && estado !== "todos" && (
              <Badge variant="secondary" className="gap-1">
                Estado: {estado}
                <button onClick={() => setEstado("")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {procedimiento && procedimiento !== "todos" && (
              <Badge variant="secondary" className="gap-1">
                Proc: {procedimiento}
                <button onClick={() => setProcedimiento("")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="text-muted-foreground flex justify-between items-center">
              <span>
                Mostrando{" "}
                <span className="font-bold text-foreground">{data.data.length}</span>{" "}
                de{" "}
                <span className="font-bold text-foreground">{data.total}</span>{" "}
                contrataciones
              </span>
              <span className="font-medium text-foreground">
                Total: {formatCurrency(data.montoTotal)}
              </span>
            </div>

            {data.data.length === 0 ? (
              <div className="text-center py-20 bg-muted/50 rounded-xl border border-dashed">
                <Filter className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No se encontraron resultados</h3>
                <p className="text-muted-foreground mb-4">
                  Prueba ajustando los filtros de búsqueda
                </p>
                <Button variant="outline" onClick={handleReset}>
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {data.data.map((item) => (
                    <ContratacionCard key={item.ocid} contratacion={item} />
                  ))}
                </div>

                {data.pages > 1 && (
                  <div className="flex justify-center gap-2 pt-8">
                    <Button
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center px-4 text-sm font-medium">
                      Página {page} de {data.pages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={page === data.pages}
                      onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-destructive">
            Error al cargar los datos
          </div>
        )}
      </main>
    </div>
  );
}
