import { User, Fingerprint, MapPin, Tags } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { GestionEtiquetas } from "./gestion-etiquetas";
import { SubirFoto } from "./subir-foto";

interface Nodo {
  id: string;
  dni: string | null;
  nombre: string;
  fotoUrl: string | null;
  nivel: number;
  etiquetas: string[];
}

interface PersonaSidebarProps {
  persona: Nodo | null;
  onEtiquetasChange: () => void;
}

const ETIQUETA_COLORS: Record<string, string> = {
  aportante: "bg-red-100 text-red-700 border-red-200",
  investigado: "bg-orange-100 text-orange-700 border-orange-200",
  testigo: "bg-green-100 text-green-700 border-green-200",
  financista: "bg-yellow-100 text-yellow-700 border-yellow-200",
  denunciado: "bg-red-200 text-red-800 border-red-300",
  sentenciado: "bg-red-300 text-red-900 border-red-400",
  prófugo: "bg-amber-100 text-amber-700 border-amber-200",
  vinculado: "bg-orange-100 text-orange-700 border-orange-200",
};

export function PersonaSidebar({ persona, onEtiquetasChange }: PersonaSidebarProps) {
  if (!persona) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Selecciona una persona en el árbol para ver sus datos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {persona.nombre}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Foto */}
        {persona.fotoUrl ? (
          <div className="flex justify-center">
            <img
              src={persona.fotoUrl}
              alt={persona.nombre}
              className="w-32 h-32 rounded-full object-cover border-2 border-border"
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center">
              <User className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Datos */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Fingerprint className="h-4 w-4" />
            <span className="font-mono">{persona.dni || "Sin DNI"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>Nivel {persona.nivel} en el árbol</span>
          </div>
        </div>

        {/* Etiquetas */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <Tags className="h-4 w-4" />
            Etiquetas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {persona.etiquetas.length > 0 ? (
              persona.etiquetas.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={ETIQUETA_COLORS[tag] || "bg-gray-100 text-gray-700"}
                >
                  {tag}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Sin etiquetas</span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="space-y-2 pt-2 border-t">
          <SubirFoto personaId={persona.id} onSuccess={onEtiquetasChange} />
          <GestionEtiquetas personaId={persona.id} onSuccess={onEtiquetasChange} />
        </div>
      </CardContent>
    </Card>
  );
}
