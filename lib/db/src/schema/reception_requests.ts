import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { whatsappConversationsTable } from "./whatsapp_conversations";

export const receptionRequestsTable = pgTable("reception_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  patientId: uuid("patient_id").references(() => patientsTable.id),
  conversationId: uuid("conversation_id").notNull().references(() => whatsappConversationsTable.id),
  requestMessage: text("request_message").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReceptionRequestSchema = createInsertSchema(receptionRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReceptionRequest = z.infer<typeof insertReceptionRequestSchema>;
export type ReceptionRequest = typeof receptionRequestsTable.$inferSelect;

