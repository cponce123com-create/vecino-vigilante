import { useGetStats, useGetDistritos, useGetContrataciones } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, TrendingUp, Users, HardHat, MapPin, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ContratacionCard } from "@/components/contratacion-card";

export default function Home() {
  const { data: stats, isLoading: isLoadingStats } = useGetStats();
  const { data: distritos, isLoading: isLoadingDistritos } = useGetDistritos();
  const { data: ultimas, isLoading: isLoadingUltimas } = useGetContrataciones({ limit: 6 });

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="bg-accent text-white py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center space-y-6">
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl leading-tight">
            Qué se está comprando con tu dinero
          </h1>
          <p className="text-lg md:text-xl text-accent-foreground/80 max-w-2xl mx-auto">
            Portal ciudadano de las contrataciones del Estado en Chanchamayo y Junín.
          </p>
          <div className="pt-8 max-w-xl mx-auto flex gap-4 justify-center flex-wrap">
            <Link href="/explorador">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 text-lg h-14">
                Explorar contrataciones
              </Button>
            </Link>
            <Link href="/descargas">
              <Button variant="outline" size="lg" className="rounded-full px-8 text-lg h-14 text-accent hover:text-accent-foreground border-white/20 bg-white/10 hover:bg-white/20">
                Descargar Datos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* KPI Section */}
      <section className="py-12 px-4 container mx-auto -mt-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard 
            title="Total Contratado Este Año" 
            value={isLoadingStats ? null : formatCurrency(stats?.montoEsteAnio)}
            icon={TrendingUp}
            isLoading={isLoadingStats}
          />
          <KpiCard 
            title="Obras en Ejecución" 
            value={isLoadingStats ? null : stats?.obrasEnEjecucion.toString()}
            icon={HardHat}
            isLoading={isLoadingStats}
          />
          <KpiCard 
            title="Entidades Activas" 
            value={isLoadingStats ? null : stats?.entidadesActivas.toString()}
            icon={Building}
            isLoading={isLoadingStats}
          />
          <KpiCard 
            title="Proveedores Únicos" 
            value={isLoadingStats ? null : stats?.proveedoresUnicos.toString()}
            icon={Users}
            isLoading={isLoadingStats}
          />
        </div>
      </section>

      {/* Mapa de Distritos (Grid visual) */}
      <section className="py-12 px-4 bg-muted/30 border-y">
        <div className="container mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-accent">Explora por Distrito</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Conoce cuánto dinero público se está invirtiendo en obras y servicios en cada zona de nuestra provincia.
            </p>
          </div>

          {isLoadingDistritos ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : distritos && distritos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {distritos.map(distrito => (
                <Link key={distrito.codigo} href={`/distrito/${distrito.codigo}`}>
                  <Card className="hover:border-primary transition-colors cursor-pointer h-full group hover:shadow-md">
                    <CardContent className="p-6 flex flex-col justify-between h-full gap-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 text-accent">
                          <MapPin className="h-5 w-5" />
                          <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{distrito.distrito}</h3>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all transform -translate-x-2 group-hover:translate-x-0" />
                      </div>
                      <div className="flex justify-between items-end border-t pt-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Inversión este año</p>
                          <p className="font-bold text-xl text-primary">{formatCurrency(distrito.montoEsteAnio)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Contratos</p>
                          <p className="font-bold text-lg">{distrito.contratacionesEsteAnio}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No hay datos de distritos disponibles.</div>
          )}
        </div>
      </section>
      
      {/* Últimas Contrataciones */}
      <section className="py-16 px-4 container mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-accent">Últimas contrataciones</h2>
            <p className="text-muted-foreground mt-2">Los procesos más recientes publicados por el Estado en nuestra región.</p>
          </div>
          <Link href="/explorador" className="shrink-0">
            <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
              Ver todas las compras
            </Button>
          </Link>
        </div>
        
        {isLoadingUltimas ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
          </div>
        ) : ultimas?.data && ultimas.data.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ultimas.data.map(contratacion => (
              <ContratacionCard key={contratacion.ocid} contratacion={contratacion} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/50 rounded-xl border border-dashed">
            <p className="text-muted-foreground">No hay contrataciones recientes disponibles.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, isLoading }: { title: string, value: string | null | undefined, icon: any, isLoading: boolean }) {
  return (
    <Card className="shadow-lg border-none bg-white">
      <CardContent className="p-6 flex items-center gap-4">
        <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
          <Icon className="w-8 h-8" />
        </div>
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold text-foreground truncate">{value || "0"}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
