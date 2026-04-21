import { pgTable, text, decimal, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contratacionesTable } from "./contrataciones";

export const articulosAdjudicadosTable = pgTable("articulos_adjudicados", {
  id: text("id").primaryKey(),
  ocid: text("ocid").notNull().references(() => contratacionesTable.ocid, { onDelete: "cascade" }),
  posicion: integer("posicion"),
  descripcion: text("descripcion").notNull(),
  clasificacionId: text("clasificacion_id"),
  clasificacionDesc: text("clasificacion_desc"),
  cantidad: decimal("cantidad", { precision: 15, scale: 4 }),
  unidadNombre: text("unidad_nombre"),
  montoTotal: decimal("monto_total", { precision: 15, scale: 2 }),
  moneda: text("moneda").default("PEN"),
  estado: text("estado"),
}, (t) => [
  index("articulos_ocid_idx").on(t.ocid),
]);

export const insertArticuloAdjudicadoSchema = createInsertSchema(articulosAdjudicadosTable);
export type InsertArticuloAdjudicado = z.infer<typeof insertArticuloAdjudicadoSchema>;
export type ArticuloAdjudicado = typeof articulosAdjudicadosTable.$inferSelect;
