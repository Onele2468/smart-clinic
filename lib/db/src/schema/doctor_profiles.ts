import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { departmentsTable } from "./departments";
import { usersTable } from "./users";

export const doctorProfilesTable = pgTable("doctor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  departmentId: uuid("department_id").references(() => departmentsTable.id),
  specialty: text("specialty"),
  maxPatientsPerDay: integer("max_patients_per_day").notNull().default(20),
  appointmentDurationMinutes: integer("appointment_duration_minutes").notNull().default(30),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDoctorProfileSchema = createInsertSchema(doctorProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDoctorProfile = z.infer<typeof insertDoctorProfileSchema>;
export type DoctorProfile = typeof doctorProfilesTable.$inferSelect;

