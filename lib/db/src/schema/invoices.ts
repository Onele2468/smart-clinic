import { pgTable, text, timestamp, uuid, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const invoicesTable = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  doctorId: uuid("doctor_id").references(() => usersTable.id),
  invoiceCode: text("invoice_code").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("unpaid"), // unpaid | partial | paid | cancelled
  notes: text("notes"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const invoiceItemsTable = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id),
  type: text("type").notNull().default("consultation"), // consultation | medication | laboratory | procedure
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  receivedById: uuid("received_by_id").references(() => usersTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"), // cash | card | transfer | mobile_money
  reference: text("reference"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
