import { useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Shield, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArbolGenealogico } from "@/components/arbol-genealogico";
import { PersonaSidebar } from "@/components/persona-sidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiUrl } from "@/lib/api";

interface Nodo {
  id: string;
  dni: string | null;
  nombre: string;
  fotoUrl: string | null;
  nivel: number;
  etiquetas: string[];
}

interface ArbolData {
  persona: Nodo | null;
  arbol: {
    nodos: Nodo[];
    aristas: Array<{
      source: string;
      target: string;
      tipoRelacion: string;
    }>;
  };
}

export default function PersonaDetalle() {
  const { dni } = useParams<{ dni: string }>();
  const queryClient = useQueryClient();
  const [selectedPersona, setSelectedPersona] = useState<Nodo | null>(null);

  const { data, isLoading, error, refetch } = useQuery<ArbolData>({
    queryKey: ["persona-arbol", dni],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/personas/buscar?dni=${encodeURIComponent(dni!)}`));
      if (!res.ok) throw new Error("Error al obtener datos");
      return res.json();
    },
    enabled: !!dni,
  });

  const handleSelectPersona = useCallback((nodo: Nodo) => {
    setSelectedPersona(nodo);
  }, []);

  const handleEtiquetasChange = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["persona-arbol"] });
  }, [refetch, queryClient]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[500px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data?.persona) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <User className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Persona no encontrada</h3>
            <p className="text-muted-foreground mb-4">
              No se encontró ninguna persona con DNI "{dni}".
            </p>
            <Link href="/investigacion">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a búsqueda
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/investigacion">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
                <Shield className="h-3 w-3" />
                Investigación
              </div>
              <h1 className="text-2xl font-bold text-accent mt-1">
                {data.persona.nombre}
              </h1>
              <p className="text-sm text-muted-foreground font-mono">
                DNI: {data.persona.dni}
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {data.arbol.nodos.length} personas en el árbol
          </div>
        </div>

        {/* Main content: Tree + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-4">
                <ArbolGenealogico
                  nodos={data.arbol.nodos}
                  aristas={data.arbol.aristas}
                  onSelectPersona={handleSelectPersona}
                />
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-1">
            <PersonaSidebar
              persona={selectedPersona || data.persona}
              onEtiquetasChange={handleEtiquetasChange}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
