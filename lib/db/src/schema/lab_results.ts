import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { labRequestsTable } from "./lab_requests";
import { usersTable } from "./users";
import { patientsTable } from "./patients";

export const labResultsTable = pgTable("lab_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  labRequestId: uuid("lab_request_id").notNull().references(() => labRequestsTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  technicianId: uuid("technician_id").references(() => usersTable.id),
  testName: text("test_name").notNull(),
  resultSummary: text("result_summary").notNull(),
  resultText: text("result_text").notNull(),
  resultNotes: text("result_notes"),
  status: text("status").notNull().default("preliminary"), // preliminary | final | amended
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLabResultSchema = createInsertSchema(labResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLabResult = z.infer<typeof insertLabResultSchema>;
export type LabResult = typeof labResultsTable.$inferSelect;
