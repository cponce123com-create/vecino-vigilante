import { useState } from "react";
import { useGetRankings, getGetRankingsQueryKey, useGetAlertas, getGetAlertasQueryKey, useGetObservadas, getGetObservadasQueryKey, useGetTipoDistribucion, getGetTipoDistribucionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Link } from "wouter";
import { AlertTriangle, Building2, Users, Eye, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TIPO_MAPPING, PROCEDIMIENTO_MAPPING } from "@/lib/constants";

const TIPO_COLORS: Record<string, string> = {
  OBRAS: "#2563eb",
  SERVICIOS: "#16a34a",
  BIENES: "#d97706",
  CONSULTORIA: "#7c3aed",
};

export default function Observatorio() {
  const [obsPage, setObsPage] = useState(1);
  const { data: rankings, isLoading: isLoadingRankings } = useGetRankings({}, { query: { queryKey: getGetRankingsQueryKey({}) } });
  const { data: alertas, isLoading: isLoadingAlertas } = useGetAlertas({}, { query: { queryKey: getGetAlertasQueryKey({}) } });
  const { data: observadas, isLoading: isLoadingObservadas } = useGetObservadas(
    { page: obsPage, limit: 10 },
    { query: { queryKey: getGetObservadasQueryKey({ page: obsPage, limit: 10 }) } }
  );
  const { data: tipoDistrib } = useGetTipoDistribucion({}, { query: { queryKey: getGetTipoDistribucionQueryKey({}) } });

  const chartData = (tipoDistrib ?? []).map((t) => ({
    name: TIPO_MAPPING[t.tipo] ?? t.tipo,
    value: t.total,
    monto: t.monto,
    tipo: t.tipo,
  }));

  return (
    <div className="container mx-auto px-4 py-10 space-y-12">
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-accent">Observatorio de Transparencia</h1>
        <p className="text-lg text-muted-foreground">
          Rankings, indicadores y alertas sobre cómo se gasta el dinero público en la región.
          Datos para vigilar e investigar.
        </p>
      </div>

      {/* ── Distribución por Tipo ─────────────────────────────────── */}
      {chartData.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="font-serif text-2xl">¿En qué se gasta el dinero?</CardTitle>
                <CardDescription>Distribución por tipo de contratación: obras, bienes, servicios y consultoría</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {chartData.map((entry) => (
                      <Cell key={entry.tipo} fill={TIPO_COLORS[entry.tipo] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} contratos`, "Cantidad"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {chartData.map((t) => (
                  <div key={t.tipo} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: TIPO_COLORS[t.tipo] ?? "#94a3b8" }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{TIPO_MAPPING[t.tipo] ?? t.tipo}</p>
                      <p className="text-xs text-muted-foreground">{t.value} contratos</p>
                    </div>
                    {t.monto != null && (
                      <p className="text-sm font-bold shrink-0">{formatCurrency(t.monto)}</p>
                    )}
                  </div>
                ))}
                <Link href="/explorador">
                  <Button variant="outline" size="sm" className="w-full mt-2">Ver en el Explorador</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Contrataciones Observadas ─────────────────────────────── */}
      <div>
        <h2 className="font-serif text-3xl font-bold text-accent mb-2 flex items-center gap-3">
          <Eye className="h-8 w-8 text-primary" />
          Contrataciones Observadas
        </h2>
        <p className="text-muted-foreground mb-6">
          Procesos de contratación que recibieron observaciones formales durante la convocatoria. Las observaciones son
          impugnaciones o cuestionamientos presentados por postores o ciudadanos ante el organismo contratante.
        </p>

        <Card>
          <CardContent className="p-0">
            {isLoadingObservadas ? (
              <div className="p-6 space-y-4">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : observadas && observadas.data.length > 0 ? (
              <>
                <div className="divide-y">
                  {observadas.data.map((item) => (
                    <div key={item.ocid} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-2 mb-1">
                            <Badge variant="outline" className="border-orange-400 text-orange-700 bg-orange-50 text-xs">
                              {item.observacionesCount ?? 0} observación{(item.observacionesCount ?? 0) !== 1 ? "es" : ""}
                            </Badge>
                            {item.tipo && (
                              <Badge variant="secondary" className="text-xs">{TIPO_MAPPING[item.tipo] ?? item.tipo}</Badge>
                            )}
                            {item.estado && (
                              <Badge variant="outline" className="text-xs">{item.estado}</Badge>
                            )}
                          </div>
                          <Link href={`/contratacion/${item.ocid}`} className="font-medium hover:text-primary transition-colors block truncate">
                            {item.titulo}
                          </Link>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-muted-foreground">
                            {item.entidadNombre && <span>{item.entidadNombre}</span>}
                            {item.ubigeoDistrito && <span>{item.ubigeoDistrito}</span>}
                            {item.fechaConvocatoria && <span>{formatDate(item.fechaConvocatoria)}</span>}
                          </div>
                        </div>
                        {item.montoAdjudicado != null && (
                          <p className="text-sm font-bold shrink-0">{formatCurrency(item.montoAdjudicado)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {(observadas.pages ?? 1) > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      {observadas.total} contratos observados · página {obsPage} de {observadas.pages}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={obsPage <= 1} onClick={() => setObsPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={obsPage >= (observadas.pages ?? 1)} onClick={() => setObsPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No hay contrataciones observadas en la base de datos</p>
                <p className="text-sm mt-1">Las observaciones se importan cuando subes el archivo <strong>Ent_Observaciones.csv</strong> del ZIP de OECE.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Rankings ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

      {/* ── Alertas ───────────────────────────────────────────────── */}
      <div className="pt-8">
        <h2 className="font-serif text-3xl font-bold text-accent mb-6 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-alerta" />
          Alertas Recientes
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  {rankings.entidadesMasDirectas.map((entidad) => (
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
                <Link href="/explorador?procedimiento=Contrataci%C3%B3n+Directa">
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
