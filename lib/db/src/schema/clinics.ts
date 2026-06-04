import { pgTable, text, timestamp, uuid, boolean, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const clinicsTable = pgTable("clinics", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  clinicType: text("clinic_type").notNull().default("private"), // private | government | ngo
  address: text("address").notNull(),
  city: text("city").notNull(),
  province: text("province").notNull(),
  contactNumber: text("contact_number").notNull(),
  email: text("email").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // Billing feature flags
  billingEnabled: boolean("billing_enabled").notNull().default(true),
  consultationFeeEnabled: boolean("consultation_fee_enabled").notNull().default(true),
  pharmacyBillingEnabled: boolean("pharmacy_billing_enabled").notNull().default(true),
  labBillingEnabled: boolean("lab_billing_enabled").notNull().default(true),
  bankName: text("bank_name"),
  bankAccountHolder: text("bank_account_holder"),
  bankAccountNumber: text("bank_account_number"),
  bankBranchCode: text("bank_branch_code"),
  paymentReferenceInstructions: text("payment_reference_instructions"),
  // WhatsApp automation (per-clinic credentials)
  whatsappEnabled: boolean("whatsapp_enabled").notNull().default(false),
  whatsappProvider: text("whatsapp_provider").notNull().default("meta"), // meta | twilio | 360dialog
  whatsappAccessToken: text("whatsapp_access_token"),
  whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
  whatsappBusinessAccountId: text("whatsapp_business_account_id"),
  /** Approved Meta template name for business-initiated patient messages (e.g. hello_world). */
  whatsappOutboundTemplate: text("whatsapp_outbound_template"),
  /** text | template | auto — auto tries session text then falls back to template. */
  whatsappMessagingMode: text("whatsapp_messaging_mode").notNull().default("auto"),
  /** Per-action approved Meta template names (e.g. { "appointment_booked": "clinic_appt_confirm" }). */
  whatsappTemplatesConfig: jsonb("whatsapp_templates_config").notNull().default({}),
  /** Clinic-scoped appointment / follow-up reminder schedules. */
  whatsappReminderConfig: jsonb("whatsapp_reminder_config").notNull().default({
    enabled: false,
    appointmentReminders: { enabled: true, hoursBefore: [24, 1] },
    followUpReminders: { enabled: true, daysAfterConsultation: [7] },
  }),
  // Operational clinic alerts (WhatsApp to clinic staff/manager)
  operationalAlertsConfig: jsonb("operational_alerts_config").notNull().default({
    enabled: false,
    recipientPhone: null,
    patientRegistered: { enabled: true },
    queueThreshold: { enabled: true, threshold: 10 },
    lowInventory: { enabled: true },
    labRequestCreated: { enabled: true },
    unpaidInvoices: { enabled: true, threshold: 5 },
    staffJoinRequest: { enabled: true },
    highPatientVolume: { enabled: true, threshold: 50 },
  }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClinicSchema = createInsertSchema(clinicsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Clinic = typeof clinicsTable.$inferSelect;

// Schema for creating a clinic (without ownerUserId - set by backend)
export const createClinicSchema = createInsertSchema(clinicsTable).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  ownerUserId: true 
});
export type CreateClinic = z.infer<typeof createClinicSchema>;
