import { useRoute } from "wouter";
import { useGetDistrito, getGetDistritoQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/formatters";
import { Building, TrendingUp, Download, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import { ContratacionCard } from "@/components/contratacion-card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Distrito() {
  const [, params] = useRoute("/distrito/:ubigeo");
  const ubigeo = params?.ubigeo;

  const { data: distrito, isLoading, error } = useGetDistrito(ubigeo || "", {
    query: {
      enabled: !!ubigeo,
      queryKey: getGetDistritoQueryKey(ubigeo || "")
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        <Skeleton className="h-16 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !distrito) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-bold text-destructive mb-4">Distrito no encontrado</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-muted-foreground uppercase tracking-wider text-sm font-medium">
            {distrito.departamento} &gt; {distrito.provincia}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-accent">
            {distrito.distrito}
          </h1>
        </div>
        <Button className="shrink-0" onClick={() => {
          // Trigger excel download
          const url = apiUrl(`/api/excel/generate?ubigeo=${distrito.codigo}`);
          window.location.href = url;
        }}>
          <Download className="mr-2 h-4 w-4" />
          Descargar Excel del Distrito
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-full">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Contratado</p>
              <p className="text-2xl font-bold">{formatCurrency(distrito.montoTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-accent/10 text-accent rounded-full">
              <HardHat className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Contrataciones</p>
              <p className="text-2xl font-bold">{distrito.totalContrataciones}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-exito/10 text-exito rounded-full">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Monto este año</p>
              <p className="text-2xl font-bold">{formatCurrency(distrito.montoEsteAnio)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Charts */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">Evolución Mensual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {distrito.evolucionMensual && distrito.evolucionMensual.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={distrito.evolucionMensual} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="periodo" />
                      <YAxis tickFormatter={(val) => `S/ ${(val/1000000).toFixed(0)}M`} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), "Monto"]} />
                      <Area type="monotone" dataKey="montoTotal" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMonto)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Sin datos suficientes</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="recientes">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="recientes">Contrataciones Recientes</TabsTrigger>
              <TabsTrigger value="top">Top Proveedores</TabsTrigger>
            </TabsList>
            <TabsContent value="recientes" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {distrito.contratacionesRecientes?.map(c => (
                  <ContratacionCard key={c.ocid} contratacion={c} />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="top" className="mt-6">
              <div className="h-[400px] w-full bg-card border rounded-lg p-6">
                {distrito.topProveedores && distrito.topProveedores.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={distrito.topProveedores} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" tickFormatter={(val) => `S/ ${(val/1000000).toFixed(0)}M`} />
                      <YAxis dataKey="razonSocial" type="category" width={150} tick={{fontSize: 12}} />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), "Monto"]} />
                      <Bar dataKey="montoTotal" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Sin datos suficientes</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">Por Tipo de Compra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                {distrito.distribucionTipo && distrito.distribucionTipo.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distrito.distribucionTipo}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="monto"
                      >
                        {distrito.distribucionTipo.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Sin datos suficientes</div>
                )}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {distrito.distribucionTipo?.map((t, i) => (
                  <div key={t.tipo} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                      <span>{t.tipo}</span>
                    </div>
                    <span className="font-medium">{t.porcentaje.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
