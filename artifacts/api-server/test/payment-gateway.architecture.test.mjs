import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const paymentGatewaySource = readFileSync(resolve(here, "../src/services/payment-gateways/payment-gateway.service.ts"), "utf8");
const providerTransactionSource = readFileSync(resolve(here, "../src/services/payment-gateways/provider-transaction.service.ts"), "utf8");
const yocoProviderSource = readFileSync(resolve(here, "../src/services/payment-gateways/providers/yoco.provider.ts"), "utf8");
const webhookRouteSource = readFileSync(resolve(here, "../src/routes/payment_provider_webhooks.ts"), "utf8");
const billingRouteSource = readFileSync(resolve(here, "../src/routes/billing.ts"), "utf8");
const billingServiceSource = readFileSync(resolve(here, "../src/services/billing/billing.service.ts"), "utf8");
const workflowSource = readFileSync(resolve(here, "../src/services/workflow/workflow-engine.service.ts"), "utf8");
const aiBillingIntentSource = readFileSync(resolve(here, "../src/services/ai/intents/billingIntent.ts"), "utf8");
const migrationSource = readFileSync(resolve(here, "../../../drizzle/0008_payment_gateway_yoco.sql"), "utf8");

test("payment gateway provider stays provider-agnostic and Yoco is the first implementation", () => {
  assert.match(paymentGatewaySource, /PaymentGateway/);
  assert.match(paymentGatewaySource, /getPaymentGateway/);
  assert.match(paymentGatewaySource, /yoco:\s*new YocoProvider\(\)/);
  assert.match(yocoProviderSource, /class YocoProvider implements PaymentGateway/);
});

test("Yoco currency is constrained to South African Rand through provider validation", () => {
  assert.match(paymentGatewaySource, /DEFAULT_PAYMENT_CURRENCY\s*=\s*"ZAR"/);
  assert.match(yocoProviderSource, /YOCO_SUPPORTED_CURRENCIES\s*=\s*new Set\(\["ZAR"\]\)/);
  assert.match(yocoProviderSource, /validateCurrency\(input\.currency\)/);
  assert.match(billingRouteSource, /paymentCurrency:\s*z\.literal\("ZAR"\)/);
});

test("payment provider webhooks enter business logic through the Workflow Engine", () => {
  assert.match(webhookRouteSource, /processWorkflowEvent\(WorkflowEvent\.PAYMENT_COMPLETED/);
  assert.doesNotMatch(webhookRouteSource, /paymentsTable/);
  assert.doesNotMatch(webhookRouteSource, /invoicesTable/);
  assert.match(billingServiceSource, /\.insert\(paymentsTable\)/);
  assert.match(billingServiceSource, /\.update\(invoicesTable\)/);
});

test("manual and provider payments share the same payment completion workflow", () => {
  assert.match(billingRouteSource, /processWorkflowEvent\(WorkflowEvent\.PAYMENT_COMPLETED/);
  assert.match(webhookRouteSource, /processWorkflowEvent\(WorkflowEvent\.PAYMENT_COMPLETED/);
  assert.match(workflowSource, /recordInvoicePayment/);
});

test("webhook idempotency prevents duplicate Billing payments", () => {
  assert.match(providerTransactionSource, /markProviderTransactionPaidOnce/);
  assert.match(providerTransactionSource, /ne\(paymentProviderTransactionsTable\.status,\s*"paid"\)/);
  assert.match(webhookRouteSource, /if \(!paidTransaction\)/);
  assert.match(migrationSource, /payment_provider_events_provider_event_unique/);
});

test("receipts are generated dynamically without a receipts table", () => {
  assert.doesNotMatch(migrationSource, /CREATE TABLE IF NOT EXISTS "receipts"/);
  assert.match(workflowSource, /receipt:\s*result\.receipt/);
  assert.match(billingServiceSource, /generateReceiptForPayment/);
});

test("payment and visit completion are Patient Journey Timeline events", () => {
  assert.match(billingServiceSource, /eventType:\s*"PAYMENT_COMPLETED"/);
  assert.match(workflowSource, /eventType:\s*WorkflowEvent\.VISIT_COMPLETED/);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS "patient_journey_timeline"/);
});

test("AI billing intent remains explanatory and does not execute payments", () => {
  assert.doesNotMatch(aiBillingIntentSource, /paymentsTable|invoicesTable/);
  assert.doesNotMatch(aiBillingIntentSource, /\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(aiBillingIntentSource, /processWorkflowEvent\(WorkflowEvent\.PAYMENT_COMPLETED/);
});
