import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Home from "@/pages/home";
import Explorador from "@/pages/explorador";
import ContratacionDetalle from "@/pages/contratacion";
import Acerca from "@/pages/acerca";
import Distrito from "@/pages/distrito";
import Descargas from "@/pages/descargas";
import Proveedores from "@/pages/proveedores";
import Proveedor from "@/pages/proveedor";
import Entidades from "@/pages/entidades";
import Entidad from "@/pages/entidad";
import Observatorio from "@/pages/observatorio";
import Glosario from "@/pages/glosario";
import Admin from "@/pages/admin";
import Fuentes from "@/pages/fuentes";
import Proximamente from "@/pages/proximamente";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  }
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/explorador" component={Explorador} />
        <Route path="/contratacion/:ocid" component={ContratacionDetalle} />
        <Route path="/distrito/:ubigeo" component={Distrito} />
        <Route path="/descargas" component={Descargas} />
        <Route path="/proveedores" component={Proveedores} />
        <Route path="/proveedores/:ruc" component={Proveedor} />
        <Route path="/entidades" component={Entidades} />
        <Route path="/entidades/:ruc" component={Entidad} />
        <Route path="/observatorio" component={Observatorio} />
        <Route path="/glosario" component={Glosario} />
        <Route path="/acerca" component={Acerca} />
        <Route path="/admin" component={Admin} />
        <Route path="/fuentes" component={Fuentes} />
        <Route path="/proximamente" component={Proximamente} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
