ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "whatsapp_outbound_template" text;
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "whatsapp_messaging_mode" text DEFAULT 'auto' NOT NULL;
