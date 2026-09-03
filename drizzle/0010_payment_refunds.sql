ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider_transaction_id" uuid;
DROP TABLE IF EXISTS "payment_arrangements";
ALTER TABLE "clinics" DROP COLUMN IF EXISTS "payment_arrangements_enabled";

CREATE TABLE IF NOT EXISTS "payment_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "provider_transaction_id" uuid,
  "amount" numeric(12, 2) NOT NULL,
  "refund_method" text NOT NULL,
  "provider_refund_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "origin" text NOT NULL,
  "reason" text,
  "authorised_by_id" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_refunds_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payment_refunds_status_check" CHECK ("status" IN ('pending', 'completed', 'failed', 'cancelled')),
  CONSTRAINT "payment_refunds_origin_check" CHECK ("origin" IN ('manual', 'provider')),
  CONSTRAINT "payment_refunds_manual_authorisation_check" CHECK ("origin" <> 'manual' OR "authorised_by_id" IS NOT NULL)
);

DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_transaction_id_payment_provider_transactions_id_fk" FOREIGN KEY ("provider_transaction_id") REFERENCES "public"."payment_provider_transactions"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id");
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_provider_transaction_id_payment_provider_transactions_id_fk" FOREIGN KEY ("provider_transaction_id") REFERENCES "public"."payment_provider_transactions"("id");
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_authorised_by_id_users_id_fk" FOREIGN KEY ("authorised_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "payments_provider_transaction_idx" ON "payments" ("clinic_id", "provider_transaction_id");
CREATE INDEX IF NOT EXISTS "payment_refunds_payment_idx" ON "payment_refunds" ("clinic_id", "payment_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_provider_refund_unique" ON "payment_refunds" ("provider_transaction_id", "provider_refund_id") WHERE "provider_refund_id" IS NOT NULL;

CREATE OR REPLACE FUNCTION "validate_payment_refund"() RETURNS trigger AS $$
DECLARE payment_amount numeric(12,2); payment_clinic uuid; payment_invoice uuid; payment_provider_transaction uuid; refunded_total numeric(12,2);
BEGIN
  SELECT amount, clinic_id, invoice_id, provider_transaction_id INTO payment_amount, payment_clinic, payment_invoice, payment_provider_transaction FROM payments WHERE id = NEW.payment_id FOR UPDATE;
  IF payment_amount IS NULL OR payment_clinic <> NEW.clinic_id OR payment_invoice <> NEW.invoice_id THEN RAISE EXCEPTION 'Refund payment does not belong to clinic invoice'; END IF;
  IF NEW.provider_transaction_id IS DISTINCT FROM payment_provider_transaction THEN RAISE EXCEPTION 'Refund provider transaction does not match payment'; END IF;
  IF NEW.provider_transaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payment_provider_transactions WHERE id = NEW.provider_transaction_id AND clinic_id = NEW.clinic_id AND invoice_id = NEW.invoice_id) THEN RAISE EXCEPTION 'Refund provider transaction does not belong to clinic invoice'; END IF;
  SELECT COALESCE(SUM(amount), 0) INTO refunded_total FROM payment_refunds WHERE payment_id = NEW.payment_id AND status IN ('pending', 'completed') AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF refunded_total + NEW.amount > payment_amount THEN RAISE EXCEPTION 'Refund exceeds refundable payment amount'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "payment_refund_validation" ON "payment_refunds";
CREATE TRIGGER "payment_refund_validation" BEFORE INSERT OR UPDATE ON "payment_refunds" FOR EACH ROW EXECUTE FUNCTION "validate_payment_refund"();

ALTER TABLE "payment_refunds" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_refunds_no_direct_client_access" ON "payment_refunds" FOR ALL USING (false) WITH CHECK (false);
