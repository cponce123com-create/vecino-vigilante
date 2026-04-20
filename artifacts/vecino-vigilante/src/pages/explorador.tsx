import { useState } from "react";
import { useGetContrataciones, getGetContratacionesQueryKey } from "@workspace/api-client-react";
import { ContratacionCard } from "@/components/contratacion-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";

export default function Explorador() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [estado, setEstado] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 12;

  // Use a simple timeout for debounce instead of a custom hook to save files
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedQ(q);
    setPage(1);
  };

  const { data, isLoading } = useGetContrataciones({
    q: debouncedQ || undefined,
    tipo: tipo && tipo !== "todos" ? tipo : undefined,
    estado: estado && estado !== "todos" ? estado : undefined,
    page,
    limit
  }, { query: { queryKey: getGetContratacionesQueryKey({ q: debouncedQ, tipo, estado, page, limit }) } });

  const handleDownloadExcel = () => {
    // This triggers the file download via direct location change
    const params = new URLSearchParams();
    if (debouncedQ) params.append("q", debouncedQ);
    if (tipo && tipo !== "todos") params.append("tipo", tipo);
    if (estado && estado !== "todos") params.append("estado", estado);
    
    // Fallback if the endpoint is not implemented as GET
    fetch('/api/excel/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: debouncedQ,
        tipo: tipo === "todos" ? null : tipo,
        estado: estado === "todos" ? null : estado
      })
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contrataciones-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    })
    .catch(err => console.error("Error downloading excel", err));
  };

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-64 shrink-0 space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-bold mb-4">Filtros</h2>
          
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Búsqueda</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar obras, entidades..." 
                  className="pl-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="Obras">Construcciones (Obras)</SelectItem>
                  <SelectItem value="Bienes">Productos (Bienes)</SelectItem>
                  <SelectItem value="Servicios">Servicios</SelectItem>
                  <SelectItem value="Consultoría de Obras">Estudios Técnicos</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full">
              Aplicar Filtros
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

      {/* Main Content */}
      <main className="flex-1 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="font-serif text-4xl font-bold text-accent">Explorador de Contrataciones</h1>
        </div>

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
                Mostrando <span className="font-bold text-foreground">{data.data.length}</span> de <span className="font-bold text-foreground">{data.total}</span> contrataciones
              </span>
              <span className="font-medium text-foreground">
                Suma total: {formatCurrency(data.montoTotal)}
              </span>
            </div>

            {data.data.length === 0 ? (
              <div className="text-center py-20 bg-muted/50 rounded-xl border border-dashed">
                <Filter className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No se encontraron resultados</h3>
                <p className="text-muted-foreground">Prueba ajustando los filtros de búsqueda</p>
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
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center px-4 text-sm font-medium">
                      Página {page} de {data.pages}
                    </span>
                    <Button 
                      variant="outline" 
                      disabled={page === data.pages}
                      onClick={() => setPage(p => Math.min(data.pages, p + 1))}
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
