import { useGetRankings, getGetRankingsQueryKey, useGetAlertas, getGetAlertasQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { Link } from "wouter";
import { AlertTriangle, Building2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Observatorio() {
  const { data: rankings, isLoading: isLoadingRankings } = useGetRankings({}, { query: { queryKey: getGetRankingsQueryKey({}) } });
  const { data: alertas, isLoading: isLoadingAlertas } = useGetAlertas({}, { query: { queryKey: getGetAlertasQueryKey({}) } });

  return (
    <div className="container mx-auto px-4 py-10 space-y-12">
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-accent">Observatorio de Transparencia</h1>
        <p className="text-lg text-muted-foreground">
          Rankings, indicadores y alertas sobre cómo se gasta el dinero público en la región. 
          Datos para vigilar e investigar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Entidades con más dinero */}
        <Card className="shadow-md">
          <CardHeader className="bg-accent/5 pb-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-accent" />
              <div>
                <CardTitle className="font-serif text-2xl">Top 10 Entidades</CardTitle>
                <CardDescription>Las que más presupuesto han adjudicado</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoadingRankings ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : rankings?.topEntidadesMonto && rankings.topEntidadesMonto.length > 0 ? (
              <div className="space-y-6">
                {rankings.topEntidadesMonto.map((entidad, i) => (
                  <div key={entidad.ruc} className="flex gap-4 items-center">
                    <div className="font-serif text-2xl font-bold text-muted-foreground/40 w-6 text-center">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/entidades/${entidad.ruc}`} className="hover:text-primary transition-colors block truncate font-medium">
                        {entidad.nombre}
                      </Link>
                      <p className="text-sm text-muted-foreground">{entidad.totalContrataciones} procesos</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="font-bold text-lg">{formatCurrency(entidad.montoTotal)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No hay datos disponibles</p>
            )}
          </CardContent>
        </Card>

        {/* Proveedores con más dinero */}
        <Card className="shadow-md">
          <CardHeader className="bg-primary/5 pb-4">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="font-serif text-2xl">Top 10 Proveedores</CardTitle>
                <CardDescription>Las empresas que más dinero han ganado</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoadingRankings ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : rankings?.topProveedoresMonto && rankings.topProveedoresMonto.length > 0 ? (
              <div className="space-y-6">
                {rankings.topProveedoresMonto.map((prov, i) => (
                  <div key={prov.ruc} className="flex gap-4 items-center">
                    <div className="font-serif text-2xl font-bold text-muted-foreground/40 w-6 text-center">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/proveedores/${prov.ruc}`} className="hover:text-primary transition-colors block truncate font-medium">
                        {prov.razonSocial}
                      </Link>
                      <p className="text-sm text-muted-foreground">{prov.totalAdjudicaciones} contratos</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="font-bold text-lg text-primary">{formatCurrency(prov.montoTotal)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No hay datos disponibles</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <div className="pt-8">
        <h2 className="font-serif text-3xl font-bold text-accent mb-6 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-alerta" />
          Alertas Recientes
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Entidades con compras directas */}
          <Card className="border-alerta/30">
            <CardHeader>
              <CardTitle className="text-xl">Abuso de Compras "A Dedo"</CardTitle>
              <CardDescription>Entidades que más usan la "Contratación Directa" sin concurso abierto</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRankings ? (
                <div className="space-y-4">
                  {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : rankings?.entidadesMasDirectas && rankings.entidadesMasDirectas.length > 0 ? (
                <div className="space-y-4">
                  {rankings.entidadesMasDirectas.map((entidad, i) => (
                    <div key={entidad.ruc} className="flex gap-4 items-center bg-muted/50 p-3 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <Link href={`/entidades/${entidad.ruc}`} className="font-medium block truncate hover:underline">
                          {entidad.nombre}
                        </Link>
                      </div>
                      <Badge variant="destructive" className="bg-alerta border-transparent whitespace-nowrap">
                        {entidad.totalContrataciones} compras directas
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No hay alertas de este tipo</p>
              )}
            </CardContent>
          </Card>

          {/* Contrataciones con alertas específicas */}
          <Card className="border-alerta/30">
            <CardHeader>
              <CardTitle className="text-xl">Contratos bajo la Lupa</CardTitle>
              <CardDescription>Procesos con diferencias de precio o baja competencia</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAlertas ? (
                <div className="space-y-4">
                  {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : alertas && alertas.length > 0 ? (
                <div className="space-y-4">
                  {alertas.slice(0, 5).map((alerta) => (
                    <div key={alerta.ocid} className="bg-muted/50 p-4 rounded-lg border border-alerta/20 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-alerta"></div>
                      <Link href={`/contratacion/${alerta.ocid}`} className="block">
                        <Badge variant="outline" className="mb-2 border-alerta text-alerta-foreground text-xs">{alerta.tipoAlerta}</Badge>
                        <h4 className="font-bold line-clamp-1 mb-1 hover:text-primary">{alerta.titulo}</h4>
                        <p className="text-sm text-muted-foreground truncate">{alerta.entidadNombre}</p>
                        <p className="text-sm font-medium mt-2">{alerta.descripcionAlerta}</p>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No hay contratos alertados actualmente</p>
              )}
              
              <div className="mt-4 pt-4 border-t text-center">
                <Link href="/explorador?procedimiento=Contratación+Directa">
                  <Button variant="outline" className="w-full">Ver todas las compras directas en el Explorador</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
