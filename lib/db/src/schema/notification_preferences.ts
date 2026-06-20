import { boolean, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";

export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  appointmentBooked: boolean("appointment_booked"),
  appointmentReminder: boolean("appointment_reminder"),
  appointmentCheckedIn: boolean("appointment_checked_in"),
  nurseAssessmentComplete: boolean("nurse_assessment_complete"),
  labRequested: boolean("lab_requested"),
  labResultReady: boolean("lab_result_ready"),
  prescriptionIssued: boolean("prescription_issued"),
  medicationReady: boolean("medication_ready"),
  visitCompleted: boolean("visit_completed"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export type NotificationPreferences = typeof notificationPreferencesTable.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferencesTable.$inferInsert;
