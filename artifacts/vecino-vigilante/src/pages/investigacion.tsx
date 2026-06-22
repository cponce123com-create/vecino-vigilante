import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Shield, User, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { apiUrl } from "@/lib/api";

export default function Investigacion() {
  const [dni, setDni] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<any[] | null>(null);
  const [, setLocation] = useLocation();

  const handleSearch = async () => {
    if (!dni.trim()) return;

    setLoading(true);
    setError(null);
    setResultados(null);

    try {
      const res = await fetch(apiUrl(`/api/personas/buscar?dni=${encodeURIComponent(dni.trim())}`));
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error en la búsqueda");
      }
      const data = await res.json();
      if (data.persona) {
        // Go directly to the person detail page
        setLocation(`/investigacion/${dni.trim()}`);
      } else {
        setResultados([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium">
            <Shield className="h-4 w-4" />
            Módulo de investigación
          </div>
          <h1 className="text-4xl font-serif font-bold text-accent">
            Buscador de personas
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Ingresa un DNI para buscar personas y visualizar su árbol de relaciones
            familiares y políticas.
          </p>
        </div>

        {/* Search bar */}
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Ingresa un DNI (8 dígitos)"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-10 h-12 text-lg"
                  maxLength={9}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading || !dni.trim()}
                className="h-12 px-6"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Buscar
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {resultados !== null && resultados.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <User className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Persona no encontrada</h3>
              <p className="text-muted-foreground mb-4">
                No se encontró ninguna persona con el DNI "{dni}".
              </p>
              <p className="text-sm text-muted-foreground">
                Prueba cargando mensajes de Telegram primero o verifica el DNI ingresado.
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
