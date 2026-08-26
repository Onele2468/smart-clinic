import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";

export const patientsTable = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  userId: uuid("user_id").references(() => usersTable.id),
  patientCode: text("patient_code").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  gender: text("gender").notNull(),
  contactNumber: text("contact_number").notNull(),
  email: text("email"),
  address: text("address"),
  bloodType: text("blood_type"),
  allergies: text("allergies"),
  chronicConditions: text("chronic_conditions"),
  medicalHistory: text("medical_history"),
  medicalAidName: text("medical_aid_name"),
  medicalAidNumber: text("medical_aid_number"),
  governmentIdType: text("government_id_type"),       // 'SA_ID' | 'PASSPORT'
  governmentIdNumber: text("government_id_number"),
  primaryDoctorId: uuid("primary_doctor_id").references(() => usersTable.id),
  backupDoctorId: uuid("backup_doctor_id").references(() => usersTable.id),
  nationality: text("nationality"),                   // e.g. 'South African', 'Zimbabwean'
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
