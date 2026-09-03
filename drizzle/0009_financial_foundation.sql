ALTER TABLE "clinics"
  ADD COLUMN IF NOT EXISTS "payment_timing" text DEFAULT 'END_OF_VISIT' NOT NULL,
  ADD COLUMN IF NOT EXISTS "allowed_manual_payment_methods" jsonb DEFAULT '["cash","card","transfer","mobile_money"]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "eft_verification_required" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "financial_responsibility_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,
  "payer_type" text NOT NULL,
  "payer_reference" text,
  "authorization_reference" text,
  "claim_status" text DEFAULT 'not_applicable' NOT NULL,
  "allocated_amount" numeric(12, 2) NOT NULL,
  "status" text DEFAULT 'due' NOT NULL,
  "created_by_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "financial_responsibility_allocations_payer_type_check" CHECK ("payer_type" IN ('patient','medical_aid','government','ngo','donor','sponsor','clinic')),
  CONSTRAINT "financial_responsibility_allocations_amount_check" CHECK ("allocated_amount" >= 0),
  CONSTRAINT "financial_responsibility_allocations_claim_status_check" CHECK ("claim_status" IN ('not_applicable','pending','authorised','declined','settled')),
  CONSTRAINT "financial_responsibility_allocations_status_check" CHECK ("status" IN ('not_required','due','pending','partially_paid','completed','cancelled'))
);

CREATE TABLE IF NOT EXISTS "manual_payment_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "payment_method" text NOT NULL,
  "reference" text,
  "status" text DEFAULT 'awaiting_manual_verification' NOT NULL,
  "created_by_id" uuid NOT NULL,
  "verified_by_id" uuid,
  "verified_at" timestamp with time zone,
  "rejection_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "manual_payment_verifications_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "manual_payment_verifications_method_check" CHECK ("payment_method" = 'transfer'),
  CONSTRAINT "manual_payment_verifications_status_check" CHECK ("status" IN ('awaiting_manual_verification','verified','rejected','cancelled'))
);

DO $$ BEGIN
  ALTER TABLE "financial_responsibility_allocations" ADD CONSTRAINT "financial_responsibility_allocations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");
  ALTER TABLE "financial_responsibility_allocations" ADD CONSTRAINT "financial_responsibility_allocations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");
  ALTER TABLE "financial_responsibility_allocations" ADD CONSTRAINT "financial_responsibility_allocations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");
  ALTER TABLE "financial_responsibility_allocations" ADD CONSTRAINT "financial_responsibility_allocations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "manual_payment_verifications" ADD CONSTRAINT "manual_payment_verifications_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");
  ALTER TABLE "manual_payment_verifications" ADD CONSTRAINT "manual_payment_verifications_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");
  ALTER TABLE "manual_payment_verifications" ADD CONSTRAINT "manual_payment_verifications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");
  ALTER TABLE "manual_payment_verifications" ADD CONSTRAINT "manual_payment_verifications_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id");
  ALTER TABLE "manual_payment_verifications" ADD CONSTRAINT "manual_payment_verifications_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "financial_responsibility_allocations_invoice_idx" ON "financial_responsibility_allocations" ("clinic_id", "invoice_id");
CREATE INDEX IF NOT EXISTS "manual_payment_verifications_invoice_idx" ON "manual_payment_verifications" ("clinic_id", "invoice_id", "status");

CREATE OR REPLACE FUNCTION "validate_financial_responsibility_total"() RETURNS trigger AS $$
DECLARE invoice_total numeric(12,2); allocated_total numeric(12,2);
BEGIN
  SELECT total_amount INTO invoice_total FROM invoices WHERE id = NEW.invoice_id AND clinic_id = NEW.clinic_id;
  IF invoice_total IS NULL THEN RAISE EXCEPTION 'Invoice does not belong to clinic'; END IF;
  SELECT COALESCE(SUM(allocated_amount), 0) INTO allocated_total FROM financial_responsibility_allocations WHERE invoice_id = NEW.invoice_id AND clinic_id = NEW.clinic_id AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF allocated_total + NEW.allocated_amount > invoice_total THEN RAISE EXCEPTION 'Financial responsibility allocation exceeds invoice total'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "financial_responsibility_total_check" ON "financial_responsibility_allocations";
CREATE TRIGGER "financial_responsibility_total_check" BEFORE INSERT OR UPDATE ON "financial_responsibility_allocations" FOR EACH ROW EXECUTE FUNCTION "validate_financial_responsibility_total"();

ALTER TABLE "financial_responsibility_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "manual_payment_verifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_responsibility_no_direct_client_access" ON "financial_responsibility_allocations" FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "manual_payment_verifications_no_direct_client_access" ON "manual_payment_verifications" FOR ALL USING (false) WITH CHECK (false);
