import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const personasTable = pgTable("personas", {
  id: uuid("id").defaultRandom().primaryKey(),
  dni: text("dni").notNull().unique(),
  nombre: text("nombre").notNull(),
  direccion: text("direccion"),
  fotoUrl: text("foto_url"),
  fechaCreacion: timestamp("fecha_creacion", { withTimezone: true }).defaultNow(),
});

export const insertPersonaSchema = createInsertSchema(personasTable);
export type InsertPersona = z.infer<typeof insertPersonaSchema>;
export type Persona = typeof personasTable.$inferSelect;
