import { useState } from "react";
import { useGetProveedores, getGetProveedoresQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Building, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Proveedores() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedQ(q);
    setPage(1);
  };

  const { data, isLoading } = useGetProveedores({
    q: debouncedQ || undefined,
    page,
    limit: 24
  }, { query: { queryKey: getGetProveedoresQueryKey({ q: debouncedQ, page, limit: 24 }) } });

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-accent">Proveedores del Estado</h1>
        <p className="text-lg text-muted-foreground">
          Explora las empresas y personas que contratan con el Estado en la región.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2 pt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input 
              className="pl-10 h-12 text-lg" 
              placeholder="Buscar por RUC o Razón Social..." 
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button type="submit" size="lg" className="h-12 px-8">Buscar</Button>
        </form>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
          {Array(12).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : data && data.data.length > 0 ? (
        <div className="space-y-8 pt-8">
          <p className="text-sm font-medium text-muted-foreground">
            Encontrados {data.total} proveedores
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.data.map(proveedor => (
              <Link key={proveedor.ruc} href={`/proveedores/${proveedor.ruc}`}>
                <Card className="hover:border-primary transition-all cursor-pointer hover:shadow-md h-full">
                  <CardContent className="p-6 flex flex-col justify-between h-full gap-4">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="font-mono">{proveedor.ruc}</Badge>
                        {proveedor.vigenteRnp === "SI" && (
                          <Badge variant="secondary" className="bg-exito/10 text-exito text-xs">RNP Vigente</Badge>
                        )}
                      </div>
                      <h3 className="font-bold text-lg leading-tight line-clamp-2">{proveedor.razonSocial}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-auto">
                      <Building className="h-4 w-4" />
                      <span>Click para ver historial de contratos</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
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
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-xl text-muted-foreground">No se encontraron proveedores que coincidan con tu búsqueda.</p>
        </div>
      )}
    </div>
  );
}
