import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { appointmentsTable } from "./appointments";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";

export const appointmentCancellationsTable = pgTable("appointment_cancellations", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  appointmentId: uuid("appointment_id").notNull().references(() => appointmentsTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  cancellationReason: text("cancellation_reason").notNull(),
  cancelledBy: text("cancelled_by").notNull().default("patient_whatsapp"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppointmentCancellationSchema = createInsertSchema(appointmentCancellationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAppointmentCancellation = z.infer<typeof insertAppointmentCancellationSchema>;
export type AppointmentCancellation = typeof appointmentCancellationsTable.$inferSelect;

