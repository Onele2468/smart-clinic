ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "working_days" jsonb DEFAULT '[1,2,3,4,5]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "appointment_slot_duration_minutes" integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "max_patients_per_slot" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "online_booking_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "whatsapp_self_service_booking_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "entity_id" uuid;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "target_url" text;
