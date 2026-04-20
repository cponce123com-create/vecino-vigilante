import { useRoute } from "wouter";
import { useGetContratacion, getGetContratacionQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ESTADO_MAPPING, TIPO_MAPPING, PROCEDIMIENTO_MAPPING } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, MapPin, ExternalLink, Calendar, Users, AlertTriangle, Info, Share2, Facebook, Twitter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContratacionDetalle() {
  const [, params] = useRoute("/contratacion/:ocid");
  const ocid = params?.ocid;

  const { data, isLoading, error } = useGetContratacion(ocid || "", {
    query: {
      enabled: !!ocid,
      queryKey: getGetContratacionQueryKey(ocid || "")
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        <Skeleton className="h-10 w-32" />
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
      </div>
    );
  }

  const isDirecta = data.procedimiento === "Contratación Directa" || data.procedimiento === "CD";

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: data.titulo,
        text: `Mira esta contratación pública: ${data.titulo}`,
        url: window.location.href,
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="text-sm bg-muted font-medium">
            {data.nomenclatura || "Sin nomenclatura"}
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {TIPO_MAPPING[data.tipo || ""] || data.tipo}
          </Badge>
          <Badge variant="default" className="text-sm bg-accent text-white">
            {ESTADO_MAPPING[data.estado || ""] || data.estado}
          </Badge>
        </div>
        
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-accent leading-tight">
          {data.titulo}
        </h1>
        
        {data.descripcion && (
          <p className="text-lg text-muted-foreground max-w-4xl">
            {data.descripcion}
          </p>
        )}
      </header>

      {/* Traducción Ciudadana */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-alerta"></div>
        <div className="flex items-start gap-4">
          <div className="bg-yellow-100 p-2 rounded-full shrink-0">
            <Info className="h-6 w-6 text-alerta" />
          </div>
          <div>
            <h3 className="font-serif text-xl font-bold text-yellow-900 mb-2">Traducción ciudadana</h3>
            <p className="text-yellow-800 leading-relaxed">
              La entidad <strong>{data.entidadNombre}</strong> ha realizado un proceso de{" "}
              <strong>{PROCEDIMIENTO_MAPPING[data.procedimiento || ""]?.toLowerCase() || data.procedimiento?.toLowerCase()}</strong> para 
              contratar <strong>{TIPO_MAPPING[data.tipo || ""]?.toLowerCase() || data.tipo?.toLowerCase()}</strong>. 
              {data.proveedorNombre ? (
                <> El ganador fue <strong>{data.proveedorNombre}</strong> por un monto de <strong>{formatCurrency(data.montoAdjudicado)}</strong>.</>
              ) : (
                <> Aún no se ha adjudicado a un ganador.</>
              )}
            </p>
            
            {isDirecta && (
              <div className="mt-4 flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded-md w-fit">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">Alerta: Esta compra se hizo "a dedo", sin competencia abierta.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-1">Monto Adjudicado</p>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(data.montoAdjudicado || data.montoReferencial)}
                </p>
                {data.montoReferencial && data.montoAdjudicado && data.montoReferencial !== data.montoAdjudicado && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Referencial: {formatCurrency(data.montoReferencial)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Entidad que contrata</p>
                  <p className="font-medium flex items-start gap-2">
                    <Building className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{data.entidadNombre}</span>
                  </p>
                </div>
                {data.proveedorNombre && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Proveedor ganador</p>
                    <p className="font-medium flex items-start gap-2">
                      <Users className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>{data.proveedorNombre}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Línea de tiempo del proceso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {/* Convocatoria */}
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

                {/* Adjudicación */}
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
                      <p className="text-sm text-muted-foreground">Se seleccionó al ganador del proceso.</p>
                    </div>
                  </div>
                )}

                {/* Contrato */}
                {(data.fechaContrato || data.estado === "CONTRATADO" || data.estado === "FINALIZADO") && (
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-exito text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-card shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-foreground">Firma de Contrato</h4>
                        <time className="text-sm font-medium text-exito">{formatDate(data.fechaContrato)}</time>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {data.plazoEjecucionDias ? `Plazo de ejecución: ${data.plazoEjecucionDias} días.` : "Contrato firmado."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Actions & Meta */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">Acciones Ciudadanas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-start" variant="default" onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Compartir esta página
              </Button>
              
              <Button className="w-full justify-start" variant="outline" asChild>
                <a href={`mailto:denuncias@osce.gob.pe?subject=Reporte de anomalía en contratación ${data.nomenclatura}&body=Encontré una anomalía en la siguiente contratación: ${window.location.href}`}>
                  <AlertTriangle className="mr-2 h-4 w-4 text-alerta" />
                  Reportar anomalía
                </a>
              </Button>

              <div className="pt-4 border-t">
                <Button className="w-full justify-start" variant="secondary" asChild>
                  <a href={`https://buscadorpublico.seace.gob.pe/`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Ver expediente oficial SEACE
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">Datos Técnicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">OCID (Estándar OCDS)</p>
                <p className="font-mono break-all">{data.ocid}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ubicación</p>
                <p className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {data.ubigeoDistrito}, {data.ubigeoProvincia}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Moneda</p>
                <p>{data.moneda || "PEN"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
