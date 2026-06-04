import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const appointmentsTable = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  doctorId: uuid("doctor_id").notNull().references(() => usersTable.id),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  type: text("type").notNull().default("consultation"),
  status: text("status").notNull().default("scheduled"),
  visitReason: text("visit_reason"),
  notes: text("notes"),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
