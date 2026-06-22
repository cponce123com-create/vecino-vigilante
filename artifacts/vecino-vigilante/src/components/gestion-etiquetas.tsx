import { useState } from "react";
import { Tags, Plus, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { apiUrl } from "@/lib/api";

interface GestionEtiquetasProps {
  personaId: string;
  onSuccess: () => void;
}

export function GestionEtiquetas({ personaId, onSuccess }: GestionEtiquetasProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      setError("El nombre de la etiqueta es obligatorio");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl(`/api/personas/${personaId}/etiquetar`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al asignar etiqueta");
      }

      setNombre("");
      setOpen(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al asignar etiqueta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Tags className="h-4 w-4 mr-2" />
          Asignar etiqueta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar etiqueta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Nombre de la etiqueta (ej: aportante)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Asignando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Asignar etiqueta
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
