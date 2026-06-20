import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { appointmentsTable } from "./appointments";
import { usersTable } from "./users";

export const queueAuditLogsTable = pgTable("queue_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  appointmentId: uuid("appointment_id").references(() => appointmentsTable.id),
  staffId: uuid("staff_id").references(() => usersTable.id),
  oldStatus: text("old_status"),
  newStatus: text("new_status"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type QueueAuditLog = typeof queueAuditLogsTable.$inferSelect;
export type InsertQueueAuditLog = typeof queueAuditLogsTable.$inferInsert;
