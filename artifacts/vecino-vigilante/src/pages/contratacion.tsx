import { useRoute } from "wouter";
import { useGetContratacion, getGetContratacionQueryKey } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ESTADO_MAPPING, TIPO_MAPPING, PROCEDIMIENTO_MAPPING } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Building, MapPin, ExternalLink, Calendar, Users,
  AlertTriangle, Info, Share2, FileText, Clock, ArrowLeft,
  TrendingDown, TrendingUp, Package, ShoppingCart, Hash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Articulo {
  id: string;
  ocid: string;
  posicion: number | null;
  descripcion: string;
  clasificacionId: string | null;
  clasificacionDesc: string | null;
  cantidad: number | null;
  unidadNombre: string | null;
  montoTotal: number | null;
  moneda: string | null;
  estado: string | null;
}

function useArticulos(ocid: string) {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ocid) return;
    setLoading(true);
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
    fetch(`${apiBase}/api/contrataciones/${encodeURIComponent(ocid)}/articulos`)
      .then((r) => r.json())
      .then((data) => { setArticulos(Array.isArray(data) ? data : []); })
      .catch(() => setArticulos([]))
      .finally(() => setLoading(false));
  }, [ocid]);

  return { articulos, loading };
}

export default function ContratacionDetalle() {
  const [, params] = useRoute("/contratacion/:ocid");
  const ocid = params?.ocid;

  const { data, isLoading, error } = useGetContratacion(ocid || "", {
    query: { enabled: !!ocid, queryKey: getGetContratacionQueryKey(ocid || "") },
  });

  const { articulos, loading: loadingArticulos } = useArticulos(ocid || "");

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-16 w-full max-w-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-bold text-destructive mb-4">Contratación no encontrada</h1>
        <p className="text-muted-foreground">La contratación que buscas no existe o ha ocurrido un error.</p>
        <Link href="/explorador">
          <Button className="mt-6" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al explorador
          </Button>
        </Link>
      </div>
    );
  }

  const isDirecta = data.procedimiento === "Contratación Directa" || data.procedimiento === "CD";

  const diferenciaMonto =
    data.montoReferencial && data.montoAdjudicado
      ? ((data.montoAdjudicado - data.montoReferencial) / data.montoReferencial) * 100
      : null;

  const raw = data.rawOcds as Record<string, string> | null;
  const fuente = raw?.["Entrega compilada:Licitación:Fuente de financiamiento"] || null;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: data.titulo, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-6xl">

      {/* Breadcrumb */}
      <Link href="/explorador">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Volver al explorador
        </button>
      </Link>

      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {data.nomenclatura && (
            <Badge variant="outline" className="text-sm bg-muted font-medium">{data.nomenclatura}</Badge>
          )}
          <Badge variant="secondary" className="text-sm">
            {TIPO_MAPPING[data.tipo || ""] || data.tipo}
          </Badge>
          <Badge variant="default" className="text-sm bg-accent text-white">
            {ESTADO_MAPPING[data.estado || ""] || data.estado}
          </Badge>
          {isDirecta && (
            <Badge variant="destructive" className="text-sm bg-alerta border-transparent">
              <AlertTriangle className="h-3 w-3 mr-1" /> Sin competencia
            </Badge>
          )}
        </div>
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-accent leading-tight">
          {data.titulo}
        </h1>
        {data.descripcion && (
          <p className="text-lg text-muted-foreground max-w-4xl">{data.descripcion}</p>
        )}
      </header>

      {/* Traducción ciudadana */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-alerta" />
        <div className="flex items-start gap-4">
          <div className="bg-yellow-100 p-2 rounded-full shrink-0">
            <Info className="h-6 w-6 text-alerta" />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif text-xl font-bold text-yellow-900">Traducción ciudadana</h3>
            <p className="text-yellow-800 leading-relaxed">
              La entidad <strong>{data.entidadNombre}</strong> realizó un proceso de{" "}
              <strong>{PROCEDIMIENTO_MAPPING[data.procedimiento || ""]?.split("(")[0].trim().toLowerCase() || data.procedimiento?.toLowerCase()}</strong>{" "}
              para contratar <strong>{TIPO_MAPPING[data.tipo || ""]?.toLowerCase() || data.tipo?.toLowerCase()}</strong>.{" "}
              {data.proveedorNombre
                ? <>El ganador fue <strong>{data.proveedorNombre}</strong> por <strong>{formatCurrency(data.montoAdjudicado)}</strong>.</>
                : <>Aún no se ha adjudicado.</>}
            </p>
            {isDirecta && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded-md w-fit">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">Alerta: compra sin proceso competitivo abierto.</span>
              </div>
            )}
            {diferenciaMonto !== null && Math.abs(diferenciaMonto) > 5 && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md w-fit text-sm font-medium ${diferenciaMonto > 0 ? "text-destructive bg-destructive/10" : "text-green-700 bg-green-50"}`}>
                {diferenciaMonto > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                El monto adjudicado fue un {Math.abs(diferenciaMonto).toFixed(1)}%{" "}
                {diferenciaMonto > 0 ? "mayor" : "menor"} al referencial.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* Columna izquierda */}
        <div className="lg:col-span-2 space-y-8">

          {/* Montos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-1">Monto adjudicado</p>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(data.montoAdjudicado || data.montoReferencial)}
                </p>
                {data.montoReferencial && data.montoAdjudicado && data.montoReferencial !== data.montoAdjudicado && (
                  <p className="text-sm text-muted-foreground mt-2">Referencial: {formatCurrency(data.montoReferencial)}</p>
                )}
                {data.plazoEjecucionDias && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Plazo: {data.plazoEjecucionDias} días
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Entidad que contrata</p>
                  <Link href={`/entidades/${data.entidadRuc}`}>
                    <p className="font-medium flex items-start gap-2 hover:text-primary transition-colors cursor-pointer">
                      <Building className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>{data.entidadNombre}</span>
                    </p>
                  </Link>
                </div>
                {data.proveedorNombre && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Proveedor ganador</p>
                    <Link href={`/proveedores/${data.proveedorRuc}`}>
                      <p className="font-medium flex items-start gap-2 hover:text-primary transition-colors cursor-pointer">
                        <Users className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span>{data.proveedorNombre}</span>
                      </p>
                    </Link>
                    {data.proveedorRuc && (
                      <p className="text-xs text-muted-foreground mt-1 ml-7">RUC: {data.proveedorRuc}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── ARTÍCULOS ADJUDICADOS ── */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Qué se compró exactamente
                {articulos.length > 0 && (
                  <Badge variant="secondary" className="ml-2 font-normal">
                    {articulos.length} {articulos.length === 1 ? "ítem" : "ítems"}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingArticulos ? (
                <div className="space-y-3">
                  {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : articulos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay desglose de artículos disponible para esta contratación.</p>
                  <p className="text-xs mt-1">Los artículos se importan desde el archivo Ent_Adj_ArticulosAdjudicados.csv</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2.5 font-medium w-8">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                        </th>
                        <th className="text-left px-3 py-2.5 font-medium">Descripción</th>
                        <th className="text-left px-3 py-2.5 font-medium w-28">Clasificación</th>
                        <th className="text-right px-3 py-2.5 font-medium w-24">Cantidad</th>
                        <th className="text-right px-3 py-2.5 font-medium w-32">Monto total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {articulos.map((art, i) => (
                        <tr key={art.id} className={`border-b last:border-0 ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                          <td className="px-3 py-3 text-muted-foreground text-xs">
                            {art.posicion ?? i + 1}
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium leading-snug">{art.descripcion}</p>
                            {art.clasificacionDesc && art.clasificacionDesc !== art.descripcion && (
                              <p className="text-xs text-muted-foreground mt-0.5">{art.clasificacionDesc}</p>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {art.clasificacionId && (
                              <span className="text-xs font-mono text-muted-foreground">{art.clasificacionId}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-medium">{art.cantidad != null ? art.cantidad.toLocaleString("es-PE") : "—"}</span>
                            {art.unidadNombre && (
                              <span className="text-xs text-muted-foreground ml-1">{art.unidadNombre}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-bold">
                            {art.montoTotal != null ? formatCurrency(art.montoTotal) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {articulos.length > 1 && (
                      <tfoot>
                        <tr className="border-t-2 bg-muted/20">
                          <td colSpan={4} className="px-3 py-2.5 text-right text-sm font-medium text-muted-foreground">
                            Total ítems
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-base">
                            {formatCurrency(articulos.reduce((sum, a) => sum + (a.montoTotal ?? 0), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Línea de tiempo */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Línea de tiempo del proceso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-primary text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-foreground">Convocatoria</h4>
                      <time className="text-sm font-medium text-primary">{formatDate(data.fechaConvocatoria)}</time>
                    </div>
                    <p className="text-sm text-muted-foreground">La entidad publicó la necesidad de contratar.</p>
                  </div>
                </div>

                {(data.fechaAdjudicacion || data.estado === "ADJUDICADO" || data.estado === "CONTRATADO") && (
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-accent text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-card shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-foreground">Adjudicación</h4>
                        <time className="text-sm font-medium text-accent">{formatDate(data.fechaAdjudicacion)}</time>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Se seleccionó al proveedor ganador.
                        {data.proveedorNombre && <> Ganó: <strong>{data.proveedorNombre}</strong>.</>}
                      </p>
                    </div>
                  </div>
                )}

                {(data.fechaContrato || data.estado === "CONTRATADO" || data.estado === "FINALIZADO") && (
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-green-600 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-card shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-foreground">Firma de contrato</h4>
                        <time className="text-sm font-medium text-green-600">{formatDate(data.fechaContrato)}</time>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {data.plazoEjecucionDias
                          ? `Plazo de ejecución: ${data.plazoEjecucionDias} días.`
                          : "Contrato firmado con el proveedor."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="font-serif text-xl">Acciones ciudadanas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="default" onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" /> Compartir esta página
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <a href={`mailto:denuncias@osce.gob.pe?subject=Reporte: ${data.nomenclatura || data.ocid}&body=Anomalía en: ${window.location.href}`}>
                  <AlertTriangle className="mr-2 h-4 w-4 text-alerta" /> Reportar anomalía al OSCE
                </a>
              </Button>
              <div className="pt-3 border-t">
                <Button className="w-full justify-start" variant="secondary" asChild>
                  <a href="https://buscadorpublico.seace.gob.pe/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Ver expediente en SEACE
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-serif text-xl">Datos técnicos</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">OCID</p>
                <p className="font-mono text-xs break-all bg-muted px-2 py-1.5 rounded">{data.ocid}</p>
              </div>
              {(data.ubigeoDistrito || data.ubigeoProvincia) && (
                <div className="flex justify-between items-center py-2 border-t">
                  <span className="text-muted-foreground">Ubicación</span>
                  <span className="flex items-center gap-1 font-medium">
                    <MapPin className="h-3 w-3" />
                    {data.ubigeoDistrito}{data.ubigeoProvincia ? `, ${data.ubigeoProvincia}` : ""}
                  </span>
                </div>
              )}
              {fuente && (
                <div className="flex justify-between items-center py-2 border-t">
                  <span className="text-muted-foreground">Financiamiento</span>
                  <span className="font-medium text-right max-w-[60%]">{fuente}</span>
                </div>
              )}
              {data.entidadRuc && (
                <div className="flex justify-between items-center py-2 border-t">
                  <span className="text-muted-foreground">RUC entidad</span>
                  <span className="font-mono font-medium">{data.entidadRuc}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-t">
                <span className="text-muted-foreground">Procedimiento</span>
                <span className="font-medium">{data.procedimiento}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
