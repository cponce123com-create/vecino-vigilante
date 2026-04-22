import { useState, useRef, useEffect } from "react";
import { ChevronDown, MapPin, Lock } from "lucide-react";
import { useLocation } from "wouter";

const DEPARTAMENTOS = [
  { id: "15", nombre: "Junín", disponible: true },
  { id: "01", nombre: "Amazonas", disponible: false },
  { id: "02", nombre: "Áncash", disponible: false },
  { id: "03", nombre: "Apurímac", disponible: false },
  { id: "04", nombre: "Arequipa", disponible: false },
  { id: "05", nombre: "Ayacucho", disponible: false },
  { id: "06", nombre: "Cajamarca", disponible: false },
  { id: "07", nombre: "Callao", disponible: false },
  { id: "08", nombre: "Cusco", disponible: false },
  { id: "09", nombre: "Huancavelica", disponible: false },
  { id: "10", nombre: "Huánuco", disponible: false },
  { id: "11", nombre: "Ica", disponible: false },
  { id: "12", nombre: "La Libertad", disponible: false },
  { id: "13", nombre: "Lambayeque", disponible: false },
  { id: "14", nombre: "Lima", disponible: false },
  { id: "16", nombre: "Loreto", disponible: false },
  { id: "17", nombre: "Madre de Dios", disponible: false },
  { id: "18", nombre: "Moquegua", disponible: false },
  { id: "19", nombre: "Pasco", disponible: false },
  { id: "20", nombre: "Piura", disponible: false },
  { id: "21", nombre: "Puno", disponible: false },
  { id: "22", nombre: "San Martín", disponible: false },
  { id: "23", nombre: "Tacna", disponible: false },
  { id: "24", nombre: "Tumbes", disponible: false },
  { id: "25", nombre: "Ucayali", disponible: false },
];

const PROVINCIAS: Record<string, { id: string; nombre: string; disponible: boolean }[]> = {
  "15": [
    { id: "1512", nombre: "Chanchamayo", disponible: true },
    { id: "1501", nombre: "Huancayo", disponible: false },
    { id: "1502", nombre: "Concepción", disponible: false },
    { id: "1503", nombre: "Chanchamayo", disponible: false },
    { id: "1504", nombre: "Junín", disponible: false },
    { id: "1505", nombre: "Satipo", disponible: false },
    { id: "1506", nombre: "Tarma", disponible: false },
    { id: "1507", nombre: "Yauli", disponible: false },
    { id: "1508", nombre: "Chupaca", disponible: false },
  ],
};

const DISTRITOS: Record<string, { id: string; nombre: string }[]> = {
  "1512": [
    { id: "todos", nombre: "Todos los distritos" },
    { id: "120301", nombre: "Chanchamayo (La Merced)" },
    { id: "120302", nombre: "Perené" },
    { id: "120303", nombre: "Pichanaki" },
    { id: "120304", nombre: "San Luis de Shuaro" },
    { id: "120305", nombre: "San Ramón" },
    { id: "120306", nombre: "Vitoc" },
  ],
};

interface GeoState {
  dpto: string;
  prov: string;
  dist: string;
}

function Dropdown({
  label,
  valor,
  opciones,
  onChange,
}: {
  label: string;
  valor: string;
  opciones: { id: string; nombre: string; disponible?: boolean }[];
  onChange: (id: string, disponible: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const seleccionado = opciones.find((o) => o.id === valor);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs bg-white border border-border rounded-md px-2.5 py-1.5 hover:border-primary/60 transition-colors whitespace-nowrap max-w-[180px]"
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium text-foreground truncate">{seleccionado?.nombre ?? "—"}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-border rounded-lg shadow-lg min-w-[180px] max-h-60 overflow-y-auto py-1">
          {opciones.map((op) => {
            const disponible = op.disponible !== false;
            const isSelected = op.id === valor;
            return (
              <button
                key={op.id}
                onClick={() => {
                  if (disponible) {
                    onChange(op.id, true);
                    setOpen(false);
                  }
                }}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2 ${
                  isSelected
                    ? "bg-primary/10 text-primary font-medium"
                    : disponible
                    ? "hover:bg-muted/60 text-foreground"
                    : "text-muted-foreground/50 cursor-not-allowed"
                }`}
              >
                <span className="truncate">{op.nombre}</span>
                {!disponible && <Lock className="h-3 w-3 shrink-0 text-muted-foreground/40" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GeoSelector() {
  const [, navigate] = useLocation();
  const [geo, setGeo] = useState<GeoState>({ dpto: "15", prov: "1512", dist: "todos" });

  const handleDpto = (id: string, disponible: boolean) => {
    if (!disponible) { navigate("/proximamente"); return; }
    const primProv = PROVINCIAS[id]?.find((p) => p.disponible);
    setGeo({ dpto: id, prov: primProv?.id ?? "", dist: "todos" });
  };

  const handleProv = (id: string, disponible: boolean) => {
    if (!disponible) { navigate("/proximamente"); return; }
    setGeo((g) => ({ ...g, prov: id, dist: "todos" }));
  };

  const handleDist = (id: string) => {
    setGeo((g) => ({ ...g, dist: id }));
    if (id !== "todos") navigate(`/distrito/${id}`);
  };

  const provincias = PROVINCIAS[geo.dpto] ?? [];
  const distritos = DISTRITOS[geo.prov] ?? [];

  return (
    <div className="border-b bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 py-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">Jurisdicción:</span>
          </div>

          <Dropdown
            label="Región"
            valor={geo.dpto}
            opciones={DEPARTAMENTOS}
            onChange={handleDpto}
          />

          {provincias.length > 0 && (
            <Dropdown
              label="Provincia"
              valor={geo.prov}
              opciones={provincias}
              onChange={handleProv}
            />
          )}

          {distritos.length > 0 && (
            <Dropdown
              label="Distrito"
              valor={geo.dist}
              opciones={distritos}
              onChange={(id) => handleDist(id)}
            />
          )}



          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/60">
            <span className="hidden sm:inline">Datos OCDS · SEACE · Transparencia Económica</span>
          </div>
        </div>
      </div>
    </div>
  );
}
