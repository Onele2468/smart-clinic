import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const queueEntriesTable = pgTable("queue_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  ticketNumber: text("ticket_number").notNull(),
  type: text("type").notNull().default("registration"),
  status: text("status").notNull().default("waiting"),
  priority: integer("priority").notNull().default(0),
  assignedDoctorId: uuid("assigned_doctor_id").references(() => usersTable.id),
  assignedNurseId: uuid("assigned_nurse_id").references(() => usersTable.id),
  notes: text("notes"),
  calledAt: timestamp("called_at", { withTimezone: true }),
  nurseStartedAt: timestamp("nurse_started_at", { withTimezone: true }),
  doctorStartedAt: timestamp("doctor_started_at", { withTimezone: true }),
  pharmacyAt: timestamp("pharmacy_at", { withTimezone: true }),
  labAt: timestamp("lab_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQueueEntrySchema = createInsertSchema(queueEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQueueEntry = z.infer<typeof insertQueueEntrySchema>;
export type QueueEntry = typeof queueEntriesTable.$inferSelect;
