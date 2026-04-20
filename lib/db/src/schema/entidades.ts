import { pgTable, text, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ubigeosTable } from "./ubigeos";

export const entidadesTable = pgTable("entidades", {
  ruc: text("ruc").primaryKey(),
  nombre: text("nombre").notNull(),
  tipo: text("tipo"),
  ubigeoCodigo: text("ubigeo_codigo").references(() => ubigeosTable.codigo),
  nivelGobierno: text("nivel_gobierno"),
}, (t) => [
  index("entidades_ubigeo_idx").on(t.ubigeoCodigo),
]);

export const insertEntidadSchema = createInsertSchema(entidadesTable);
export type InsertEntidad = z.infer<typeof insertEntidadSchema>;
export type Entidad = typeof entidadesTable.$inferSelect;
