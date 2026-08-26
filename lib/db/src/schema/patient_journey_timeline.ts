import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const patientJourneyTimelineTable = pgTable("patient_journey_timeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  patientId: uuid("patient_id").notNull().references(() => patientsTable.id),
  actorUserId: uuid("actor_user_id").references(() => usersTable.id),
  module: text("module").notNull(),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PatientJourneyTimeline = typeof patientJourneyTimelineTable.$inferSelect;
export type InsertPatientJourneyTimeline = typeof patientJourneyTimelineTable.$inferInsert;
