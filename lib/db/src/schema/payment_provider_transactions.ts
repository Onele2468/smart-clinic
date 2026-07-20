import { pgTable, text, timestamp, uuid, numeric, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { invoicesTable } from "./invoices";

export const paymentProviderTransactionsTable = pgTable("payment_provider_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  provider: text("provider").notNull(),
  providerTransactionId: text("provider_transaction_id"),
  providerCheckoutId: text("provider_checkout_id"),
  providerReference: text("provider_reference"),
  checkoutUrl: text("checkout_url"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("created"),
  mode: text("mode").notNull().default("test"),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata").notNull().default({}),
  rawProviderPayload: jsonb("raw_provider_payload"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => ({
  idempotencyKeyUnique: uniqueIndex("payment_provider_transactions_idempotency_key_unique").on(table.idempotencyKey),
}));

export const paymentProviderEventsTable = pgTable("payment_provider_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").references(() => clinicsTable.id),
  transactionId: uuid("transaction_id").references(() => paymentProviderTransactionsTable.id),
  provider: text("provider").notNull(),
  providerEventId: text("provider_event_id").notNull(),
  eventType: text("event_type").notNull(),
  rawPayload: jsonb("raw_payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  providerEventUnique: uniqueIndex("payment_provider_events_provider_event_unique").on(table.provider, table.providerEventId),
}));

export type PaymentProviderTransaction = typeof paymentProviderTransactionsTable.$inferSelect;
export type InsertPaymentProviderTransaction = typeof paymentProviderTransactionsTable.$inferInsert;
export type PaymentProviderEvent = typeof paymentProviderEventsTable.$inferSelect;
export type InsertPaymentProviderEvent = typeof paymentProviderEventsTable.$inferInsert;
