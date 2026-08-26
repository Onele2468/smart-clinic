import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";

export const clinicMembersTable = pgTable("clinic_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClinicMemberSchema = createInsertSchema(clinicMembersTable).omit({ id: true, joinedAt: true, updatedAt: true });
export type InsertClinicMember = z.infer<typeof insertClinicMemberSchema>;
export type ClinicMember = typeof clinicMembersTable.$inferSelect;
