import { pgTable, text, timestamp, uuid, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { whatsappConversationsTable } from "./whatsapp_conversations";

/** persisted delivery lifecycle for outbound WhatsApp messages */
export const whatsappMessagesTable = pgTable(
  "whatsapp_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id),
    patientId: uuid("patient_id").references(() => patientsTable.id),
    conversationId: uuid("conversation_id").references(() => whatsappConversationsTable.id),
    direction: text("direction").notNull().default("outbound"),
    messageText: text("message_text"),
    actionType: text("action_type").notNull(),
    entityId: uuid("entity_id"),
    reminderKey: text("reminder_key"),
    recipientPhone: text("recipient_phone").notNull(),
    metaMessageId: text("meta_message_id"),
    deliveryStatus: text("delivery_status").notNull().default("pending"),
    failureType: text("failure_type"),
    errorCode: integer("error_code"),
    errorMessage: text("error_message"),
    bodyPreview: text("body_preview"),
    templateName: text("template_name"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    clinicStatusIdx: index("whatsapp_messages_clinic_status_idx").on(table.clinicId, table.deliveryStatus),
    metaMessageIdx: index("whatsapp_messages_meta_message_id_idx").on(table.metaMessageId),
    uniqueMetaMessageIdx: uniqueIndex("whatsapp_messages_meta_message_id_unique").on(table.metaMessageId),
    dedupeIdx: index("whatsapp_messages_dedupe_idx").on(
      table.clinicId,
      table.actionType,
      table.entityId,
      table.reminderKey,
    ),
  }),
);

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappMessage = typeof whatsappMessagesTable.$inferSelect;
