import { Link, useLocation } from "wouter";
import { Search, Menu, X, BarChart2, Download, Building, Users, BookOpen, Info, Settings, Globe } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

export function Navbar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: "/explorador", label: "Explorar", icon: Search },
    { href: "/observatorio", label: "Observatorio", icon: BarChart2 },
    { href: "/entidades", label: "Entidades", icon: Building },
    { href: "/proveedores", label: "Proveedores", icon: Users },
    { href: "/fuentes", label: "Fuentes", icon: Globe },
    { href: "/descargas", label: "Descargas", icon: Download },
    { href: "/glosario", label: "Glosario", icon: BookOpen },
    { href: "/acerca", label: "Acerca de", icon: Info },
    { href: "/admin", label: "Administrar", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="bg-primary text-white p-1.5 rounded-md">
            <Search className="h-5 w-5" />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight text-accent">Vecino Vigilante</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-5 overflow-x-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary whitespace-nowrap ${isActive ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Nav Toggle */}
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Nav Menu */}
      {isOpen && (
        <div className="lg:hidden border-t p-4 bg-background">
          <nav className="grid grid-cols-2 gap-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2 text-sm font-medium p-2.5 rounded-lg ${isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
