-- Per-clinic WhatsApp outbound delivery settings (run if not using drizzle migrate)
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS whatsapp_outbound_template text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS whatsapp_messaging_mode text NOT NULL DEFAULT 'auto';
