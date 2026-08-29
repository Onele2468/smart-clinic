import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const migration = readFileSync(resolve(root, "drizzle/0009_financial_foundation.sql"), "utf8");
const route = readFileSync(resolve(here, "../src/routes/billing.ts"), "utf8");
const service = readFileSync(resolve(here, "../src/services/billing/financial-foundation.service.ts"), "utf8");
const webhook = readFileSync(resolve(here, "../src/routes/payment_provider_webhooks.ts"), "utf8");
const billingUi = readFileSync(resolve(root, "artifacts/smart-clinic/src/pages/billing.tsx"), "utf8");

test("financial allocations retain payer and clinic-scoped limits", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "financial_responsibility_allocations"/);
  assert.match(migration, /'medical_aid'.*'ngo'.*'donor'.*'sponsor'/);
  assert.match(migration, /validate_financial_responsibility_total/);
  assert.match(service, /Financial responsibility allocation exceeds invoice total/);
  assert.match(route, /requireRole\("clinic_admin", "cashier"\)/);
});

test("EFT awaits manual verification and only completes through the workflow", () => {
  assert.match(route, /eftVerificationRequired/);
  assert.match(route, /createManualTransferVerification/);
  assert.match(route, /res\.status\(202\)/);
  assert.match(route, /claimManualTransferVerification/);
  assert.match(route, /processWorkflowEvent\(WorkflowEvent\.PAYMENT_COMPLETED/);
  assert.match(route, /reopenManualTransferVerification/);
  assert.match(service, /status: "awaiting_manual_verification"/);
});

test("financial foundation is RLS-protected and exposes no AI mutation path", () => {
  for (const table of ["financial_responsibility_allocations", "payment_arrangements", "manual_payment_verifications"]) {
    assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
  }
  assert.doesNotMatch(service, /ConversationAI|Ollama|processWorkflowEvent/);
  assert.match(route, /financial_policy_updated/);
});

test("provider webhook rejects clinic, currency, and paid-amount mismatches", () => {
  assert.match(webhook, /transaction\.clinicId !== clinicId/);
  assert.match(webhook, /event\.currency !== transaction\.currency/);
  assert.match(webhook, /Number\(event\.amount\) !== Number\(transaction\.amount\)/);
});

test("billing access follows configuration instead of clinic type", () => {
  assert.doesNotMatch(billingUi, /clinicType === "government"/);
  assert.match(route, /paymentArrangementsEnabled/);
});
