import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { usersTable } from "./users";
import { consultationNotesTable } from "./consultation_notes";

export const referralsTable = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  consultationId: uuid("consultation_id").references(() => consultationNotesTable.id),
  referringDoctorId: uuid("referring_doctor_id").references(() => usersTable.id),
  targetClinicId: uuid("target_clinic_id").references(() => clinicsTable.id),
  referralType: text("referral_type").notNull().default("external"),
  destinationName: text("destination_name").notNull(),
  specialty: text("specialty"),
  urgency: text("urgency").notNull().default("routine"),
  reason: text("reason").notNull(),
  clinicalSummary: text("clinical_summary"),
  documentText: text("document_text"),
  status: text("status").notNull().default("pending"),
  consentGiven: boolean("consent_given").notNull().default(false),
  consentGivenAt: timestamp("consent_given_at", { withTimezone: true }),
  createdById: uuid("created_by").notNull().references(() => usersTable.id),
  acceptedById: uuid("accepted_by").references(() => usersTable.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  rejectedById: uuid("rejected_by").references(() => usersTable.id),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const referralDocumentsTable = pgTable("referral_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  referralId: uuid("referral_id").notNull().references(() => referralsTable.id),
  documentType: text("document_type").notNull().default("referral_letter"),
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  documentText: text("document_text"),
  createdById: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referralStatusHistoryTable = pgTable("referral_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  referralId: uuid("referral_id").notNull().references(() => referralsTable.id),
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  notes: text("notes"),
  createdById: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReferralSchema = createInsertSchema(referralsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertReferralDocumentSchema = createInsertSchema(referralDocumentsTable).omit({ id: true, createdAt: true });
export const insertReferralStatusHistorySchema = createInsertSchema(referralStatusHistoryTable).omit({ id: true, createdAt: true });

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referralsTable.$inferSelect;
export type ReferralDocument = typeof referralDocumentsTable.$inferSelect;
export type ReferralStatusHistory = typeof referralStatusHistoryTable.$inferSelect;
