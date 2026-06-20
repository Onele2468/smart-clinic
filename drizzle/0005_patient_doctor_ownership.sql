ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "primary_doctor_id" uuid;
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "backup_doctor_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patients" ADD CONSTRAINT "patients_primary_doctor_id_users_id_fk" FOREIGN KEY ("primary_doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patients" ADD CONSTRAINT "patients_backup_doctor_id_users_id_fk" FOREIGN KEY ("backup_doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
