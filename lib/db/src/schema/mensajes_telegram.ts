import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mensajesTelegramTable = pgTable("mensajes_telegram", {
  id: uuid("id").defaultRandom().primaryKey(),
  chatId: text("chat_id"),
  mensajeTexto: text("mensaje_texto").notNull(),
  fecha: timestamp("fecha", { withTimezone: true }).defaultNow(),
  procesado: boolean("procesado").default(false),
});

export const insertMensajeTelegramSchema = createInsertSchema(mensajesTelegramTable);
export type InsertMensajeTelegram = z.infer<typeof insertMensajeTelegramSchema>;
export type MensajeTelegram = typeof mensajesTelegramTable.$inferSelect;
