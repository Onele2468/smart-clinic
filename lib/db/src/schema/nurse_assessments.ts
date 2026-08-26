import { pgTable, text, timestamp, uuid, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { usersTable } from "./users";
import { queueEntriesTable } from "./queues";

export const nurseAssessmentsTable = pgTable("nurse_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  nurseId: uuid("nurse_id").notNull().references(() => usersTable.id),
  queueEntryId: uuid("queue_entry_id").references(() => queueEntriesTable.id),
  // Vitals
  bloodPressure: text("blood_pressure"),
  temperature: text("temperature"),
  pulseRate: text("pulse_rate"),
  oxygenSaturation: text("oxygen_saturation"),
  weight: text("weight"),
  height: text("height"),
  bloodSugar: text("blood_sugar"),
  // Assessment
  symptoms: text("symptoms"),
  triageNotes: text("triage_notes"),
  triageLevel: text("triage_level").default("normal"), // emergency | urgent | normal | non_urgent
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertNurseAssessmentSchema = createInsertSchema(nurseAssessmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNurseAssessment = z.infer<typeof insertNurseAssessmentSchema>;
export type NurseAssessment = typeof nurseAssessmentsTable.$inferSelect;
