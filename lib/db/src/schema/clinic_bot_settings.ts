import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";

export const clinicBotSettingsTable = pgTable("clinic_bot_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  botEnabled: boolean("bot_enabled").notNull().default(true),
  welcomeMessage: text("welcome_message"),
  bookingEnabled: boolean("booking_enabled").notNull().default(true),
  selfServiceEnabled: boolean("self_service_enabled").notNull().default(true),
  clinicHours: jsonb("clinic_hours").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClinicBotSettingsSchema = createInsertSchema(clinicBotSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClinicBotSettings = z.infer<typeof insertClinicBotSettingsSchema>;
export type ClinicBotSettings = typeof clinicBotSettingsTable.$inferSelect;

