# Vecino Vigilante Chanchamayo

## Overview

Portal de transparencia en contrataciones públicas de la provincia de Chanchamayo (Junín, Perú). Utiliza datos OCDS/SEACE para que ciudadanos, periodistas y activistas puedan vigilar obras, bienes, servicios, consultoría y órdenes de compra.

pnpm workspace monorepo usando TypeScript. Cada paquete gestiona sus propias dependencias.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: React 19 + Vite + Wouter + TanStack Query + Shadcn/UI + Recharts
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec → `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally (PORT=3001)
- `node scripts/sync-local.mjs` — sincronización local desde Perú (requiere IP peruana)

## Workflows activos

- **Start application** — Frontend Vite en puerto 5173
- **Start API server** — Express API en puerto 3001

## Estructura principal

```
artifacts/
  vecino-vigilante/       # Frontend React/Vite
    src/pages/
      home.tsx            # Página principal
      explorador.tsx      # Buscador con filtros (tipo, estado, procedimiento, observadas)
      observatorio.tsx    # Rankings, gráfico por tipo, contrataciones observadas
      fuentes.tsx         # Portales externos (SEACE, MEF, OSCE, gob.pe)
      proximamente.tsx    # Página para provincias no disponibles aún
      admin.tsx           # Subida de ZIP/CSV desde OECE
      contratacion.tsx    # Detalle de una contratación
      entidades.tsx/entidad.tsx
      proveedores.tsx/proveedor.tsx
    src/components/
      navbar.tsx          # Barra de navegación (9 links)
      geo-selector.tsx    # Selector Región/Provincia/Distrito (barra secundaria)
      contratacion-card.tsx
  api-server/             # Backend Express 5
    src/routes/
      sync.ts             # Upload ZIP/CSV, parseo, upsert en BD
      contrataciones.ts   # Listado y detalle con filtros (observada, tipo, estado...)
      observatorio.ts     # Rankings, alertas, observadas
      stats.ts            # Estadísticas generales
lib/
  db/src/schema/          # Drizzle ORM schemas (contrataciones, partes, contratos...)
  api-spec/openapi.yaml   # Fuente de verdad del API — modifícalo primero
scripts/
  sync-local.mjs          # Script de sincronización directa desde Perú
```

## Datos soportados (CSV de OECE)

- `Registros.csv` — obligatorio, metadatos de cada proceso
- `Ent_PartesInvolucradas.csv` — obligatorio, entidades y proveedores
- `Ent_Adjudicaciones.csv` — adjudicaciones
- `Ent_Contratos.csv` — contratos firmados
- `Ent_Adj_ArticulosAdjudicados.csv` — ítems adjudicados
- `Ent_Ordenes.csv` — órdenes de compra/servicio
- `Ent_Observaciones.csv` — observaciones formales a procesos

## Geo-selector

El selector en la barra secundaria muestra Región → Provincia → Distrito.  
Por ahora sólo **Chanchamayo (Junín)** está activo. Las demás provincias redirigen a `/proximamente`.

## Fuentes externas integradas

Portal `/fuentes` con enlaces directos a:
- Publicaciones e informes municipales (gob.pe)
- Normas legales municipales (gob.pe)  
- SEACE: buscador público, contratos, antecedentes de proveedores, certificados logísticos
- MEF Transparencia: obras, proyectos inversión, órdenes de compra
- OSCE: perfil de proveedores

## Notas

- La API OCDS bloquea IPs extranjeras (403). Usar `scripts/sync-local.mjs` desde Perú o subir el ZIP manualmente desde el panel Admin.
- UBIGEO de Chanchamayo: 120301–120306 (La Merced, Perené, Pichanaki, San Luis de Shuaro, San Ramón, Vitoc).
- `id_entidad=11129` en Transparencia.gob.pe es la Municipalidad Provincial de Chanchamayo.
