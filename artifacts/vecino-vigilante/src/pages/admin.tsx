import { useState } from "react";
import { useGetStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw,
  Database,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Globe,
  Upload,
  Info,
} from "lucide-react";

type SyncResult = {
  message?: string;
  estado?: string;
  estrategia?: string;
  duracionSegundos?: number;
  paginasRecorridas?: number;
  juninEncontrados?: number;
  registrosProcesados?: number;
  registrosNuevos?: number;
  registrosActualizados?: number;
  erroresCount?: number;
  mensaje?: string;
  error?: string;
  // seed-demo specific
  entidades?: number;
  proveedores?: number;
  contrataciones?: { insertadas: number; omitidas: number };
};

export default function Admin() {
  const { data: stats, refetch: refetchStats, isLoading: isLoadingStats } = useGetStats();
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [syncLog, setSyncLog] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"status" | "sync" | "upload">("status");

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setSyncLog("Iniciando sincronización con OSCE...\n");
    try {
      const res = await fetch(`${apiBaseUrl}/api/sync`, { method: "GET" });
      const data = await res.json() as SyncResult;
      setSyncResult(data);
      setSyncLog((prev) => prev + `\n✅ Sincronización completada`);
      refetchStats();
    } catch (err) {
      setSyncResult({ error: String(err) });
      setSyncLog((prev) => prev + `\n❌ Error: ${String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    setSyncResult(null);
    setSyncLog("Cargando datos de demostración...\n");
    try {
      const res = await fetch(`${apiBaseUrl}/api/sync/seed-demo`, { method: "POST" });
      const data = await res.json() as SyncResult;
      setSyncResult(data);
      setSyncLog((prev) => prev + `\n✅ Datos demo cargados`);
      refetchStats();
    } catch (err) {
      setSyncResult({ error: String(err) });
      setSyncLog((prev) => prev + `\n❌ Error: ${String(err)}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const isWorking = isSyncing || isSeeding;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-accent mb-2">Panel de Administración</h1>
        <p className="text-muted-foreground text-lg">
          Gestiona la sincronización de datos con las APIs del OSCE/SEACE
        </p>
      </div>

      {/* Estado actual */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Contrataciones"
          value={isLoadingStats ? "..." : (stats?.totalContrataciones?.toLocaleString("es-PE") ?? "0")}
          icon={<Database className="h-4 w-4" />}
        />
        <StatCard
          label="Entidades"
          value={isLoadingStats ? "..." : (stats?.entidadesActivas?.toString() ?? "0")}
          icon={<Globe className="h-4 w-4" />}
        />
        <StatCard
          label="Proveedores"
          value={isLoadingStats ? "..." : (stats?.proveedoresUnicos?.toString() ?? "0")}
          icon={<Database className="h-4 w-4" />}
        />
        <StatCard
          label="Última sync"
          value={
            stats?.ultimaSincronizacion
              ? new Date(stats.ultimaSincronizacion).toLocaleDateString("es-PE")
              : "Nunca"
          }
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {[
          { key: "status", label: "Estado" },
          { key: "sync", label: "Sincronizar" },
          { key: "upload", label: "Carga manual" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Estado */}
      {activeTab === "status" && (
        <div className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>¿Por qué la web aparece con datos vacíos?</strong>
              <br />
              La API pública del OSCE (<code className="text-xs bg-blue-100 px-1 rounded">contratacionesabiertas.osce.gob.pe</code>)
              solo es accesible desde servidores con IP peruana. Si tu servidor está en otro país (Render, AWS us-east, etc.),
              las solicitudes son bloqueadas por geofiltro.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Diagnóstico del sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DiagItem
                title="Base de datos"
                status={stats?.totalContrataciones ? "ok" : "warning"}
                detail={
                  stats?.totalContrataciones
                    ? `${stats.totalContrataciones} contratos registrados`
                    : "Sin datos. Ejecuta una sincronización."
                }
              />
              <DiagItem
                title="API OSCE OCDS"
                status="warning"
                detail="Puede estar bloqueada si el servidor está fuera de Perú. Usa la opción 'Datos Demo' para probar la web."
              />
              <DiagItem
                title="Base de datos conectada"
                status={stats !== undefined ? "ok" : "error"}
                detail={stats !== undefined ? "La base de datos responde correctamente" : "Error de conexión a la BD"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Soluciones disponibles</CardTitle>
              <CardDescription>Elige la opción que mejor se adapte a tu situación</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <SolutionItem
                  emoji="🇵🇪"
                  title="Servidor en Perú"
                  description="Despliega el backend en un servidor con IP peruana (AWS Lima, DigitalOcean São Paulo, etc.) y la API OCDS funcionará directamente."
                  badge="Recomendado para producción"
                  badgeColor="green"
                />
                <SolutionItem
                  emoji="🎭"
                  title="Datos de demostración"
                  description="Carga 12 contratos de ejemplo con entidades y proveedores reales de Chanchamayo para ver la web funcionando ahora."
                  badge="Para probar la web"
                  badgeColor="blue"
                />
                <SolutionItem
                  emoji="📤"
                  title="Carga manual OCDS"
                  description="Descarga manualmente el JSON de contrataciones desde datosabiertos.seace.gob.pe y súbelo vía la pestaña 'Carga manual'."
                  badge="Avanzado"
                  badgeColor="orange"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Sincronizar */}
      {activeTab === "sync" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Sincronización Automática
              </CardTitle>
              <CardDescription>
                Intenta conectarse a la API OCDS del OSCE. Si no está disponible, prueba la descarga de archivos masivos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleSync}
                disabled={isWorking}
                className="w-full"
                size="lg"
              >
                {isSyncing ? (
                  <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Sincronizando...</>
                ) : (
                  <><RefreshCw className="mr-2 h-4 w-4" /> Iniciar sincronización con OSCE</>
                )}
              </Button>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Cargar datos de demostración
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Inserta 12 contrataciones reales de Chanchamayo para ver la web funcionando de inmediato.
                  Solo afecta si la base de datos está vacía (no sobreescribe datos existentes).
                </p>
                <Button
                  variant="outline"
                  onClick={handleSeedDemo}
                  disabled={isWorking}
                  className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                >
                  {isSeeding ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Cargando datos demo...</>
                  ) : (
                    <><Zap className="mr-2 h-4 w-4" /> Cargar datos de demostración</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Log / Resultado */}
          {(syncLog || syncResult) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resultado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {syncResult && !syncResult.error && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {syncResult.registrosNuevos !== undefined && (
                      <ResultMetric label="Nuevos" value={syncResult.registrosNuevos} color="green" />
                    )}
                    {syncResult.registrosActualizados !== undefined && (
                      <ResultMetric label="Actualizados" value={syncResult.registrosActualizados} color="blue" />
                    )}
                    {syncResult.contrataciones && (
                      <ResultMetric label="Insertadas" value={syncResult.contrataciones.insertadas} color="green" />
                    )}
                    {syncResult.duracionSegundos !== undefined && (
                      <ResultMetric label="Duración (s)" value={syncResult.duracionSegundos} />
                    )}
                    {syncResult.juninEncontrados !== undefined && (
                      <ResultMetric label="De Junín" value={syncResult.juninEncontrados} />
                    )}
                    {syncResult.erroresCount !== undefined && (
                      <ResultMetric label="Errores" value={syncResult.erroresCount} color={syncResult.erroresCount > 0 ? "red" : "green"} />
                    )}
                  </div>
                )}

                {syncResult?.mensaje && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800 text-xs">
                      {syncResult.mensaje}
                    </AlertDescription>
                  </Alert>
                )}

                {syncResult?.error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 text-xs">
                      Error: {syncResult.error}
                    </AlertDescription>
                  </Alert>
                )}

                {syncResult?.estado && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Estado:</span>
                    <Badge
                      className={
                        syncResult.estado === "OK"
                          ? "bg-green-100 text-green-800"
                          : syncResult.estado === "PARCIAL"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }
                    >
                      {syncResult.estado}
                    </Badge>
                    {syncResult.estrategia && (
                      <Badge variant="outline" className="text-xs">
                        Vía: {syncResult.estrategia}
                      </Badge>
                    )}
                  </div>
                )}

                {syncResult?.message && !syncResult.error && (
                  <p className="text-sm text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {syncResult.message}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Carga manual */}
      {activeTab === "upload" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Carga Manual de Datos OCDS
              </CardTitle>
              <CardDescription>
                Si la API está bloqueada, descarga el JSON del SEACE y súbelo aquí
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  <strong>Cómo obtener los datos manualmente:</strong>
                  <ol className="mt-2 space-y-1 list-decimal list-inside text-xs">
                    <li>Visita <a href="https://contratacionesabiertas.osce.gob.pe/descargas" target="_blank" rel="noopener" className="underline">contratacionesabiertas.osce.gob.pe/descargas</a></li>
                    <li>Descarga el archivo JSON de contrataciones de Junín</li>
                    <li>Usa la API <code className="bg-blue-100 px-1 rounded">POST /api/sync/upload</code> con el JSON</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="bg-muted rounded-lg p-4 text-sm">
                <p className="font-medium mb-2">Ejemplo de uso con curl:</p>
                <pre className="text-xs overflow-x-auto bg-background p-3 rounded border">
{`curl -X POST ${apiBaseUrl || "https://tu-api.onrender.com"}/api/sync/upload \\
  -H "Content-Type: application/json" \\
  -H "x-sync-secret: TU_SYNC_SECRET" \\
  -d @archivo-contrataciones-junin.json`}
                </pre>
              </div>

              <div className="bg-muted rounded-lg p-4 text-sm">
                <p className="font-medium mb-2">Formato esperado del JSON:</p>
                <pre className="text-xs overflow-x-auto bg-background p-3 rounded border">
{`{
  "releases": [
    {
      "ocid": "ocds-...",
      "tender": { ... },
      "awards": [ ... ],
      "buyer": { ... }
    }
  ],
  "filtrarJunin": true
}`}
                </pre>
              </div>

              <p className="text-xs text-muted-foreground">
                También puedes usar la API de archivos masivos del OSCE directamente:
                <br />
                <code className="bg-muted px-1 rounded">GET /api/sync</code> — dispara la sincronización automática
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Componentes auxiliares ─────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="border-none shadow-sm bg-white">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function DiagItem({
  title,
  status,
  detail,
}: {
  title: string;
  status: "ok" | "warning" | "error";
  detail: string;
}) {
  const icons = {
    ok: <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />,
    warning: <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />,
  };
  return (
    <div className="flex items-start gap-3">
      {icons[status]}
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function SolutionItem({
  emoji,
  title,
  description,
  badge,
  badgeColor,
}: {
  emoji: string;
  title: string;
  description: string;
  badge: string;
  badgeColor: "green" | "blue" | "orange";
}) {
  const colors = {
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-800",
    orange: "bg-orange-100 text-orange-800",
  };
  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-muted/30">
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold">{title}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${colors[badgeColor]}`}>
            {badge}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ResultMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "green" | "blue" | "red";
}) {
  const colorClasses = {
    green: "text-green-700",
    blue: "text-blue-700",
    red: "text-red-700",
  };
  return (
    <div className="bg-muted rounded-lg p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${color ? colorClasses[color] : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
