import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

interface Nodo {
  id: string;
  dni: string | null;
  nombre: string;
  fotoUrl: string | null;
  nivel: number;
  etiquetas: string[];
}

interface Arista {
  source: string;
  target: string;
  tipoRelacion: string;
}

interface ArbolGenealogicoProps {
  nodos: Nodo[];
  aristas: Arista[];
  onSelectPersona: (nodo: Nodo) => void;
}

const ETIQUETA_COLORS: Record<string, string> = {
  aportante: "#dc2626",
  investigado: "#ea580c",
  testigo: "#16a34a",
  financista: "#ca8a04",
  denunciado: "#991b1b",
  sentenciado: "#7f1d1d",
  prófugo: "#92400e",
  vinculado: "#b45309",
  colaborador: "#2563eb",
  donante: "#7c3aed",
  contribuyente: "#059669",
};

const RELACION_LABELS: Record<string, string> = {
  PADRE_DE: "Padre",
  MADRE_DE: "Madre",
  HIJO_DE: "Hijo/a",
  HERMANO_DE: "Hermano/a",
  CONYUGE_DE: "Cónyuge",
};

export function ArbolGenealogico({ nodos, aristas, onSelectPersona }: ArbolGenealogicoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || nodos.length === 0) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodos.map((n) => ({
          data: {
            id: n.id,
            label: n.nombre.split(" ")[0],
            fullLabel: n.nombre,
            ...n,
          },
        })),
        ...aristas.map((a, i) => ({
          data: {
            id: `e${i}`,
            source: a.source,
            target: a.target,
            label: RELACION_LABELS[a.tipoRelacion] || a.tipoRelacion,
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: any) => {
              const etiquetas = ele.data("etiquetas") || [];
              if (etiquetas.length > 0) {
                return ETIQUETA_COLORS[etiquetas[0]] || "#6366f1";
              }
              return "#6366f1";
            },
            label: "data(label)",
            "text-valign": "center",
            "text-halign": "center",
            color: "#fff",
            "font-size": "12px",
            "font-weight": "bold",
            width: 40,
            height: 40,
            "border-width": 2,
            "border-color": "#fff",
            "border-style": "solid",
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": "10px",
            color: "#64748b",
            "text-background-color": "#ffffff",
            "text-background-opacity": 1,
            "text-background-padding": "2px",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#f59e0b",
            "border-width": 4,
          },
        },
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        spacingFactor: 1.5,
        roots: `#${nodos[0]?.id}`,
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    cy.on("tap", "node", (evt) => {
      const nodeData = evt.target.data();
      onSelectPersona({
        id: nodeData.id,
        dni: nodeData.dni,
        nombre: nodeData.fullLabel,
        fotoUrl: nodeData.fotoUrl,
        nivel: nodeData.nivel,
        etiquetas: nodeData.etiquetas || [],
      });
    });

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [nodos, aristas, onSelectPersona]);

  if (nodos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay datos para mostrar
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-[500px] border rounded-xl bg-white shadow-sm"
    />
  );
}
