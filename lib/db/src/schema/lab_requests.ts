import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const labRequestsTable = pgTable("lab_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  doctorId: uuid("doctor_id").notNull().references(() => usersTable.id),
  requestCode: text("request_code").notNull(),
  testName: text("test_name").notNull(),
  testCategory: text("test_category").notNull().default("blood"),
  urgency: text("urgency").notNull().default("routine"), // routine | urgent | stat
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending | in_progress | completed | cancelled
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLabRequestSchema = createInsertSchema(labRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLabRequest = z.infer<typeof insertLabRequestSchema>;
export type LabRequest = typeof labRequestsTable.$inferSelect;
