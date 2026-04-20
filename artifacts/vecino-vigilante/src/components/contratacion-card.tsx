import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Contratacion } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ESTADO_MAPPING, TIPO_MAPPING, PROCEDIMIENTO_MAPPING } from "@/lib/constants";
import { Building, MapPin, Calendar, FileText, AlertTriangle } from "lucide-react";

export function ContratacionCard({ contratacion }: { contratacion: Contratacion }) {
  const getBadgeVariant = (estado?: string | null) => {
    switch (estado) {
      case "CONTRATADO":
      case "FINALIZADO":
        return "default"; // green would be better
      case "CONVOCADO":
      case "ADJUDICADO":
        return "secondary";
      case "DESIERTO":
      case "NULO":
        return "destructive";
      default:
        return "outline";
    }
  };

  const hasAlert = contratacion.procedimiento === "Contratación Directa" || contratacion.procedimiento === "CD";

  return (
    <Link href={`/contratacion/${contratacion.ocid}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full flex flex-col hover:shadow-md">
        <CardHeader className="pb-3 gap-2">
          <div className="flex justify-between items-start gap-4">
            <Badge variant="outline" className="text-xs bg-muted">
              {TIPO_MAPPING[contratacion.tipo || ""] || contratacion.tipo || "Desconocido"}
            </Badge>
            <Badge variant={getBadgeVariant(contratacion.estado)} className="text-xs">
              {ESTADO_MAPPING[contratacion.estado || ""] || contratacion.estado || "Desconocido"}
            </Badge>
          </div>
          <h3 className="font-semibold text-lg line-clamp-2 leading-tight">
            {contratacion.titulo || contratacion.descripcion || "Sin título"}
          </h3>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between gap-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 shrink-0" />
              <span className="truncate">{contratacion.entidadNombre || "Entidad no especificada"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {contratacion.ubigeoDistrito}, {contratacion.ubigeoProvincia}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{formatDate(contratacion.fechaConvocatoria)}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {PROCEDIMIENTO_MAPPING[contratacion.procedimiento || ""] || contratacion.procedimiento}
              </span>
            </div>
          </div>
          
          <div className="pt-4 border-t flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Monto referencial</span>
              <span className="font-bold text-lg text-foreground">
                {formatCurrency(contratacion.montoReferencial)}
              </span>
            </div>
            {hasAlert && (
              <Badge variant="destructive" className="bg-alerta text-white border-transparent">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Sin competencia
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
