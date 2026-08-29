import { boolean, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { invoicesTable } from "./invoices";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const financialResponsibilityAllocationsTable = pgTable("financial_responsibility_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  payerType: text("payer_type").notNull(), // patient | medical_aid | government | ngo | donor | sponsor | clinic
  payerReference: text("payer_reference"),
  authorizationReference: text("authorization_reference"),
  claimStatus: text("claim_status").notNull().default("not_applicable"),
  allocatedAmount: numeric("allocated_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("due"),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const paymentArrangementsTable = pgTable("payment_arrangements", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  arrangementAmount: numeric("arrangement_amount", { precision: 12, scale: 2 }).notNull(),
  terms: text("terms"),
  schedule: text("schedule"),
  status: text("status").notNull().default("requested"),
  createdById: uuid("created_by_id").notNull().references(() => usersTable.id),
  approvedById: uuid("approved_by_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  cancelledById: uuid("cancelled_by_id").references(() => usersTable.id),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const manualPaymentVerificationsTable = pgTable("manual_payment_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  reference: text("reference"),
  status: text("status").notNull().default("awaiting_manual_verification"),
  createdById: uuid("created_by_id").notNull().references(() => usersTable.id),
  verifiedById: uuid("verified_by_id").references(() => usersTable.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type FinancialResponsibilityAllocation = typeof financialResponsibilityAllocationsTable.$inferSelect;
export type PaymentArrangement = typeof paymentArrangementsTable.$inferSelect;
export type ManualPaymentVerification = typeof manualPaymentVerificationsTable.$inferSelect;
