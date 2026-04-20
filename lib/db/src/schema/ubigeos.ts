import { pgTable, text, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ubigeosTable = pgTable("ubigeos", {
  codigo: text("codigo").primaryKey(),
  departamento: text("departamento").notNull(),
  provincia: text("provincia").notNull(),
  distrito: text("distrito").notNull(),
  latitud: decimal("latitud", { precision: 10, scale: 7 }),
  longitud: decimal("longitud", { precision: 10, scale: 7 }),
  superficieKm2: decimal("superficie_km2"),
  altitud: integer("altitud"),
});

export const insertUbigeoSchema = createInsertSchema(ubigeosTable);
export type InsertUbigeo = z.infer<typeof insertUbigeoSchema>;
export type Ubigeo = typeof ubigeosTable.$inferSelect;
