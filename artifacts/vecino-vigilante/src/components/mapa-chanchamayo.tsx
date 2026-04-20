import { useState } from "react";
import { Link } from "wouter";
import { MapPin, TrendingUp, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/formatters";

interface DistritoMapa {
  codigo: string;
  distrito: string;
  montoEsteAnio?: number | null;
  contratacionesEsteAnio?: number | null;
}

interface MapaChanchamayoProps {
  distritos: DistritoMapa[];
  isLoading?: boolean;
}

/**
 * Mapa interactivo SVG de la provincia de Chanchamayo.
 *
 * Muestra los 6 distritos como regiones clickeables con intensidad
 * de color según la inversión pública. Al hover muestra un tooltip
 * con los datos clave y al click lleva a la página del distrito.
 *
 * Posicionamiento aproximado basado en la geografía real de Chanchamayo:
 *   - Perené (norte-centro, más grande)
 *   - Pichanaqui (este, área extensa)
 *   - San Luis de Shuaro (noroeste)
 *   - Chanchamayo (centro, capital La Merced)
 *   - San Ramón (suroeste)
 *   - Vitoc (sur)
 */
export function MapaChanchamayo({
  distritos,
  isLoading,
}: MapaChanchamayoProps) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  // Mapeo código → datos para acceso rápido
  const dataByCode = new Map(distritos.map((d) => [d.codigo, d]));

  // Calcular intensidad de color según monto (0 a 1)
  const maxMonto = Math.max(
    ...distritos.map((d) => d.montoEsteAnio ?? 0),
    1,
  );

  const getIntensity = (codigo: string): number => {
    const d = dataByCode.get(codigo);
    if (!d?.montoEsteAnio) return 0.15;
    return 0.25 + (d.montoEsteAnio / maxMonto) * 0.75;
  };

  const getFill = (codigo: string): string => {
    const intensity = getIntensity(codigo);
    // Rojo peruano institucional con intensidad variable
    return `rgba(200, 16, 46, ${intensity})`;
  };

  // Definición de los distritos con sus paths SVG aproximados
  const distritosSVG = [
    {
      codigo: "120304",
      nombre: "San Luis de Shuaro",
      // Noroeste - pequeño
      path: "M 80 70 L 170 60 L 200 110 L 150 140 L 90 130 Z",
      labelX: 135,
      labelY: 100,
    },
    {
      codigo: "120302",
      nombre: "Perené",
      // Norte-centro - grande
      path: "M 170 60 L 340 50 L 380 150 L 280 200 L 200 160 L 200 110 Z",
      labelX: 270,
      labelY: 120,
    },
    {
      codigo: "120303",
      nombre: "Pichanaqui",
      // Este - muy grande
      path: "M 340 50 L 520 80 L 540 200 L 480 260 L 380 240 L 380 150 Z",
      labelX: 440,
      labelY: 150,
    },
    {
      codigo: "120301",
      nombre: "Chanchamayo",
      // Centro - capital
      path: "M 150 140 L 280 200 L 260 260 L 180 280 L 120 230 L 120 170 Z",
      labelX: 195,
      labelY: 220,
    },
    {
      codigo: "120305",
      nombre: "San Ramón",
      // Suroeste
      path: "M 90 230 L 180 280 L 260 260 L 270 340 L 180 380 L 80 340 Z",
      labelX: 170,
      labelY: 320,
    },
    {
      codigo: "120306",
      nombre: "Vitoc",
      // Sur
      path: "M 180 380 L 330 360 L 340 440 L 220 460 L 180 420 Z",
      labelX: 255,
      labelY: 415,
    },
  ];

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Leyenda */}
      <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-sm border p-4 hidden md:block">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Inversión pública
        </p>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[0.2, 0.4, 0.6, 0.8, 1].map((i) => (
              <div
                key={i}
                className="w-5 h-3 rounded-sm"
                style={{ background: `rgba(200, 16, 46, ${i})` }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-2">
            Menor → Mayor
          </span>
        </div>
      </div>

      {/* Contenedor del mapa */}
      <div className="relative bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30 rounded-2xl border-2 border-emerald-100/50 p-4 md:p-8 overflow-hidden">
        {/* Decoración de fondo - representación sutil de selva */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="trees"
                x="0"
                y="0"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="20" cy="20" r="2" fill="#2D6A4F" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#trees)" />
          </svg>
        </div>

        <div className="relative">
          <div className="text-center mb-6">
            <p className="text-sm uppercase tracking-widest text-emerald-700 font-semibold">
              Provincia de Chanchamayo
            </p>
            <h3 className="text-2xl md:text-3xl font-serif font-bold text-accent mt-1">
              Toca un distrito para explorar
            </h3>
          </div>

          <svg
            viewBox="0 0 620 500"
            className="w-full h-auto drop-shadow-sm"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Sombra suave para dar profundidad */}
            <defs>
              <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                <feOffset dx="0" dy="2" result="offsetblur" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.15" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Distritos */}
            {distritosSVG.map((d) => {
              const isHovered = hoveredCode === d.codigo;
              const data = dataByCode.get(d.codigo);

              return (
                <Link key={d.codigo} href={`/distrito/${d.codigo}`}>
                  <g
                    className="cursor-pointer transition-all duration-300"
                    style={{
                      filter: isHovered ? "url(#soft-shadow)" : "none",
                      transform: isHovered ? "translateY(-2px)" : "none",
                      transformOrigin: `${d.labelX}px ${d.labelY}px`,
                    }}
                    onMouseEnter={() => setHoveredCode(d.codigo)}
                    onMouseLeave={() => setHoveredCode(null)}
                  >
                    <motion.path
                      d={d.path}
                      fill={getFill(d.codigo)}
                      stroke={isHovered ? "#C8102E" : "#ffffff"}
                      strokeWidth={isHovered ? 3 : 2}
                      strokeLinejoin="round"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4 }}
                    />

                    {/* Nombre del distrito */}
                    <text
                      x={d.labelX}
                      y={d.labelY - 8}
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                      style={{
                        fontFamily: "inherit",
                        fontSize: "15px",
                        fontWeight: 700,
                        fill: "#1B365D",
                        paintOrder: "stroke",
                        stroke: "white",
                        strokeWidth: "3px",
                        strokeLinejoin: "round",
                      }}
                    >
                      {d.nombre}
                    </text>

                    {/* Monto resumido */}
                    {data?.montoEsteAnio && data.montoEsteAnio > 0 && (
                      <text
                        x={d.labelX}
                        y={d.labelY + 10}
                        textAnchor="middle"
                        className="pointer-events-none select-none"
                        style={{
                          fontFamily: "inherit",
                          fontSize: "12px",
                          fontWeight: 600,
                          fill: "#C8102E",
                          paintOrder: "stroke",
                          stroke: "white",
                          strokeWidth: "2.5px",
                          strokeLinejoin: "round",
                        }}
                      >
                        {formatCompact(data.montoEsteAnio)}
                      </text>
                    )}
                  </g>
                </Link>
              );
            })}
          </svg>

          {/* Tooltip flotante */}
          {hoveredCode && (() => {
            const hovered = dataByCode.get(hoveredCode);
            const distritoSVG = distritosSVG.find(
              (d) => d.codigo === hoveredCode,
            );
            if (!hovered || !distritoSVG) return null;

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-6 bg-white rounded-xl shadow-lg border-2 border-primary/20 p-4 md:max-w-sm pointer-events-none"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-accent mb-2">
                      <MapPin className="h-4 w-4" />
                      <p className="font-bold">{hovered.distrito}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                        Inversión este año
                      </p>
                      <p className="text-xl font-bold text-primary">
                        {formatCurrency(hovered.montoEsteAnio)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {hovered.contratacionesEsteAnio ?? 0} contrataciones
                      </p>
                    </div>
                  </div>
                  <div className="bg-primary/10 text-primary p-2 rounded-lg">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-primary text-sm font-semibold">
                  <span>Toca para ver detalle</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </motion.div>
            );
          })()}
        </div>

        {/* Indicador de escala y orientación */}
        <div className="relative mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <span className="font-bold text-emerald-700">N</span>
              <div className="w-px h-3 bg-emerald-700" />
            </div>
            <span className="italic">Región Junín · Perú</span>
          </div>
          <span className="hidden md:inline italic">
            Mapa esquemático para navegación
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-2xl">
          <div className="text-muted-foreground animate-pulse">
            Cargando datos...
          </div>
        </div>
      )}
    </div>
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `S/ ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `S/ ${(value / 1_000).toFixed(0)}K`;
  }
  return `S/ ${value.toFixed(0)}`;
}
