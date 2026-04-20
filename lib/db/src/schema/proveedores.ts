import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ubigeosTable } from "./ubigeos";

export const proveedoresTable = pgTable("proveedores", {
  ruc: text("ruc").primaryKey(),
  razonSocial: text("razon_social").notNull(),
  ubigeoCodigo: text("ubigeo_codigo").references(() => ubigeosTable.codigo),
  vigenteRnp: text("vigente_rnp"),
});

export const insertProveedorSchema = createInsertSchema(proveedoresTable);
export type InsertProveedor = z.infer<typeof insertProveedorSchema>;
export type Proveedor = typeof proveedoresTable.$inferSelect;
