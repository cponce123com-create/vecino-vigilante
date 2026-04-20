import { useState } from "react";
import { useGetExcelPreview, getGetExcelPreviewQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { Download, FileSpreadsheet } from "lucide-react";

export default function Descargas() {
  const [tipo, setTipo] = useState<string>("");
  const [estado, setEstado] = useState<string>("");
  const [fechaDesde, setFechaDesde] = useState<string>("");

  const { data: preview, isLoading } = useGetExcelPreview({
    tipo: tipo && tipo !== "todos" ? tipo : undefined,
    estado: estado && estado !== "todos" ? estado : undefined,
    fechaDesde: fechaDesde || undefined
  }, { query: { queryKey: getGetExcelPreviewQueryKey({ tipo, estado, fechaDesde }) } });

  const handleDownload = () => {
    fetch('/api/excel/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tipo: tipo === "todos" ? null : tipo,
        estado: estado === "todos" ? null : estado,
        fechaDesde: fechaDesde || null
      })
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-contrataciones-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    })
    .catch(err => console.error("Error downloading excel", err));
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="text-center mb-10">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-accent mb-4">Descargar Base de Datos</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Genera reportes en Excel de todas las contrataciones públicas. 
          El archivo incluye 6 hojas con resúmenes, detalle completo, y análisis por entidad, proveedor, mes y distrito.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Filtros del Reporte</CardTitle>
            <CardDescription>Personaliza los datos que deseas descargar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Compra</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  <SelectItem value="Obras">Obras</SelectItem>
                  <SelectItem value="Bienes">Bienes</SelectItem>
                  <SelectItem value="Servicios">Servicios</SelectItem>
                  <SelectItem value="Consultoría de Obras">Consultorías</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="CONVOCADO">Convocado</SelectItem>
                  <SelectItem value="ADJUDICADO">Adjudicado</SelectItem>
                  <SelectItem value="CONTRATADO">Contratado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Desde la fecha (Opcional)</label>
              <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 flex flex-col">
          <Card className="flex-1 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="font-serif text-2xl flex items-center gap-2 text-primary">
                <FileSpreadsheet className="h-6 w-6" />
                Vista Previa del Reporte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="space-y-4">
                  <div className="h-4 bg-primary/10 rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-primary/10 rounded w-1/2 animate-pulse"></div>
                  <div className="h-4 bg-primary/10 rounded w-5/6 animate-pulse"></div>
                </div>
              ) : preview ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Registros Totales</p>
                    <p className="text-2xl font-bold">{preview.totalRegistros}</p>
                  </div>
                  <div className="bg-card p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Monto Total</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(preview.montoTotal)}</p>
                  </div>
                  <div className="bg-card p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Entidades</p>
                    <p className="text-xl font-bold">{preview.entidadesUnicas}</p>
                  </div>
                  <div className="bg-card p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Proveedores</p>
                    <p className="text-xl font-bold">{preview.proveedoresUnicos}</p>
                  </div>
                </div>
              ) : (
                <p>No se pudo cargar la vista previa</p>
              )}

              <Button 
                size="lg" 
                className="w-full h-16 text-lg rounded-xl shadow-lg"
                onClick={handleDownload}
                disabled={isLoading || (preview?.totalRegistros === 0)}
              >
                <Download className="mr-3 h-6 w-6" />
                GENERAR Y DESCARGAR EXCEL
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
