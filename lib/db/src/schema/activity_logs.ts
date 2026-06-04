import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";

export const activityLogsTable = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  userId: uuid("user_id").references(() => usersTable.id),
  userRole: text("user_role"),
  module: text("module"),
  actionType: text("action_type"),
  type: text("type").notNull(),
  message: text("message").notNull(),
  entityId: uuid("entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogsTable).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogsTable.$inferSelect;
