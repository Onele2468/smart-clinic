CREATE TABLE IF NOT EXISTS "referrals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,
  "consultation_id" uuid,
  "referring_doctor_id" uuid,
  "target_clinic_id" uuid,
  "referral_type" text DEFAULT 'external' NOT NULL,
  "destination_name" text NOT NULL,
  "specialty" text,
  "urgency" text DEFAULT 'routine' NOT NULL,
  "reason" text NOT NULL,
  "clinical_summary" text,
  "document_text" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "consent_given" boolean DEFAULT false NOT NULL,
  "consent_given_at" timestamp with time zone,
  "created_by" uuid NOT NULL,
  "accepted_by" uuid,
  "accepted_at" timestamp with time zone,
  "rejected_by" uuid,
  "rejected_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referral_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "referral_id" uuid NOT NULL,
  "document_type" text DEFAULT 'referral_letter' NOT NULL,
  "file_name" text,
  "file_url" text,
  "document_text" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referral_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "referral_id" uuid NOT NULL,
  "old_status" text,
  "new_status" text NOT NULL,
  "notes" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_consultation_id_consultation_notes_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultation_notes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referring_doctor_id_users_id_fk" FOREIGN KEY ("referring_doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_target_clinic_id_clinics_id_fk" FOREIGN KEY ("target_clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "referral_documents" ADD CONSTRAINT "referral_documents_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "referral_documents" ADD CONSTRAINT "referral_documents_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "referral_documents" ADD CONSTRAINT "referral_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "referral_status_history" ADD CONSTRAINT "referral_status_history_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "referral_status_history" ADD CONSTRAINT "referral_status_history_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "referral_status_history" ADD CONSTRAINT "referral_status_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "referrals_clinic_status_idx" ON "referrals" ("clinic_id", "status");
CREATE INDEX IF NOT EXISTS "referrals_patient_idx" ON "referrals" ("clinic_id", "patient_id");
CREATE INDEX IF NOT EXISTS "referrals_target_clinic_idx" ON "referrals" ("target_clinic_id", "status");
CREATE INDEX IF NOT EXISTS "referral_documents_referral_idx" ON "referral_documents" ("referral_id");
CREATE INDEX IF NOT EXISTS "referral_status_history_referral_idx" ON "referral_status_history" ("referral_id", "created_at");

ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referral_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referral_status_history" ENABLE ROW LEVEL SECURITY;
