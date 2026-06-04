-- Per-clinic operational alert settings for WhatsApp clinic-management notifications.
-- Prefer: pnpm exec drizzle-kit migrate --config lib/db/drizzle.config.ts
-- (applies drizzle/0001_operational_alerts_config.sql)
-- Manual fallback: run this script against your Postgres database.

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS operational_alerts_config jsonb NOT NULL DEFAULT '{
    "enabled": false,
    "recipientPhone": null,
    "patientRegistered": { "enabled": true },
    "queueThreshold": { "enabled": true, "threshold": 10 },
    "lowInventory": { "enabled": true },
    "labRequestCreated": { "enabled": true },
    "unpaidInvoices": { "enabled": true, "threshold": 5 },
    "staffJoinRequest": { "enabled": true },
    "highPatientVolume": { "enabled": true, "threshold": 50 }
  }'::jsonb;
