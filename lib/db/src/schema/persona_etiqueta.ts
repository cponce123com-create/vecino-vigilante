import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { personasTable } from "./personas";
import { etiquetasTable } from "./etiquetas";

export const personaEtiquetasTable = pgTable("persona_etiquetas", {
  personaId: uuid("persona_id")
    .notNull()
    .references(() => personasTable.id),
  etiquetaId: uuid("etiqueta_id")
    .notNull()
    .references(() => etiquetasTable.id),
}, (t) => [
  primaryKey({ columns: [t.personaId, t.etiquetaId] }),
]);
