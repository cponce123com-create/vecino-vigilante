import { Link } from "wouter";
import { Clock, MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Proximamente() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-lg space-y-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="relative">
            <MapPin className="h-16 w-16 text-primary/20" />
            <Clock className="h-7 w-7 text-primary absolute bottom-0 right-0" />
          </div>
        </div>

        <h1 className="font-serif text-4xl font-bold text-accent">Próximamente</h1>

        <p className="text-lg text-muted-foreground leading-relaxed">
          Estamos trabajando para extender Vecino Vigilante a más provincias del Perú.
          Por ahora, el portal está disponible únicamente para la provincia de{" "}
          <span className="font-semibold text-foreground">Chanchamayo (Junín)</span>.
        </p>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 text-left space-y-3">
          <p className="font-semibold text-foreground text-sm">¿Quieres que lleguemos a tu provincia?</p>
          <p className="text-sm text-muted-foreground">
            Si eres periodista, activista o ciudadano interesado en vigilar contrataciones públicas en tu zona,
            escríbenos. La plataforma es de código abierto y puede adaptarse a cualquier provincia con datos del SEACE/OCDS.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button size="lg" className="w-full sm:w-auto gap-2">
              Ir a Chanchamayo <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/fuentes">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Ver fuentes de datos nacionales
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
