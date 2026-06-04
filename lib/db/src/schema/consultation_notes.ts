import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { usersTable } from "./users";
import { queueEntriesTable } from "./queues";
import { appointmentsTable } from "./appointments";

export const consultationNotesTable = pgTable("consultation_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  doctorId: uuid("doctor_id").notNull().references(() => usersTable.id),
  queueEntryId: uuid("queue_entry_id").references(() => queueEntriesTable.id),
  appointmentId: uuid("appointment_id").references(() => appointmentsTable.id),
  consultationCode: text("consultation_code"),
  status: text("status").notNull().default("in_progress"),
  chiefComplaint: text("chief_complaint"),
  symptoms: text("symptoms"),
  vitalSigns: text("vital_signs"),
  diagnosis: text("diagnosis"),
  prescription: text("prescription"),
  treatmentPlan: text("treatment_plan"),
  followUpInstructions: text("follow_up_instructions"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertConsultationNoteSchema = createInsertSchema(consultationNotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConsultationNote = z.infer<typeof insertConsultationNoteSchema>;
export type ConsultationNote = typeof consultationNotesTable.$inferSelect;
