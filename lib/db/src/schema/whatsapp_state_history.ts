import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { whatsappConversationsTable } from "./whatsapp_conversations";

export const whatsappStateHistoryTable = pgTable("whatsapp_state_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  conversationId: uuid("conversation_id").notNull().references(() => whatsappConversationsTable.id),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  intent: text("intent"),
  messageText: text("message_text"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWhatsappStateHistorySchema = createInsertSchema(whatsappStateHistoryTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWhatsappStateHistory = z.infer<typeof insertWhatsappStateHistorySchema>;
export type WhatsappStateHistory = typeof whatsappStateHistoryTable.$inferSelect;

