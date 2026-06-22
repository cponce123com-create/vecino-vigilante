import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const etiquetasTable = pgTable("etiquetas", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull().unique(),
  descripcion: text("descripcion"),
});

export const insertEtiquetaSchema = createInsertSchema(etiquetasTable);
export type InsertEtiqueta = z.infer<typeof insertEtiquetaSchema>;
export type Etiqueta = typeof etiquetasTable.$inferSelect;
