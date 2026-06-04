-- WhatsApp production hardening (delivery tracking, reminders, templates)

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  patient_id uuid REFERENCES patients(id),
  action_type text NOT NULL,
  entity_id uuid,
  reminder_key text,
  recipient_phone text NOT NULL,
  meta_message_id text,
  delivery_status text NOT NULL DEFAULT 'pending',
  failure_type text,
  error_code integer,
  error_message text,
  body_preview text,
  template_name text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_clinic_status_idx ON whatsapp_messages (clinic_id, delivery_status);
CREATE INDEX IF NOT EXISTS whatsapp_messages_meta_message_id_idx ON whatsapp_messages (meta_message_id);
CREATE INDEX IF NOT EXISTS whatsapp_messages_dedupe_idx ON whatsapp_messages (clinic_id, action_type, entity_id, reminder_key);

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS whatsapp_templates_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS whatsapp_reminder_config jsonb NOT NULL DEFAULT '{"enabled":false,"appointmentReminders":{"enabled":true,"hoursBefore":[24,1]},"followUpReminders":{"enabled":true,"daysAfterConsultation":[7]}}'::jsonb;
