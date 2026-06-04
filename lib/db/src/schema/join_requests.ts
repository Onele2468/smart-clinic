import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";

export const joinRequestsTable = pgTable("join_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  requestedRole: text("requested_role").notNull(),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJoinRequestSchema = createInsertSchema(joinRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJoinRequest = z.infer<typeof insertJoinRequestSchema>;
export type JoinRequest = typeof joinRequestsTable.$inferSelect;
