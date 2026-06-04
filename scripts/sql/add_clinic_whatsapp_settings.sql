-- Per-clinic WhatsApp Cloud API credentials and feature flag.
-- Run against your Postgres database (e.g. psql or Supabase SQL editor).

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_provider text NOT NULL DEFAULT 'meta',
  ADD COLUMN IF NOT EXISTS whatsapp_access_token text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_business_account_id text;
