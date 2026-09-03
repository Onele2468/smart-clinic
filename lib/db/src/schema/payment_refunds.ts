import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { invoicesTable, paymentsTable } from "./invoices";
import { paymentProviderTransactionsTable } from "./payment_provider_transactions";
import { usersTable } from "./users";

export const paymentRefundsTable = pgTable("payment_refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id),
  paymentId: uuid("payment_id").notNull().references(() => paymentsTable.id),
  providerTransactionId: uuid("provider_transaction_id").references(() => paymentProviderTransactionsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  refundMethod: text("refund_method").notNull(),
  providerRefundId: text("provider_refund_id"),
  status: text("status").notNull().default("pending"),
  origin: text("origin").notNull(),
  reason: text("reason"),
  authorisedById: uuid("authorised_by_id").references(() => usersTable.id),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PaymentRefund = typeof paymentRefundsTable.$inferSelect;
