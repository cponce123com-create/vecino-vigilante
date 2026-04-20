import {
  useGetStats,
  useGetDistritos,
  useGetContrataciones,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building,
  TrendingUp,
  Users,
  HardHat,
  ArrowRight,
  Search,
  BarChart3,
  Download,
  Shield,
  Sparkles,
} from "lucide-react";
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ContratacionCard } from "@/components/contratacion-card";
import { MapaChanchamayo } from "@/components/mapa-chanchamayo";
import { motion } from "framer-motion";

export default function Home() {
  const { data: stats, isLoading: isLoadingStats } = useGetStats();
  const { data: distritos, isLoading: isLoadingDistritos } = useGetDistritos();
  const { data: ultimas, isLoading: isLoadingUltimas } = useGetContrataciones({
    limit: 6,
  });

  return (
    <div className="flex flex-col w-full">
      {/* ═══════════════════════════════════════════════ */}
      {/* HERO MODERNO CON EFECTOS */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-accent via-accent to-[#0f2847] text-white">
        {/* Patrón decorativo sutil */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="grid-hero"
                x="0"
                y="0"
                width="60"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="30" cy="30" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-hero)" />
          </svg>
        </div>

        {/* Orbe decorativo */}
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />

        <div className="relative container mx-auto px-4 py-20 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center space-y-8"
          >
            {/* Badge superior */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Portal ciudadano · Datos oficiales del OECE</span>
            </div>

            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[1.1] tracking-tight">
              Qué se está comprando
              <br />
              <span className="text-primary">con tu dinero</span>
            </h1>

            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
              Explora, entiende y descarga todas las contrataciones públicas
              en Chanchamayo y Junín. Transparencia al alcance de un clic.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link href="/explorador">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 text-base h-14 shadow-lg shadow-primary/20 w-full sm:w-auto"
                >
                  <Search className="mr-2 h-5 w-5" />
                  Explorar contrataciones
                </Button>
              </Link>
              <Link href="/descargas">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8 text-base h-14 text-white border-white/30 bg-white/10 hover:bg-white/20 hover:text-white w-full sm:w-auto"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Descargar en Excel
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 leading-[0]">
          <svg
            viewBox="0 0 1440 60"
            className="w-full h-12 md:h-16"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,32L80,37.3C160,43,320,53,480,48C640,43,800,21,960,16C1120,11,1280,21,1360,26.7L1440,32L1440,60L1360,60C1280,60,1120,60,960,60C800,60,640,60,480,60C320,60,160,60,80,60L0,60Z"
              fill="#FAFAF7"
            />
          </svg>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* KPIs FLOTANTES (se superponen al hero) */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="container mx-auto px-4 -mt-16 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            title="Total este año"
            value={
              isLoadingStats ? null : formatCurrency(stats?.montoEsteAnio)
            }
            icon={TrendingUp}
            isLoading={isLoadingStats}
            highlight
          />
          <KpiCard
            title="Obras en ejecución"
            value={
              isLoadingStats ? null : stats?.obrasEnEjecucion?.toString()
            }
            icon={HardHat}
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="Entidades activas"
            value={
              isLoadingStats ? null : stats?.entidadesActivas?.toString()
            }
            icon={Building}
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="Proveedores únicos"
            value={
              isLoadingStats ? null : stats?.proveedoresUnicos?.toString()
            }
            icon={Users}
            isLoading={isLoadingStats}
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* MAPA INTERACTIVO DE CHANCHAMAYO */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="py-20 px-4 container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 max-w-2xl mx-auto"
        >
          <p className="text-sm uppercase tracking-widest text-primary font-semibold mb-2">
            Tu distrito, tus datos
          </p>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-accent leading-tight">
            Explora por distrito
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Descubre cuánto dinero público se invierte en cada zona de
            Chanchamayo. Haz clic en tu distrito para ver el detalle
            completo.
          </p>
        </motion.div>

        {isLoadingDistritos ? (
          <Skeleton className="h-96 md:h-[500px] w-full max-w-4xl mx-auto rounded-2xl" />
        ) : (
          <MapaChanchamayo
            distritos={distritos ?? []}
            isLoading={isLoadingDistritos}
          />
        )}

        {/* Lista alternativa debajo del mapa */}
        {distritos && distritos.length > 0 && (
          <div className="mt-12 max-w-4xl mx-auto">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold mb-4 text-center">
              O navega desde la lista
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {distritos.map((d) => (
                <Link key={d.codigo} href={`/distrito/${d.codigo}`}>
                  <div className="group bg-white border border-border rounded-xl p-4 hover:border-primary hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-accent group-hover:text-primary transition-colors">
                          {d.distrito}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {d.contratacionesEsteAnio ?? 0} contratos
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* SECCIÓN DE FEATURES */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="bg-muted/30 border-y py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-accent">
              Todo lo que necesitas saber
            </h2>
            <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto">
              Herramientas diseñadas para el ciudadano común. Sin jerga técnica.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={Search}
              title="Explora con filtros"
              description="Busca por distrito, entidad, monto, fechas o proveedor. Encuentra exactamente lo que te interesa."
              href="/explorador"
            />
            <FeatureCard
              icon={Download}
              title="Descarga tus reportes"
              description="Exporta a Excel con 6 hojas: detalle completo, resumen ejecutivo, rankings y gráficos."
              href="/descargas"
            />
            <FeatureCard
              icon={BarChart3}
              title="Observatorio ciudadano"
              description="Rankings de entidades, proveedores top, alertas de transparencia y evolución temporal."
              href="/observatorio"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* ÚLTIMAS CONTRATACIONES */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="py-20 px-4 container mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-primary font-semibold mb-2">
              Actualizado diariamente
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-accent">
              Últimas contrataciones
            </h2>
            <p className="text-muted-foreground mt-2 text-lg">
              Los procesos más recientes publicados en tu región.
            </p>
          </div>
          <Link href="/explorador" className="shrink-0">
            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-white"
            >
              Ver todas
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {isLoadingUltimas ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-xl" />
              ))}
          </div>
        ) : ultimas?.data && ultimas.data.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ultimas.data.map((c) => (
              <ContratacionCard key={c.ocid} contratacion={c} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* CTA FINAL */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-gradient-to-br from-accent to-[#0f2847] rounded-3xl p-10 md:p-16 text-white text-center relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
            <div className="relative">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
                Transparencia es poder ciudadano
              </h2>
              <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8">
                Cada contratación que explores, cada Excel que descargues,
                fortalece el control ciudadano sobre el gasto público.
              </p>
              <Link href="/acerca">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 h-12"
                >
                  Conoce el proyecto
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ────────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  isLoading,
  highlight = false,
}: {
  title: string;
  value: string | null | undefined;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`border-none shadow-lg ${
        highlight ? "bg-primary text-white" : "bg-white"
      }`}
    >
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 md:p-3 rounded-xl shrink-0 ${
              highlight ? "bg-white/20" : "bg-primary/10 text-primary"
            }`}
          >
            <Icon className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-xs md:text-sm font-medium truncate ${
                highlight ? "text-white/80" : "text-muted-foreground"
              }`}
            >
              {title}
            </p>
            {isLoading ? (
              <Skeleton
                className={`h-7 w-20 mt-1 ${highlight ? "bg-white/20" : ""}`}
              />
            ) : (
              <p
                className={`text-lg md:text-2xl font-bold truncate ${
                  highlight ? "text-white" : "text-foreground"
                }`}
              >
                {value || "—"}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="group bg-white border border-border rounded-2xl p-6 hover:border-primary hover:shadow-lg transition-all cursor-pointer h-full">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-lg text-accent mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
        <div className="mt-4 flex items-center text-primary text-sm font-semibold">
          Explorar
          <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const handleLoadDemo = async () => {
    setLoading(true);
    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
      await fetch(`${apiBase}/api/sync/seed-demo`, { method: "POST" });
      await queryClient.invalidateQueries();
      setDone(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center py-16 bg-muted/30 rounded-2xl border-2 border-dashed border-border">
      <div className="inline-flex p-4 bg-muted rounded-full mb-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground font-medium mb-2">
        Aún no hay contrataciones para mostrar
      </p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
        Los datos se sincronizan diariamente desde el OECE. La API del OSCE puede
        requerir un servidor con IP peruana. Puedes cargar datos de ejemplo para
        ver cómo funciona la web.
      </p>
      {done ? (
        <p className="text-sm text-green-600 font-medium">✅ Datos cargados. Recargando...</p>
      ) : (
        <Button
          onClick={handleLoadDemo}
          disabled={loading}
          className="bg-primary text-white hover:bg-primary/90"
        >
          {loading ? (
            <><span className="animate-spin mr-2">⟳</span> Cargando datos demo...</>
          ) : (
            <>⚡ Cargar datos de demostración</>
          )}
        </Button>
      )}
      <p className="text-xs text-muted-foreground mt-3">
        O ve a{" "}
        <Link href="/admin" className="underline text-primary">
          Administrar
        </Link>{" "}
        para más opciones de sincronización.
      </p>
    </div>
  );
}
