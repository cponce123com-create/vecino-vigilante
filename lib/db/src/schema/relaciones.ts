import { pgTable, pgEnum, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { personasTable } from "./personas";

export const tipoRelacionEnum = pgEnum("tipo_relacion", [
  "PADRE_DE",
  "MADRE_DE",
  "HERMANO_DE",
  "CONYUGE_DE",
  "HIJO_DE",
]);

export const relacionesTable = pgTable("relaciones", {
  id: uuid("id").defaultRandom().primaryKey(),
  persona1Id: uuid("persona1_id")
    .notNull()
    .references(() => personasTable.id),
  persona2Id: uuid("persona2_id")
    .notNull()
    .references(() => personasTable.id),
  tipoRelacion: tipoRelacionEnum("tipo_relacion").notNull(),
  fechaCreacion: timestamp("fecha_creacion", { withTimezone: true }).defaultNow(),
});

export const insertRelacionSchema = createInsertSchema(relacionesTable);
export type InsertRelacion = z.infer<typeof insertRelacionSchema>;
export type Relacion = typeof relacionesTable.$inferSelect;
