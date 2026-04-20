import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const syncLogTable = pgTable("sync_log", {
  id: text("id").primaryKey(),
  fechaEjecucion: timestamp("fecha_ejecucion", { withTimezone: true }).defaultNow(),
  registrosProcesados: integer("registros_procesados"),
  registrosNuevos: integer("registros_nuevos"),
  registrosActualizados: integer("registros_actualizados"),
  errores: jsonb("errores"),
  estado: text("estado"),
});

export const insertSyncLogSchema = createInsertSchema(syncLogTable);
export type InsertSyncLog = z.infer<typeof insertSyncLogSchema>;
export type SyncLog = typeof syncLogTable.$inferSelect;
