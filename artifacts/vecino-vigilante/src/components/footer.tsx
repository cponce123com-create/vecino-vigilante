export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="w-full border-t bg-white py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center md:items-start">
            <span className="font-serif text-lg font-bold text-accent">Vecino Vigilante Chanchamayo</span>
            <p className="text-sm text-muted-foreground mt-1">Portal ciudadano de transparencia</p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-sm text-muted-foreground">Datos oficiales del OSCE-SEACE.</p>
            <p className="text-xs text-muted-foreground mt-1">Última actualización: {new Date().toLocaleDateString('es-PE')}</p>
          </div>
        </div>
        <div className="border-t mt-6 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
          <p>&copy; {currentYear} Vecino Vigilante. Todos los derechos reservados.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="/acerca" className="hover:text-primary transition-colors">Acerca del proyecto</a>
            <a href="/glosario" className="hover:text-primary transition-colors">Glosario</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
