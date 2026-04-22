import { pgTable, text, integer, decimal, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ubigeosTable } from "./ubigeos";
import { entidadesTable } from "./entidades";
import { proveedoresTable } from "./proveedores";

export const contratacionesTable = pgTable("contrataciones", {
  ocid: text("ocid").primaryKey(),
  nomenclatura: text("nomenclatura"),
  titulo: text("titulo").notNull(),
  descripcion: text("descripcion"),
  tipo: text("tipo"),
  procedimiento: text("procedimiento"),
  estado: text("estado"),
  entidadRuc: text("entidad_ruc").references(() => entidadesTable.ruc),
  proveedorRuc: text("proveedor_ruc").references(() => proveedoresTable.ruc),
  ubigeoCodigo: text("ubigeo_codigo").references(() => ubigeosTable.codigo),
  montoReferencial: decimal("monto_referencial", { precision: 15, scale: 2 }),
  montoAdjudicado: decimal("monto_adjudicado", { precision: 15, scale: 2 }),
  moneda: text("moneda").default("PEN"),
  fechaConvocatoria: timestamp("fecha_convocatoria", { withTimezone: true }),
  fechaAdjudicacion: timestamp("fecha_adjudicacion", { withTimezone: true }),
  fechaContrato: timestamp("fecha_contrato", { withTimezone: true }),
  plazoEjecucionDias: integer("plazo_ejecucion_dias"),
  observacionesCount: integer("observaciones_count").default(0),
  rawOcds: jsonb("raw_ocds"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("contrataciones_ubigeo_idx").on(t.ubigeoCodigo),
  index("contrataciones_entidad_idx").on(t.entidadRuc),
  index("contrataciones_fecha_idx").on(t.fechaConvocatoria),
  index("contrataciones_estado_idx").on(t.estado),
]);

export const insertContratacionSchema = createInsertSchema(contratacionesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertContratacion = z.infer<typeof insertContratacionSchema>;
export type Contratacion = typeof contratacionesTable.$inferSelect;
