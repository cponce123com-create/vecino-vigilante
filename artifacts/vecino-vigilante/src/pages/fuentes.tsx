import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, Scale, ShoppingCart, Eye, Building2, Layers, Globe } from "lucide-react";

interface Fuente {
  nombre: string;
  descripcion: string;
  url: string;
  tipo: "oficial" | "seace" | "transparencia" | "osce";
  etiquetas?: string[];
}

interface Categoria {
  titulo: string;
  descripcion: string;
  icono: React.ElementType;
  color: string;
  fuentes: Fuente[];
}

const CATEGORIAS: Categoria[] = [
  {
    titulo: "Publicaciones Municipales",
    descripcion: "Documentos, informes y resoluciones publicados directamente por los municipios de Chanchamayo en el portal del Estado peruano.",
    icono: FileText,
    color: "text-blue-600",
    fuentes: [
      {
        nombre: "Informes y Publicaciones — Municipalidad San Ramón",
        descripcion: "Listado completo de informes, memorias, planes y publicaciones oficiales de la Municipalidad Distrital de San Ramón.",
        url: "https://www.gob.pe/institucion/munisanramon/informes-publicaciones",
        tipo: "oficial",
        etiquetas: ["San Ramón", "Informes", "Gob.pe"],
      },
      {
        nombre: "Normas Legales — Municipalidad San Ramón",
        descripcion: "Ordenanzas, acuerdos de concejo, decretos de alcaldía y otras normas legales publicadas oficialmente.",
        url: "https://www.gob.pe/institucion/munisanramon/normas-legales",
        tipo: "oficial",
        etiquetas: ["San Ramón", "Ordenanzas", "Gob.pe"],
      },
    ],
  },
  {
    titulo: "SEACE — Sistema Electrónico de Contrataciones",
    descripcion: "Portales oficiales del SEACE para consultar procesos de selección, contratos y antecedentes de proveedores.",
    icono: ShoppingCart,
    color: "text-green-600",
    fuentes: [
      {
        nombre: "Buscador Público de Procesos SEACE",
        descripcion: "Busca cualquier proceso de contratación por entidad, objeto, valor referencial o estado. Base de datos principal del SEACE.",
        url: "https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/buscadorPublico.xhtml",
        tipo: "seace",
        etiquetas: ["Procesos", "Convocatorias", "Búsqueda"],
      },
      {
        nombre: "Contratos Registrados SEACE",
        descripcion: "Consulta contratos ya firmados y registrados en el sistema. Incluye montos, fechas y partes involucradas.",
        url: "https://prod4.seace.gob.pe/contratos/publico/#/buscar",
        tipo: "seace",
        etiquetas: ["Contratos", "Firmas", "Registro"],
      },
      {
        nombre: "Antecedentes de Proveedores SEACE (CONOSCE)",
        descripcion: "Historial de participación de una empresa en procesos públicos: cuántos ganó, montos, entidades con las que trabajó.",
        url: "https://bi.seace.gob.pe/pentaho/api/repos/:public:ANTECEDENTES_PROVEEDORES:ANTECEDENTES_PROVEEDORES.wcdf/generatedContent?userid=public&password=key",
        tipo: "seace",
        etiquetas: ["Proveedores", "Historial", "BI SEACE"],
      },
      {
        nombre: "Certificados Logísticos (SICAN)",
        descripcion: "Verifica la inscripción y certificación de proveedores en el sistema logístico del Estado.",
        url: "https://prodapp2.seace.gob.pe/sican-uiwd-pub/logistico/logisticosCertificados.xhtml?i=1",
        tipo: "seace",
        etiquetas: ["Certificados", "SICAN", "Proveedores"],
      },
    ],
  },
  {
    titulo: "Transparencia Económica",
    descripcion: "Portal del Ministerio de Economía y Finanzas con datos de ejecución presupuestal, obras y órdenes de compra.",
    icono: Eye,
    color: "text-purple-600",
    fuentes: [
      {
        nombre: "Información de Obras — La Merced (MUNI Chanchamayo)",
        descripcion: "Listado de obras registradas en el portal de Transparencia para la Municipalidad Provincial de Chanchamayo (La Merced). Muestra avance físico y financiero.",
        url: "https://www.transparencia.gob.pe/reportes_directos/pep_transparencia_infoObras.aspx?id_entidad=11129&ver=1&id_tema=200",
        tipo: "transparencia",
        etiquetas: ["Obras", "La Merced", "MEF"],
      },
      {
        nombre: "Proyectos de Inversión — Muni Chanchamayo",
        descripcion: "Proyectos de inversión pública de la Municipalidad Provincial, con estado de ejecución y presupuesto asignado.",
        url: "https://www.transparencia.gob.pe/reportes_directos/pte_transparencia_pro_inv.aspx?id_entidad=11129&id_tema=26&ver=1",
        tipo: "transparencia",
        etiquetas: ["Inversión", "Presupuesto", "MEF"],
      },
      {
        nombre: "Órdenes de Compra y Servicio — Muni Chanchamayo",
        descripcion: "Órdenes de compra y de servicio emitidas por la Municipalidad Provincial. Permite ver pagos directos sin licitación.",
        url: "https://www.transparencia.gob.pe/contrataciones/pte_transparencia_ordenes_compra.aspx?id_entidad=11129&id_tema=34&Ver=",
        tipo: "transparencia",
        etiquetas: ["Órdenes de Compra", "Pagos", "MEF"],
      },
    ],
  },
  {
    titulo: "OSCE — Perfil de Proveedores",
    descripcion: "Organismo Supervisor de las Contrataciones del Estado. Perfil completo de empresas y personas naturales que contratan con el Estado.",
    icono: Building2,
    color: "text-orange-600",
    fuentes: [
      {
        nombre: "Perfil de Proveedor OSCE",
        descripcion: "Busca el perfil de cualquier empresa o persona natural: RUC, razón social, historial de contratos, sanciones y capacidad máxima de contratación.",
        url: "https://apps.osce.gob.pe/perfilprov-ui/",
        tipo: "osce",
        etiquetas: ["OSCE", "RNP", "Sanciones", "Perfil"],
      },
    ],
  },
];

const TIPO_BADGE: Record<string, { label: string; className: string }> = {
  oficial: { label: "Gob.pe", className: "border-blue-300 bg-blue-50 text-blue-700" },
  seace: { label: "SEACE", className: "border-green-300 bg-green-50 text-green-700" },
  transparencia: { label: "MEF Transparencia", className: "border-purple-300 bg-purple-50 text-purple-700" },
  osce: { label: "OSCE", className: "border-orange-300 bg-orange-50 text-orange-700" },
};

export default function Fuentes() {
  return (
    <div className="container mx-auto px-4 py-10 space-y-12">
      {/* Encabezado */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Globe className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-accent">Fuentes Externas</h1>
        <p className="text-lg text-muted-foreground">
          Portales oficiales del Estado peruano para verificar y cruzar información sobre contrataciones,
          obras, presupuesto y proveedores en Chanchamayo. Todos los enlaces son fuentes oficiales y de acceso público.
        </p>
      </div>

      {/* Aviso */}
      <div className="max-w-4xl mx-auto bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <Layers className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">¿Por qué están aquí y no dentro de la plataforma?</p>
          <p>
            Algunos portales como el SEACE y Transparencia Económica requieren conexión desde Perú (bloquean IPs extranjeras) o no permiten integración programática. Listamos los enlaces directos para que puedas abrirlos desde tu navegador y cruzar la información con los datos que ves en Vecino Vigilante.
          </p>
        </div>
      </div>

      {/* Categorías */}
      {CATEGORIAS.map((cat) => {
        const Icono = cat.icono;
        return (
          <section key={cat.titulo} className="max-w-4xl mx-auto">
            <div className="flex items-start gap-3 mb-5">
              <Icono className={`h-7 w-7 shrink-0 mt-0.5 ${cat.color}`} />
              <div>
                <h2 className="font-serif text-2xl font-bold text-accent">{cat.titulo}</h2>
                <p className="text-muted-foreground mt-1 text-sm">{cat.descripcion}</p>
              </div>
            </div>

            <div className="grid gap-4">
              {cat.fuentes.map((fuente) => {
                const badge = TIPO_BADGE[fuente.tipo];
                return (
                  <Card key={fuente.url} className="hover:border-primary/50 transition-colors group">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={`text-xs shrink-0 ${badge.className}`}>
                              {badge.label}
                            </Badge>
                            {fuente.etiquetas?.map((et) => (
                              <Badge key={et} variant="secondary" className="text-xs">{et}</Badge>
                            ))}
                          </div>
                          <h3 className="font-semibold text-base leading-snug">{fuente.nombre}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{fuente.descripcion}</p>
                          <a
                            href={fuente.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium mt-1 break-all"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            {fuente.url.replace(/^https?:\/\//, "").slice(0, 70)}{fuente.url.length > 75 ? "…" : ""}
                          </a>
                        </div>
                        <a
                          href={fuente.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="shrink-0 p-2.5 rounded-lg bg-primary/5 text-primary hover:bg-primary hover:text-white transition-colors"
                          title="Abrir en nueva pestaña"
                        >
                          <ExternalLink className="h-5 w-5" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Instrucciones de cruce */}
      <div className="max-w-4xl mx-auto bg-primary/5 border border-primary/20 rounded-xl p-6 space-y-4">
        <h3 className="font-serif text-xl font-bold text-accent flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          Cómo cruzar los datos con Vecino Vigilante
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-semibold text-foreground">Para verificar un proveedor:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Anota el RUC desde la página de detalle de una contratación</li>
              <li>Búscalo en el Perfil de Proveedor OSCE</li>
              <li>Compara el historial de contratos y verifica si tiene sanciones</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">Para verificar una obra:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Anota el código de proceso desde el Explorador</li>
              <li>Búscalo en el Buscador Público del SEACE</li>
              <li>Compara con Transparencia Económica para ver ejecución</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">Para ver órdenes de compra directas:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Abre el portal de Órdenes de Compra del MEF</li>
              <li>Cruza con lo que aparece en el Explorador (filtro "Sin competencia")</li>
              <li>Si no aparece en SEACE pero sí en MEF, es una alerta</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">Para ver publicaciones recientes:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Abre Informes y Publicaciones del Gob.pe</li>
              <li>Revisa si las obras o contratos listados coinciden con SEACE</li>
              <li>Reporta discrepancias al equipo de Vecino Vigilante</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
