ALTER TABLE "clinics"
  ADD COLUMN IF NOT EXISTS "online_payments_enabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "payment_provider" text DEFAULT 'yoco' NOT NULL,
  ADD COLUMN IF NOT EXISTS "payment_provider_mode" text DEFAULT 'test' NOT NULL,
  ADD COLUMN IF NOT EXISTS "payment_currency" text DEFAULT 'ZAR' NOT NULL,
  ADD COLUMN IF NOT EXISTS "payment_provider_connection_status" text DEFAULT 'not_configured' NOT NULL,
  ADD COLUMN IF NOT EXISTS "payment_provider_webhook_status" text DEFAULT 'not_configured' NOT NULL,
  ADD COLUMN IF NOT EXISTS "payment_provider_credentials" jsonb DEFAULT '{}'::jsonb NOT NULL;

CREATE TABLE IF NOT EXISTS "payment_provider_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "provider_transaction_id" text,
  "provider_checkout_id" text,
  "provider_reference" text,
  "checkout_url" text,
  "amount" numeric(12, 2) NOT NULL,
  "currency" text NOT NULL,
  "status" text DEFAULT 'created' NOT NULL,
  "mode" text DEFAULT 'test' NOT NULL,
  "failure_reason" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "raw_provider_payload" jsonb,
  "idempotency_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone,
  "expires_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "payment_provider_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid,
  "transaction_id" uuid,
  "provider" text NOT NULL,
  "provider_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "raw_payload" jsonb NOT NULL,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "patient_journey_timeline" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "module" text NOT NULL,
  "event_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "entity_type" text,
  "entity_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "payment_provider_transactions" ADD CONSTRAINT "payment_provider_transactions_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_provider_transactions" ADD CONSTRAINT "payment_provider_transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_provider_transactions" ADD CONSTRAINT "payment_provider_transactions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_transaction_id_payment_provider_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."payment_provider_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "patient_journey_timeline" ADD CONSTRAINT "patient_journey_timeline_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "patient_journey_timeline" ADD CONSTRAINT "patient_journey_timeline_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "patient_journey_timeline" ADD CONSTRAINT "patient_journey_timeline_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_transactions_idempotency_key_unique" ON "payment_provider_transactions" ("idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_events_provider_event_unique" ON "payment_provider_events" ("provider", "provider_event_id");
CREATE INDEX IF NOT EXISTS "payment_provider_transactions_invoice_idx" ON "payment_provider_transactions" ("clinic_id", "invoice_id");
CREATE INDEX IF NOT EXISTS "payment_provider_transactions_checkout_idx" ON "payment_provider_transactions" ("provider", "provider_checkout_id");
CREATE INDEX IF NOT EXISTS "payment_provider_transactions_provider_tx_idx" ON "payment_provider_transactions" ("provider", "provider_transaction_id");
CREATE INDEX IF NOT EXISTS "patient_journey_timeline_patient_idx" ON "patient_journey_timeline" ("clinic_id", "patient_id", "created_at");

ALTER TABLE "payment_provider_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_provider_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_journey_timeline" ENABLE ROW LEVEL SECURITY;
