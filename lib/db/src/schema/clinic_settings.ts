import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";

export const clinicSettingsTable = pgTable("clinic_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  timezone: text("timezone").notNull(),
  openingTime: text("opening_time").notNull(),
  closingTime: text("closing_time").notNull(),
  workingDays: jsonb("working_days").notNull().default([1, 2, 3, 4, 5]),
  appointmentSlotDurationMinutes: integer("appointment_slot_duration_minutes").notNull().default(30),
  bookingWindowDays: integer("booking_window_days").notNull(),
  maxPatientsPerSlot: integer("max_patients_per_slot").notNull().default(1),
  allowWalkins: boolean("allow_walkins").notNull().default(false),
  onlineBookingEnabled: boolean("online_booking_enabled").notNull().default(true),
  whatsappSelfServiceBookingEnabled: boolean("whatsapp_self_service_booking_enabled").notNull().default(true),
  maxBookingsPerDay: integer("max_bookings_per_day"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClinicSettingsSchema = createInsertSchema(clinicSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClinicSettings = z.infer<typeof insertClinicSettingsSchema>;
export type ClinicSettings = typeof clinicSettingsTable.$inferSelect;
