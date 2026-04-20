import { useGetStats } from "@workspace/api-client-react";

export default function Acerca() {
  const { data: stats } = useGetStats();

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="space-y-10">
        <div className="text-center space-y-4">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-accent">Acerca de Vecino Vigilante</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Una herramienta ciudadana para transparentar las compras del Estado en la región Junín.
          </p>
        </div>

        <div className="prose prose-lg max-w-none text-foreground">
          <h2 className="font-serif text-3xl text-accent">Nuestra Misión</h2>
          <p>
            Vecino Vigilante Chanchamayo nace con un propósito claro: democratizar el acceso a la información de compras públicas. Creemos que cuando los ciudadanos pueden entender fácilmente en qué se gasta su dinero, se fomenta una cultura de rendición de cuentas y se reduce la corrupción.
          </p>
          <p>
            Hemos tomado la compleja información oficial del Estado y la hemos traducido a un lenguaje ciudadano, fácil de navegar y analizar.
          </p>

          <h2 className="font-serif text-3xl text-accent mt-10">Metodología y Fuentes de Datos</h2>
          <p>
            Toda la información presentada en este portal proviene de fuentes oficiales del Estado Peruano:
          </p>
          <ul>
            <li>
              <strong>OSCE (Organismo Supervisor de las Contrataciones del Estado):</strong> Principal fuente de información a través del Sistema Electrónico de Contrataciones del Estado (SEACE).
            </li>
            <li>
              <strong>Estándar OCDS:</strong> Procesamos los datos utilizando el Estándar de Datos para las Contrataciones Abiertas (Open Contracting Data Standard), lo que garantiza la comparabilidad y transparencia internacional.
            </li>
          </ul>

          <div className="bg-muted p-6 rounded-lg my-8 border border-border">
            <h3 className="font-serif text-xl font-bold mt-0 text-accent">Estado de la Base de Datos</h3>
            <p className="mb-0 text-sm">
              Última sincronización: {stats?.ultimaSincronizacion ? new Date(stats.ultimaSincronizacion).toLocaleString('es-PE') : 'Actualizando...'}
              <br />
              Total de contratos registrados: {stats?.totalContrataciones?.toLocaleString('es-PE') || '...'}
            </p>
          </div>

          <h2 className="font-serif text-3xl text-accent mt-10">Limitaciones de los Datos</h2>
          <p>
            Es importante entender que este portal es un reflejo de lo que las entidades públicas declaran en el SEACE. Por lo tanto:
          </p>
          <ul>
            <li>Si una entidad no registra una compra o lo hace tarde, no aparecerá en el portal.</li>
            <li>Las compras por montos muy pequeños (menores a 8 UIT) tienen reglas de registro diferentes y pueden no estar completas.</li>
            <li>No somos una autoridad fiscalizadora, solo somos un canal de acceso a la información pública.</li>
          </ul>

          <h2 className="font-serif text-3xl text-accent mt-10">¿Cómo contribuir?</h2>
          <p>
            Este es un proyecto cívico. Si eres desarrollador, analista de datos, periodista o un ciudadano interesado, puedes utilizar nuestra plataforma para:
          </p>
          <ul>
            <li>Cruzar información y encontrar anomalías.</li>
            <li>Descargar la base de datos en formato Excel para tus propias investigaciones.</li>
            <li>Compartir hallazgos relevantes con tu comunidad.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
