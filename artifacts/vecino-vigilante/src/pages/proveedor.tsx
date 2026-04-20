import { useRoute } from "wouter";
import { useGetProveedor, getGetProveedorQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { Building, MapPin, CheckCircle, TrendingUp, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContratacionCard } from "@/components/contratacion-card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Proveedor() {
  const [, params] = useRoute("/proveedores/:ruc");
  const ruc = params?.ruc;

  const { data: proveedor, isLoading, error } = useGetProveedor(ruc || "", {
    query: {
      enabled: !!ruc,
      queryKey: getGetProveedorQueryKey(ruc || "")
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

  if (error || !proveedor) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-bold text-destructive mb-4">Proveedor no encontrado</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex gap-3 items-center">
          <Badge variant="outline" className="font-mono text-base px-3 py-1 bg-muted">{proveedor.ruc}</Badge>
          {proveedor.vigenteRnp === "SI" ? (
            <Badge variant="secondary" className="bg-exito/10 text-exito border-exito/20">
              <CheckCircle className="w-3 h-3 mr-1" /> RNP Vigente
            </Badge>
          ) : (
            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
              RNP No Vigente
            </Badge>
          )}
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-accent leading-tight">
          {proveedor.razonSocial}
        </h1>
        {proveedor.ubigeo && (
          <p className="flex items-center gap-2 text-muted-foreground text-lg">
            <MapPin className="h-5 w-5" />
            {proveedor.ubigeo.distrito}, {proveedor.ubigeo.provincia}, {proveedor.ubigeo.departamento}
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
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Monto Histórico Ganado</p>
            </div>
            <p className="text-4xl font-bold text-primary">{formatCurrency(proveedor.montoTotalGanado)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-accent/10 text-accent rounded-xl">
                <Award className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Adjudicaciones Totales</p>
            </div>
            <p className="text-4xl font-bold">{proveedor.totalAdjudicaciones}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-muted text-muted-foreground rounded-xl">
                <Building className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Entidades Clientes</p>
            </div>
            <p className="text-4xl font-bold">{proveedor.entidadesUnicas || 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Evolución de Ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {proveedor.evolucionMensual && proveedor.evolucionMensual.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={proveedor.evolucionMensual} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMontoProv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="periodo" />
                      <YAxis tickFormatter={(val) => `S/ ${(val/1000).toFixed(0)}k`} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), "Monto"]} />
                      <Area type="monotone" dataKey="montoTotal" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMontoProv)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Sin datos suficientes</div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="font-serif text-3xl font-bold text-accent">Contrataciones Recientes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proveedor.adjudicacionesRecientes?.map(c => (
                <ContratacionCard key={c.ocid} contratacion={c} />
              ))}
            </div>
            {(!proveedor.adjudicacionesRecientes || proveedor.adjudicacionesRecientes.length === 0) && (
              <p className="text-muted-foreground p-8 bg-muted rounded-xl text-center">No hay contrataciones recientes para mostrar.</p>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">Principales Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {proveedor.topEntidades?.map((entidad, i) => (
                  <div key={entidad.ruc} className="flex gap-4 items-start">
                    <div className="font-serif text-2xl font-bold text-muted-foreground/50 w-6 shrink-0">{i + 1}</div>
                    <div>
                      <p className="font-medium leading-tight">{entidad.nombre}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-sm text-muted-foreground">{entidad.totalContrataciones} contratos</p>
                        <p className="font-bold text-primary">{formatCurrency(entidad.montoTotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {(!proveedor.topEntidades || proveedor.topEntidades.length === 0) && (
                  <p className="text-muted-foreground text-sm text-center py-4">No hay datos de clientes.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
