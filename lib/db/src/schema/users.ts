import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  userType: text("user_type").notNull().default("staff"), // 'staff' | 'patient'
  role: text("role").notNull().default("doctor"),         // clinic_admin | doctor | nurse | receptionist | pharmacist | lab_technician | cashier | patient
  staffCode: text("staff_code"),                          // DR-001, NR-001, RC-001, CA-001
  governmentIdType: text("government_id_type"),           // 'SA_ID' | 'PASSPORT'
  governmentIdNumber: text("government_id_number"),
  nationality: text("nationality"),                       // e.g. 'South African', 'Zimbabwean'
  emailVerified: boolean("email_verified").notNull().default(false),
  otpCode: text("otp_code"),
  otpExpiresAt: timestamp("otp_expires_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
