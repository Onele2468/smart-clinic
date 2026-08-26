import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clinicsTable } from "./clinics";

export const staffAvailabilityTable = pgTable("staff_availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("offline"), // available | busy | in_consultation | offline | on_break
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("staff_availability_user_clinic_unique").on(t.userId, t.clinicId),
]);

export type StaffAvailability = typeof staffAvailabilityTable.$inferSelect;
