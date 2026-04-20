import { useRoute } from "wouter";
import { useGetEntidad, getGetEntidadQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { MapPin, TrendingUp, FileText, CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContratacionCard } from "@/components/contratacion-card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Entidad() {
  const [, params] = useRoute("/entidades/:ruc");
  const ruc = params?.ruc;

  const { data: entidad, isLoading, error } = useGetEntidad(ruc || "", {
    query: {
      enabled: !!ruc,
      queryKey: getGetEntidadQueryKey(ruc || "")
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        <Skeleton className="h-20 w-3/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !entidad) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-bold text-destructive mb-4">Entidad no encontrada</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex gap-3 items-center flex-wrap">
          <Badge variant="outline" className="font-mono text-base px-3 py-1 bg-muted">{entidad.ruc}</Badge>
          {entidad.nivelGobierno && (
            <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
              {entidad.nivelGobierno}
            </Badge>
          )}
          {entidad.tipo && (
            <Badge variant="outline">
              {entidad.tipo}
            </Badge>
          )}
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-accent leading-tight">
          {entidad.nombre}
        </h1>
        {entidad.ubigeo && (
          <p className="flex items-center gap-2 text-muted-foreground text-lg">
            <MapPin className="h-5 w-5" />
            {entidad.ubigeo.distrito}, {entidad.ubigeo.provincia}, {entidad.ubigeo.departamento}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary text-white rounded-xl">
                <TrendingUp className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Monto Histórico Contratado</p>
            </div>
            <p className="text-4xl font-bold text-primary">{formatCurrency(entidad.montoTotal)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-accent/10 text-accent rounded-xl">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Procesos Realizados</p>
            </div>
            <p className="text-4xl font-bold">{entidad.totalContrataciones}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-exito/10 text-exito rounded-xl">
                <CalendarCheck className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Procesos este año</p>
            </div>
            <p className="text-4xl font-bold">{entidad.contratacionesEsteAnio}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-4">
            <h2 className="font-serif text-3xl font-bold text-accent">Últimas Contrataciones</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entidad.contratacionesRecientes?.map(c => (
                <ContratacionCard key={c.ocid} contratacion={c} />
              ))}
            </div>
            {(!entidad.contratacionesRecientes || entidad.contratacionesRecientes.length === 0) && (
              <p className="text-muted-foreground p-8 bg-muted rounded-xl text-center">No hay contrataciones recientes registradas para esta entidad.</p>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">¿Qué compran?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                {entidad.distribucionTipo && entidad.distribucionTipo.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={entidad.distribucionTipo}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="monto"
                      >
                        {entidad.distribucionTipo.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sin datos suficientes</div>
                )}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {entidad.distribucionTipo?.map((t, i) => (
                  <div key={t.tipo} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                      <span className="truncate max-w-[120px]">{t.tipo}</span>
                    </div>
                    <span className="font-medium text-right ml-2">{formatCurrency(t.monto)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">Principales Proveedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {entidad.topProveedores?.map((prov, i) => (
                  <div key={prov.ruc} className="flex gap-4 items-start">
                    <div className="font-serif text-2xl font-bold text-muted-foreground/50 w-6 shrink-0">{i + 1}</div>
                    <div className="min-w-0">
                      <p className="font-medium leading-tight truncate">{prov.razonSocial}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-sm text-muted-foreground">{prov.totalAdjudicaciones} contr.</p>
                        <p className="font-bold text-primary ml-2">{formatCurrency(prov.montoTotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {(!entidad.topProveedores || entidad.topProveedores.length === 0) && (
                  <p className="text-muted-foreground text-sm text-center py-4">No hay datos de proveedores.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
