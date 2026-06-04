CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL REFERENCES "clinics"("id"),
  "patient_id" uuid REFERENCES "patients"("id"),
  "action_type" text NOT NULL,
  "entity_id" uuid,
  "reminder_key" text,
  "recipient_phone" text NOT NULL,
  "meta_message_id" text,
  "delivery_status" text DEFAULT 'pending' NOT NULL,
  "failure_type" text,
  "error_code" integer,
  "error_message" text,
  "body_preview" text,
  "template_name" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_retry_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "read_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "whatsapp_messages_clinic_status_idx" ON "whatsapp_messages" ("clinic_id", "delivery_status");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_meta_message_id_idx" ON "whatsapp_messages" ("meta_message_id");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_dedupe_idx" ON "whatsapp_messages" ("clinic_id", "action_type", "entity_id", "reminder_key");

ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "whatsapp_templates_config" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "whatsapp_reminder_config" jsonb DEFAULT '{"enabled":false,"appointmentReminders":{"enabled":true,"hoursBefore":[24,1]},"followUpReminders":{"enabled":true,"daysAfterConsultation":[7]}}'::jsonb NOT NULL;
