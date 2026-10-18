import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const billingRoute = readFileSync(resolve(here, "../src/routes/billing.ts"), "utf8");
const workflow = readFileSync(resolve(here, "../src/services/workflow/workflow-engine.service.ts"), "utf8");
const refundService = readFileSync(resolve(here, "../src/services/billing/refund.service.ts"), "utf8");
const gateway = readFileSync(resolve(here, "../src/services/payment-gateways/payment-gateway.service.ts"), "utf8");
const paymentProviderRoute = readFileSync(resolve(here, "../src/routes/payment_providers.ts"), "utf8");
const whatsappTypes = readFileSync(resolve(here, "../src/services/whatsapp/whatsapp.types.ts"), "utf8");
const yoco = readFileSync(resolve(here, "../src/services/payment-gateways/providers/yoco.provider.ts"), "utf8");
const webhook = readFileSync(resolve(here, "../src/routes/payment_provider_webhooks.ts"), "utf8");
const ui = readFileSync(resolve(root, "artifacts/smart-clinic/src/pages/billing.tsx"), "utf8");
const migration = readFileSync(resolve(root, "drizzle/0010_payment_refunds.sql"), "utf8");

test("checkout is server-priced and the UI only redirects to its returned URL", () => {
  assert.match(gateway, /const amount = Number\(invoice\.balance\)/);
  assert.match(gateway, /amount,\n\s*currency: config\.currency/);
  assert.match(ui, /payment-provider\/checkout/);
  assert.match(ui, /window\.location\.assign\(transaction\.checkoutUrl\)/);
  assert.match(gateway, /PAYMENT_TRANSACTION_ID/);
  assert.match(paymentProviderRoute, /payment-provider\/transactions\/:transactionId/);
  assert.match(ui, /Waiting for verified confirmation from Yoco/);
});

test("responsibility and manual payments stay clinic-scoped and role-protected", () => {
  assert.match(billingRoute, /financial-responsibilities.*requireClinicMember/s);
  assert.match(billingRoute, /manual-payment-verifications.*requireRole\("clinic_admin", "cashier"\)/s);
  assert.match(ui, /Responsibility \(not payment received\)/);
});

test("refunds retain immutable payment history and complete only through the workflow", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "payment_refunds"/);
  assert.match(migration, /Refund exceeds refundable payment amount/);
  assert.match(refundService, /payment\.providerTransactionId !== params\.providerTransactionId/);
  assert.match(workflow, /WorkflowEvent\.PAYMENT_REFUNDED/);
  assert.match(workflow, /completeInvoiceRefund/);
});

test("provider refunds use the gateway abstraction and refund webhooks do not become payment failures", () => {
  assert.match(yoco, /\/refund/);
  assert.match(yoco, /Idempotency-Key/);
  assert.match(billingRoute, /gateway\.refundPayment/);
  assert.match(webhook, /findPendingProviderRefund/);
  assert.match(webhook, /event\.status === "refunded"/);
});

test("refund records have restrictive RLS and refund actions retain authorisation", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /payment_refunds_no_direct_client_access/);
  assert.match(billingRoute, /payments\/:paymentId\/refunds.*requireRole\("clinic_admin", "cashier"\)/s);
});

test("refund notification uses the existing patient messaging infrastructure", () => {
  assert.match(whatsappTypes, /"payment_refunded"/);
  assert.match(workflow, /actionType: "payment_refunded"/);
});
