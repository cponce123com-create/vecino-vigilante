import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function Glosario() {
  const terminos = [
    {
      termino: "SEACE",
      significado: "Sistema Electrónico de Contrataciones del Estado. Es la plataforma oficial donde todas las entidades del gobierno deben publicar qué van a comprar, a quién se lo compran y cuánto pagan.",
      ciudadano: "Es el 'Facebook' de las compras del Estado. Si una compra no está en el SEACE, es irregular."
    },
    {
      termino: "Licitación Pública (LP)",
      significado: "Proceso de selección que se usa para compras grandes de bienes (productos) u obras (construcciones). Es el procedimiento más riguroso y abierto a competencia.",
      ciudadano: "Concurso para compras millonarias donde gana el que ofrece mejores condiciones y precio."
    },
    {
      termino: "Adjudicación Simplificada (AS)",
      significado: "Proceso más rápido y con menos requisitos que la Licitación Pública, usado para compras de montos medianos.",
      ciudadano: "Concurso para compras medianas. Es más rápido que una Licitación."
    },
    {
      termino: "Contratación Directa (CD)",
      significado: "Procedimiento excepcional donde la entidad contrata a un proveedor específico sin realizar un concurso público. Solo se permite en casos como emergencias, proveedor único en el mercado o servicios personalísimos.",
      ciudadano: "Compra 'a dedo'. Como no hay competencia, es el tipo de compra que más debe vigilarse para evitar favoritismos o sobreprecios."
    },
    {
      termino: "Subasta Inversa Electrónica (SIE)",
      significado: "Procedimiento usado para comprar bienes comunes (que ya tienen una ficha técnica estándar en el Perú, como papel, combustible o alimentos).",
      ciudadano: "Gana el proveedor que ofrezca el precio más bajo, ya que el producto a comprar es exactamente el mismo en todos los casos."
    },
    {
      termino: "Monto Referencial",
      significado: "Es el presupuesto estimado que la entidad ha calculado que le costará la compra antes de lanzar el concurso.",
      ciudadano: "El precio máximo que el Estado espera pagar."
    },
    {
      termino: "Monto Adjudicado",
      significado: "Es el precio final por el que se cerró el contrato con el proveedor ganador.",
      ciudadano: "Lo que realmente se pagó. Si es mucho mayor al Monto Referencial, es motivo de alerta."
    },
    {
      termino: "PAC (Plan Anual de Contrataciones)",
      significado: "Documento que toda entidad pública debe elaborar a inicios de año indicando todas las compras que planea hacer durante el año.",
      ciudadano: "La lista de compras anual del alcalde o gobernador. Si una compra no está en el PAC, no debería poder realizarse."
    },
    {
      termino: "RNP (Registro Nacional de Proveedores)",
      significado: "Base de datos administrada por el OSCE donde deben estar inscritos todos los que quieran venderle al Estado.",
      ciudadano: "El 'brevete' para poder hacer negocios con el gobierno. Si una empresa no tiene RNP vigente, no se le puede comprar."
    },
    {
      termino: "Consorcio",
      significado: "Unión temporal de dos o más empresas para presentarse juntas a un concurso público y sumar su experiencia o capacidad económica.",
      ciudadano: "Empresas que se juntan para ganar una obra grande. A veces se usa para esconder quién es el verdadero dueño de la obra."
    }
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-accent/10 rounded-full mb-4">
          <BookOpen className="h-8 w-8 text-accent" />
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-accent mb-4">Glosario Ciudadano</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          El Estado usa palabras técnicas y complicadas. Aquí las traducimos al español sencillo para que todos podamos entender.
        </p>
      </div>

      <div className="space-y-6">
        {terminos.map((item, index) => (
          <Card key={index} className="overflow-hidden border-border/60 hover:border-primary/40 transition-colors shadow-sm">
            <CardHeader className="bg-muted/30 pb-3 border-b">
              <CardTitle className="font-serif text-2xl text-accent">{item.termino}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Definición oficial:</span>
                <p className="text-foreground leading-relaxed">{item.significado}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-md border border-yellow-100">
                <span className="text-xs font-bold uppercase tracking-wider text-alerta mb-1 block">En sencillo:</span>
                <p className="text-yellow-900 font-medium">{item.ciudadano}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
