# 🏛️ PROYECTO: VECINO VIGILANTE CHANCHAMAYO
### Portal ciudadano de contrataciones públicas del Estado Peruano

---

## 📌 CONTEXTO Y OBJETIVO

Construye una aplicación web pública, gratuita y sin autenticación que permita a los ciudadanos de la provincia de Chanchamayo (Junín, Perú) ver de forma clara, visual e intuitiva **todas las contrataciones públicas** (obras, bienes, servicios, consultorías) que realizan las entidades del Estado en su territorio, usando los datos oficiales del OECE/OSCE.

**Usuario objetivo:** vecino común sin conocimientos técnicos. La web debe ser tan fácil como usar Facebook.

**Alcance MVP:** provincia de Chanchamayo (distritos: Chanchamayo, Perené, Pichanaqui, San Luis de Shuaro, San Ramón, Vitoc) y el resto de la región Junín como complemento.

**Sin login.** Todo 100% público. Enfoque balanceado entre mapa interactivo y descarga de reportes Excel.

---

## 🎯 FUENTES DE DATOS OFICIALES (YA VALIDADAS)

### 1. API OCDS Portal de Contrataciones Abiertas (principal)
- **Base URL:** `https://contratacionesabiertas.osce.gob.pe/api/`
- **Formato:** JSON bajo estándar OCDS (Open Contracting Data Standard)
- **Sin autenticación, sin API key, sin rate limit conocido**
- **Actualización diaria** (ETL nocturno)
- Cobertura histórica: SEACE v1, v2 y v3 (2004 en adelante)

### 2. Descargas masivas CONOSCE (para carga histórica inicial)
- **URL:** `https://bi.seace.gob.pe/pentaho/api/repos/:public:portal:datosabiertos.html/content?userid=public&password=key`
- Archivos CSV/XLSX con PAC, Procedimientos Adjudicados, Proveedores, Contrataciones Directas desde 2018

### 3. Tabla UBIGEO (para geolocalización)
- Descargar del Plataforma Nacional de Datos Abiertos
- Contiene los 1874 distritos del Perú con latitud, longitud, superficie

---

## 🧱 STACK TECNOLÓGICO REQUERIDO

```
FRONTEND
├── Next.js 14 (App Router)
├── TypeScript (estricto)
├── Tailwind CSS
├── shadcn/ui (componentes)
├── Recharts (gráficos)
├── MapLibre GL JS (mapas, gratis sin API key)
├── Lucide React (iconos)
└── Framer Motion (animaciones suaves)

BACKEND
├── Next.js API Routes
├── PostgreSQL (DB principal)
├── Drizzle ORM
├── Zod (validación)
├── node-cron (sincronización diaria)
└── ExcelJS (generación de Excel multi-hoja con gráficos)

DEPLOY
├── Render (tier gratuito para MVP)
└── Neon/Supabase para PostgreSQL gratuito
```

**IMPORTANTE:** No uses Prisma. Usa Drizzle ORM como en ControlHub. Monorepo simple: `/app`, `/components`, `/lib`, `/db`, `/scripts`.

---

## 📁 ESTRUCTURA DE CARPETAS

```
vecino-vigilante/
├── app/
│   ├── layout.tsx                      # Layout global con header/footer
│   ├── page.tsx                        # Home con mapa del Perú
│   ├── globals.css                     # Estilos globales + paleta
│   ├── distrito/
│   │   └── [ubigeo]/page.tsx           # Dashboard del distrito
│   ├── contratacion/
│   │   └── [ocid]/page.tsx             # Detalle de una contratación
│   ├── explorador/
│   │   └── page.tsx                    # Tabla filtrable
│   ├── descargas/
│   │   └── page.tsx                    # Generador de Excel
│   ├── proveedores/
│   │   ├── page.tsx
│   │   └── [ruc]/page.tsx
│   ├── entidades/
│   │   ├── page.tsx
│   │   └── [ruc]/page.tsx
│   ├── observatorio/
│   │   └── page.tsx                    # Rankings y KPIs
│   ├── glosario/
│   │   └── page.tsx                    # Glosario ciudadano
│   ├── acerca/
│   │   └── page.tsx
│   └── api/
│       ├── contrataciones/route.ts     # GET con filtros
│       ├── contratacion/[ocid]/route.ts
│       ├── distritos/route.ts
│       ├── entidades/route.ts
│       ├── proveedores/route.ts
│       ├── excel/route.ts              # POST genera xlsx
│       ├── stats/route.ts              # KPIs globales
│       └── sync/route.ts               # Endpoint protegido para cron
│
├── components/
│   ├── ui/                             # shadcn components
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── MobileNav.tsx
│   ├── mapa/
│   │   ├── MapaPeru.tsx                # Choropleth interactivo
│   │   └── MapaDistrito.tsx
│   ├── contratacion/
│   │   ├── CardContratacion.tsx
│   │   ├── TimelineOCDS.tsx            # Planificación→Tender→Award→Contract
│   │   ├── EstadoPill.tsx
│   │   └── CompartirSocial.tsx
│   ├── dashboard/
│   │   ├── KPICard.tsx
│   │   ├── RankingEntidades.tsx
│   │   ├── GraficoEvolucion.tsx
│   │   └── TopProveedores.tsx
│   ├── filtros/
│   │   ├── FiltroFechas.tsx
│   │   ├── FiltroUbigeo.tsx
│   │   ├── FiltroMonto.tsx
│   │   └── FiltroTipo.tsx
│   └── descargas/
│       ├── FormularioExcel.tsx
│       └── PreviewDatos.tsx
│
├── lib/
│   ├── ocds/
│   │   ├── client.ts                   # Cliente de la API OCDS
│   │   ├── mapper.ts                   # OCDS → modelo interno
│   │   └── types.ts                    # Tipos TS del estándar OCDS
│   ├── excel/
│   │   ├── generator.ts                # Genera xlsx multi-hoja
│   │   ├── styles.ts                   # Estilos visuales del Excel
│   │   └── charts.ts                   # Gráficos incrustados
│   ├── ubigeo/
│   │   ├── data.ts                     # Tabla ubigeo de Junín
│   │   └── helpers.ts
│   ├── traduccion/
│   │   └── jerga.ts                    # "Adjudicación Simplificada" → "Compra pequeña"
│   ├── utils.ts
│   └── constants.ts
│
├── db/
│   ├── schema.ts                       # Drizzle schema
│   ├── client.ts
│   └── migrations/
│
├── scripts/
│   ├── sync-ocds.ts                    # Job de sincronización
│   ├── seed-ubigeo.ts                  # Carga inicial de ubigeos
│   └── initial-backfill.ts             # Carga histórica desde CONOSCE
│
├── public/
│   ├── geojson/
│   │   ├── peru-departamentos.json
│   │   ├── junin-provincias.json
│   │   └── chanchamayo-distritos.json
│   └── iconos/
│
├── drizzle.config.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 🗄️ MODELO DE BASE DE DATOS (DRIZZLE SCHEMA)

```typescript
// db/schema.ts

import { pgTable, text, integer, decimal, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

// Tabla maestra de UBIGEOS
export const ubigeos = pgTable('ubigeos', {
  codigo: text('codigo').primaryKey(),           // ej: "120301"
  departamento: text('departamento').notNull(),
  provincia: text('provincia').notNull(),
  distrito: text('distrito').notNull(),
  latitud: decimal('latitud', { precision: 10, scale: 7 }),
  longitud: decimal('longitud', { precision: 10, scale: 7 }),
  superficieKm2: decimal('superficie_km2'),
  altitud: integer('altitud'),
});

// Entidades contratantes (municipalidades, ministerios, etc.)
export const entidades = pgTable('entidades', {
  ruc: text('ruc').primaryKey(),
  nombre: text('nombre').notNull(),
  tipo: text('tipo'),                            // MUNICIPALIDAD, MINISTERIO, etc.
  ubigeoCodigo: text('ubigeo_codigo').references(() => ubigeos.codigo),
  nivelGobierno: text('nivel_gobierno'),         // NACIONAL, REGIONAL, LOCAL
}, (t) => ({
  ubigeoIdx: index('entidades_ubigeo_idx').on(t.ubigeoCodigo),
}));

// Proveedores adjudicados
export const proveedores = pgTable('proveedores', {
  ruc: text('ruc').primaryKey(),
  razonSocial: text('razon_social').notNull(),
  ubigeoCodigo: text('ubigeo_codigo').references(() => ubigeos.codigo),
  vigenteRnp: text('vigente_rnp'),
});

// Contrataciones (unidad central, una fila por proceso OCID)
export const contrataciones = pgTable('contrataciones', {
  ocid: text('ocid').primaryKey(),               // ocds-dgv273-seacev3-727039
  nomenclatura: text('nomenclatura'),            // AS-SM-01-2024-MPCH
  titulo: text('titulo').notNull(),
  descripcion: text('descripcion'),
  tipo: text('tipo'),                            // BIENES, SERVICIOS, OBRAS, CONSULTORIA
  procedimientoSeleccion: text('procedimiento'),  // LP, AS, ADS, SUBASTA, CONTRATACION_DIRECTA
  estado: text('estado'),                        // CONVOCADO, ADJUDICADO, CONTRATADO, FINALIZADO
  
  entidadRuc: text('entidad_ruc').references(() => entidades.ruc),
  proveedorRuc: text('proveedor_ruc').references(() => proveedores.ruc),
  ubigeoCodigo: text('ubigeo_codigo').references(() => ubigeos.codigo),
  
  montoReferencial: decimal('monto_referencial', { precision: 15, scale: 2 }),
  montoAdjudicado: decimal('monto_adjudicado', { precision: 15, scale: 2 }),
  moneda: text('moneda').default('PEN'),
  
  fechaConvocatoria: timestamp('fecha_convocatoria'),
  fechaAdjudicacion: timestamp('fecha_adjudicacion'),
  fechaContrato: timestamp('fecha_contrato'),
  plazoEjecucionDias: integer('plazo_ejecucion_dias'),
  
  rawOcds: jsonb('raw_ocds'),                    // JSON completo por si acaso
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  ubigeoIdx: index('contrataciones_ubigeo_idx').on(t.ubigeoCodigo),
  entidadIdx: index('contrataciones_entidad_idx').on(t.entidadRuc),
  fechaIdx: index('contrataciones_fecha_idx').on(t.fechaConvocatoria),
  estadoIdx: index('contrataciones_estado_idx').on(t.estado),
}));

// Log de sincronizaciones
export const syncLog = pgTable('sync_log', {
  id: text('id').primaryKey(),
  fechaEjecucion: timestamp('fecha_ejecucion').defaultNow(),
  registrosProcesados: integer('registros_procesados'),
  registrosNuevos: integer('registros_nuevos'),
  registrosActualizados: integer('registros_actualizados'),
  errores: jsonb('errores'),
  estado: text('estado'),                        // OK, ERROR, PARCIAL
});
```

---

## 🎨 DISEÑO VISUAL (OBLIGATORIO SEGUIR)

### Paleta de colores
```css
:root {
  --color-fondo: #FAFAF7;           /* Blanco hueso */
  --color-superficie: #FFFFFF;
  --color-primario: #C8102E;        /* Rojo peruano sobrio */
  --color-primario-hover: #A00D24;
  --color-acento: #1B365D;          /* Azul profundo institucional */
  --color-exito: #2D6A4F;           /* Verde contratos cumplidos */
  --color-alerta: #E09F3E;          /* Ámbar advertencias */
  --color-error: #BC4749;
  --color-texto-primario: #1A1A1A;
  --color-texto-secundario: #52525B;
  --color-borde: #E4E4E7;
}
```

### Tipografía
- Títulos grandes: **Instrument Serif** (editorial, serio)
- Títulos medios y cuerpo: **Inter**
- Importar desde Google Fonts

### Principios visuales
1. **Mobile-first.** La mayoría entrará desde celular.
2. **Espacios generosos** — nada de interfaces apretadas.
3. **Tipografía jerárquica clara** — títulos de 32-48px, cuerpo 16px mínimo.
4. **Tarjetas con bordes sutiles** (`border: 1px solid var(--color-borde)`), sin sombras pesadas.
5. **Estados hover discretos** — cambio de borde o fondo muy sutil.
6. **Skeletons animados** mientras cargan los datos (no spinners genéricos).
7. **Modo claro por defecto**, modo oscuro opcional en v2.
8. **Accesibilidad AA mínimo** — contraste, teclado, aria-labels.

### Inspiración
- theirstack.com (tarjetas limpias)
- Stripe docs (tipografía)
- Datos.gob.es (portal institucional serio)
- Evitar look "admin template de Bootstrap"

---

## 🖥️ PÁGINAS EN DETALLE

### 1. HOME (`/`)

**Hero section:**
- Título: *"Qué se está comprando con tu dinero"*
- Subtítulo: *"Portal ciudadano de las contrataciones del Estado en Chanchamayo y Junín"*
- Buscador prominente: *"Busca obras en tu distrito..."*
- 4 KPIs grandes en tarjetas:
  - Total contratado este año (S/)
  - Número de obras en ejecución
  - Entidades activas
  - Proveedores únicos

**Sección Mapa:**
- Mapa de Junín con provincias coloreadas según monto contratado (choropleth)
- Click en provincia → zoom a distritos
- Tooltip al hover con resumen del distrito

**Feed "Últimas contrataciones":**
- 10 tarjetas con las contrataciones más recientes
- Cada tarjeta: entidad, título, monto, estado (pill), fecha, distrito
- Click → página de detalle

**Footer:**
- Fuentes de datos con links oficiales
- Disclaimer: *"Datos oficiales del OECE-SEACE. Última actualización: {fecha}"*

### 2. DISTRITO (`/distrito/[ubigeo]`)

**Header del distrito:**
- Nombre del distrito, provincia, departamento
- Mini mapa del distrito
- KPIs del distrito (año en curso): total contratado, obras activas, entidades operando

**Pestañas:**
- "Obras en ejecución"
- "Recién adjudicadas"
- "Próximas (planificación)"
- "Historial"

**Gráficos:**
- Evolución mensual de contrataciones (línea)
- Distribución por tipo: obras/bienes/servicios (donut)
- Top 5 proveedores del distrito (barras horizontales)

**Botón destacado:** *"Descargar todas las contrataciones de {Distrito} en Excel"*

### 3. DETALLE DE CONTRATACIÓN (`/contratacion/[ocid]`)

**Header:**
- Nomenclatura oficial (ej: AS-SM-01-2024-MPCH)
- Título completo
- Pill de estado grande y visible
- Monto destacado

**Timeline OCDS vertical:**
```
●─── Planificación          [fecha]
│    PAC 2024 - Ítem 45
│
●─── Convocatoria           [fecha]
│    Tipo: Adjudicación Simplificada
│    Valor referencial: S/ X
│
●─── Adjudicación           [fecha]
│    Proveedor: [link a ficha]
│    Monto: S/ X
│
●─── Contrato firmado       [fecha]
     Plazo: X días
     [Documentos]
```

**Sección "Traducción ciudadana":**
- Caja amarilla con explicación en lenguaje simple:
  > *"Esto es una compra pequeña que hizo la Municipalidad de Pichanaqui para comprar laptops por S/ 45,000. Fue ganada por la empresa X el 15 de marzo."*

**Botones:**
- Compartir en WhatsApp/Facebook/Twitter
- Ver expediente oficial en SEACE (link externo)
- Reportar anomalía (mailto o form simple)

### 4. EXPLORADOR (`/explorador`)

**Sidebar de filtros (sticky):**
- Rango de fechas (date range picker)
- Ubigeo jerárquico (departamento → provincia → distrito)
- Tipo (bienes, servicios, obras, consultoría) — checkboxes
- Procedimiento (LP, AS, ADS, directa, etc.) — checkboxes
- Estado (convocado, adjudicado, contratado, finalizado)
- Rango de montos (slider)
- Entidad (autocomplete)
- Proveedor (autocomplete)

**Resultados:**
- Contador: *"Mostrando X de Y contrataciones (S/ Z total)"*
- Vista alternable: tarjetas / tabla
- Ordenamiento: fecha, monto, estado
- Paginación infinita o numérica
- Botón flotante: *"Exportar estos resultados a Excel"* (pasa los filtros actuales)

### 5. 📊 DESCARGAS EXCEL (`/descargas`) — PÁGINA ESTRELLA

**Formulario limpio con 6 campos:**

1. Rango de fechas (obligatorio, default últimos 3 meses)
2. Ámbito geográfico:
   - "Toda la región Junín"
   - "Provincia de Chanchamayo completa"
   - "Distrito específico" (dropdown)
3. Tipos de contratación (multi-select, default todos)
4. Estado (multi-select, default todos)
5. Rango de monto (opcional)
6. Entidad específica (opcional, autocomplete)

**Preview en vivo:**
- A medida que el usuario ajusta filtros, se muestra: *"Se incluirán **1,247 contrataciones** por un total de **S/ 12.3 millones**"*

**Botón grande:** `📥 GENERAR Y DESCARGAR EXCEL`

### Estructura del archivo Excel generado (OBLIGATORIA)

Usa **ExcelJS**. El archivo debe tener **6 hojas**:

#### Hoja 1: "Resumen Ejecutivo" (primera que ve el usuario)
- Header con logo + título del reporte
- Datos de filtros aplicados (rango fechas, ámbito, etc.)
- KPIs en cuadros con color:
  - Total contrataciones
  - Monto total adjudicado
  - Monto promedio
  - Entidades únicas
  - Proveedores únicos
  - % obras vs % bienes vs % servicios
- **Gráfico de barras incrustado:** monto por mes
- **Gráfico de torta incrustado:** distribución por tipo
- Fecha de generación

#### Hoja 2: "Contrataciones" (detalle completo)
Una fila por contratación. Columnas:
- OCID
- Nomenclatura
- Fecha convocatoria
- Fecha adjudicación
- Entidad (RUC + nombre)
- Distrito
- Título
- Descripción
- Tipo
- Procedimiento
- Estado
- Proveedor ganador (RUC + razón social)
- Monto referencial
- Monto adjudicado
- Moneda
- Plazo ejecución
- URL expediente SEACE

**Formato:** header con color institucional, filas alternadas sutilmente, montos con formato de moneda S/.

#### Hoja 3: "Por Entidad"
Tabla dinámica agrupada por entidad contratante:
- Entidad | N° contrataciones | Monto total | Monto promedio | % del total

#### Hoja 4: "Por Proveedor"
Ranking de proveedores ganadores:
- Proveedor | N° adjudicaciones | Monto total ganado | Entidades que le contrataron

#### Hoja 5: "Por Mes"
Serie temporal:
- Mes-Año | N° contrataciones | Monto total
- Con gráfico de línea incrustado

#### Hoja 6: "Por Distrito"
- Distrito | N° contrataciones | Monto total | Principal entidad operadora

**IMPORTANTE:**
- El nombre del archivo debe ser: `contrataciones_{ambito}_{fecha_desde}_{fecha_hasta}.xlsx`
- Incluir portada con logo del proyecto
- Todas las hojas deben tener columnas con ancho ajustado automáticamente
- Freeze panes en la primera fila de cada hoja

### 6. PROVEEDORES (`/proveedores`)

- Buscador por RUC o razón social
- Grid de tarjetas con los top 50 proveedores de Chanchamayo
- Ficha individual (`/proveedores/[ruc]`):
  - Razón social, RUC, ubicación
  - Total ganado histórico
  - Gráfico de evolución
  - Lista de todas sus adjudicaciones
  - Entidades con las que más trabaja

### 7. ENTIDADES (`/entidades`)

- Listado de municipalidades y entidades de Junín
- Ficha individual con:
  - Presupuesto ejecutado en contrataciones
  - Principales proveedores
  - Obras en ejecución
  - Timeline de actividad

### 8. OBSERVATORIO (`/observatorio`)

Página de rankings y análisis:
- Top 10 entidades por monto contratado
- Top 10 proveedores por monto ganado
- % contrataciones directas vs competitivas (indicador de transparencia)
- Entidades con mayor ratio de contrataciones directas (alerta)
- Contrataciones con mayor diferencia entre referencial y adjudicado

### 9. GLOSARIO (`/glosario`)

Diccionario visual de términos SEACE en lenguaje simple:
- ¿Qué es el PAC?
- ¿Qué es una licitación pública?
- Adjudicación Simplificada
- Contratación Directa
- Consorcio
- RNP
- etc.

### 10. ACERCA (`/acerca`)

- Quiénes somos / misión
- Fuentes de datos con links oficiales
- Metodología de actualización
- Limitaciones de los datos
- Cómo contribuir (GitHub)

---

## 🔄 SINCRONIZACIÓN CON LA API OCDS

### Cliente OCDS (`lib/ocds/client.ts`)

```typescript
// Debe implementar:
// - fetchReleases(params): lista paginada de releases
// - fetchRelease(ocid): un release específico completo
// - fetchRecord(ocid): record consolidado
// - Manejo de paginación (page, size)
// - Retry con backoff exponencial
// - Rate limiting amigable (max 5 req/segundo)
// - Cache en memoria de 5 minutos para queries repetidas
```

### Job de sincronización (`scripts/sync-ocds.ts`)

```typescript
// Estrategia:
// 1. Obtener última fecha de sincronización exitosa
// 2. Traer releases desde esa fecha hasta hoy
// 3. Filtrar solo los que pertenecen a ubigeos de Junín (12xxxx)
// 4. Mapear OCDS → schema interno
// 5. Upsert en DB (ON CONFLICT UPDATE)
// 6. Registrar en sync_log
// 7. Manejo robusto de errores (no fallar el batch completo por 1 registro malo)
```

### Cron
- Ejecutar diariamente a las 3am Perú (GMT-5)
- En Render: usar un Background Worker o cron job externo

### Backfill inicial
- Script separado `scripts/initial-backfill.ts` que descarga los CSV históricos de CONOSCE (2018-2024) y hace la carga inicial masiva.
- Ejecutar una sola vez al desplegar.

---

## 🧭 REGLAS DE NEGOCIO Y TRADUCCIÓN CIUDADANA

### Mapeo de jerga → lenguaje simple (`lib/traduccion/jerga.ts`)

```typescript
export const JERGA = {
  // Tipos de procedimiento
  'LP': 'Licitación Pública (compra grande y competitiva)',
  'AS': 'Adjudicación Simplificada (compra mediana)',
  'SM': 'Subasta Inversa (el que ofrece menor precio gana)',
  'CP': 'Concurso Público (para contratar servicios)',
  'CD': 'Contratación Directa (sin competencia, casos excepcionales)',
  'CE': 'Comparación de Precios (compra pequeña)',
  
  // Estados
  'CONVOCADO': 'Convocatoria abierta — empresas pueden postular',
  'ADJUDICADO': 'Ya se eligió al ganador',
  'CONTRATADO': 'Contrato firmado — en ejecución',
  'FINALIZADO': 'Obra o servicio terminado',
  'DESIERTO': 'No se presentó ninguna empresa',
  'NULO': 'Anulado por problemas en el proceso',
  
  // Tipos
  'BIENES': 'Productos (computadoras, mobiliario, medicinas...)',
  'SERVICIOS': 'Servicios (limpieza, vigilancia, consultorías...)',
  'OBRAS': 'Construcciones (pistas, colegios, postas...)',
  'CONSULTORIA': 'Estudios técnicos y profesionales',
};
```

### Indicadores de alerta (badges visuales)
- 🟢 Proceso competitivo (LP, AS con muchos postores)
- 🟡 Pocos postores (menos de 3)
- 🔴 Contratación directa (sin competencia)
- ⚠️ Diferencia inusual entre monto referencial y adjudicado
- ⏱️ Plazo vencido sin finalización reportada

---

## 📱 FEATURES TÉCNICAS IMPORTANTES

### Performance
- SSG (static generation) para páginas de distrito y glosario
- ISR (revalidación cada 1 hora) para páginas con datos
- Server components por defecto, client solo donde haya interactividad
- Imágenes con `next/image`
- Lazy loading de mapas y gráficos pesados

### SEO
- Metadatos dinámicos por página (entidad, distrito, contratación)
- Sitemap.xml generado dinámicamente
- Robots.txt permisivo
- Open Graph images por distrito
- Schema.org GovernmentService

### PWA
- Manifest.json configurado
- Service worker para caché básico
- Instalable en móvil
- Ícono y splash screen

### Accesibilidad
- Contraste AA mínimo en toda la UI
- `aria-label` en íconos sin texto
- Navegación completa por teclado
- Focus rings visibles y no removidos
- Skip to content link

### Analítica (sin tracking invasivo)
- Plausible o Umami (self-hosted, sin cookies)
- Evento: descarga de Excel, búsqueda, filtro aplicado

---

## 🧪 DATOS DE PRUEBA Y DESARROLLO

Durante el desarrollo, usa un seed con ~500 contrataciones reales de Chanchamayo obtenidas de la API. Incluye script:

```bash
npm run db:seed         # Carga ubigeos + 500 contrataciones de muestra
npm run db:sync         # Sincroniza con API OCDS (producción)
npm run db:backfill     # Carga histórica desde CONOSCE (solo primera vez)
```

---

## 🚀 VARIABLES DE ENTORNO

```env
# Database
DATABASE_URL=postgresql://...

# OCDS
OCDS_API_BASE=https://contratacionesabiertas.osce.gob.pe/api

# App
NEXT_PUBLIC_APP_URL=https://vecinovigilante.pe
NEXT_PUBLIC_APP_NAME=Vecino Vigilante

# Sync (protección endpoint)
SYNC_SECRET=<random-string>

# Opcional: analytics
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=vecinovigilante.pe
```

---

## 📋 ORDEN DE IMPLEMENTACIÓN SUGERIDO

**Fase 1 — Fundamentos (empieza aquí)**
1. Setup Next.js + TypeScript + Tailwind + shadcn/ui
2. Configurar Drizzle + PostgreSQL + schema
3. Cliente OCDS básico + pruebas manuales con datos de Junín
4. Seed de ubigeos de Junín
5. Layout global (header, footer, mobile nav)

**Fase 2 — Core de datos**
6. Script de backfill desde CONOSCE
7. Script de sincronización diaria
8. API Routes: contrataciones, entidades, distritos, stats
9. Mapper OCDS → schema interno + tests

**Fase 3 — Páginas principales**
10. Home con KPIs y feed
11. Página de detalle de contratación con timeline OCDS
12. Página de distrito
13. Explorador con filtros

**Fase 4 — Descargas Excel (prioritario)**
14. Generador Excel con las 6 hojas
15. Página de descargas con formulario y preview
16. Gráficos incrustados en Excel

**Fase 5 — Mapa y visualizaciones**
17. Mapa interactivo MapLibre con GeoJSON de Junín
18. Choropleth por provincia/distrito
19. Gráficos Recharts en dashboards

**Fase 6 — Pulido**
20. Proveedores y entidades (páginas y fichas)
21. Observatorio y rankings
22. Glosario y acerca
23. PWA, SEO, accesibilidad
24. Deploy en Render + DB en Neon

---

## ✅ CRITERIOS DE ACEPTACIÓN DEL MVP

- [ ] Funciona en móvil y desktop sin problemas
- [ ] Datos de Chanchamayo actualizados al día anterior
- [ ] Mapa interactivo de Junín clickeable por distrito
- [ ] Generación de Excel con 6 hojas en menos de 10 segundos para 5000 registros
- [ ] Página de detalle con timeline OCDS funcional
- [ ] Accesibilidad AA verificada con Lighthouse
- [ ] Performance Lighthouse > 90 en móvil
- [ ] Todos los términos técnicos tienen tooltip o explicación ciudadana
- [ ] Sin errores de consola en producción
- [ ] Deploy funcional en Render

---

## 🎯 ENTREGABLES

Al finalizar, debes entregar:

1. Aplicación Next.js completa y desplegada
2. Base de datos PostgreSQL con schema aplicado
3. Scripts de sincronización funcionales
4. README.md con instrucciones de setup local
5. .env.example con todas las variables
6. Datos reales de Chanchamayo ya cargados
7. Documentación básica de la API interna

---

## 💡 NOTAS IMPORTANTES PARA QUIEN IMPLEMENTE

- **No inventes endpoints de la API OCDS.** Si no sabes uno, pausa y pregunta. La documentación oficial está en `https://contratacionesabiertas.osce.gob.pe/` → sección datos abiertos.
- **No uses Prisma.** Usa Drizzle ORM.
- **No uses create-react-app.** Usa Next.js 14 App Router.
- **No uses Material UI ni Chakra.** Usa shadcn/ui + Tailwind.
- **No hagas scraping.** Usa solo la API OCDS oficial y descargas CONOSCE.
- **No hardcodees datos.** Todo viene de la DB que se sincroniza con la API.
- **Respeta la paleta y tipografía** — esto define la identidad.
- **Mobile-first siempre.** Nada de "luego lo adapto".
- Si encuentras datos inconsistentes en la API (campos vacíos, fechas raras), **no los descartes** — márcalos como "Información incompleta" y muéstralos igual.

---

**Este prompt es la especificación completa. Comienza por la Fase 1 e itera. Al final de cada fase, haz un commit descriptivo. Despliega en Render apenas termine la Fase 3 para iterar con datos reales.**
