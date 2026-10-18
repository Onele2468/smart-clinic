import { db, clinicsTable, invoicesTable, patientsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { YocoProvider } from "./providers/yoco.provider";
import type {
  CreateCheckoutInput,
  PaymentGateway,
  PaymentGatewayConfig,
  PaymentGatewayCredentials,
  PaymentProviderName,
  PaymentProviderMode,
} from "./payment-provider.types";
import {
  createProviderTransaction,
  markCheckoutGenerated,
} from "./provider-transaction.service";

const DEFAULT_PAYMENT_CURRENCY = "ZAR";
const PAYMENT_TRANSACTION_PLACEHOLDER = "PAYMENT_TRANSACTION_ID";

function resolveCheckoutReturnUrl(value: string | null | undefined, transactionId: string): string | null {
  return value ? value.replaceAll(PAYMENT_TRANSACTION_PLACEHOLDER, transactionId) : null;
}

const providers: Record<PaymentProviderName, PaymentGateway> = {
  yoco: new YocoProvider(),
};

export function getPaymentGateway(provider: string): PaymentGateway {
  const gateway = providers[provider as PaymentProviderName];
  if (!gateway) throw new Error(`Unsupported payment provider: ${provider}`);
  return gateway;
}

function parseCredentials(value: unknown): PaymentGatewayCredentials {
  if (!value || typeof value !== "object") return {};
  const data = value as Record<string, unknown>;
  return {
    publicKey: typeof data.publicKey === "string" ? data.publicKey : undefined,
    secretKey: typeof data.secretKey === "string" ? data.secretKey : undefined,
    webhookSecret: typeof data.webhookSecret === "string" ? data.webhookSecret : undefined,
  };
}

export async function getClinicPaymentGatewayConfig(clinicId: string): Promise<PaymentGatewayConfig & { onlinePaymentsEnabled: boolean }> {
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) throw new Error("Clinic not found");
  const provider = (clinic.paymentProvider ?? "yoco") as PaymentProviderName;
  const mode = (clinic.paymentProviderMode ?? "test") as PaymentProviderMode;
  const currency = clinic.paymentCurrency ?? DEFAULT_PAYMENT_CURRENCY;
  const gateway = getPaymentGateway(provider);
  gateway.validateCurrency(currency);
  return {
    clinicId,
    provider,
    mode,
    currency,
    credentials: parseCredentials(clinic.paymentProviderCredentials),
    onlinePaymentsEnabled: clinic.onlinePaymentsEnabled,
  };
}

export async function createPaymentCheckout(params: {
  clinicId: string;
  invoiceId: string;
  successUrl?: string | null;
  cancelUrl?: string | null;
  failureUrl?: string | null;
}) {
  const config = await getClinicPaymentGatewayConfig(params.clinicId);
  if (!config.onlinePaymentsEnabled) throw new Error("Online payments are not enabled for this clinic");

  const [invoice] = await db
    .select({
      id: invoicesTable.id,
      clinicId: invoicesTable.clinicId,
      patientId: invoicesTable.patientId,
      invoiceCode: invoicesTable.invoiceCode,
      balance: invoicesTable.balance,
      status: invoicesTable.status,
      patientFirstName: patientsTable.firstName,
      patientLastName: patientsTable.lastName,
    })
    .from(invoicesTable)
    .innerJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
    .where(and(eq(invoicesTable.id, params.invoiceId), eq(invoicesTable.clinicId, params.clinicId)));

  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "paid") throw new Error("Invoice is already fully paid");

  const amount = Number(invoice.balance);
  if (amount <= 0) throw new Error("Invoice has no outstanding balance");

  const idempotencyKey = crypto
    .createHash("sha256")
    .update(`${params.clinicId}:${params.invoiceId}:${amount}:${config.provider}:${config.mode}`)
    .digest("hex");

  const transaction = await createProviderTransaction({
    clinicId: params.clinicId,
    invoiceId: params.invoiceId,
    patientId: invoice.patientId,
    provider: config.provider,
    amount,
    currency: config.currency,
    mode: config.mode,
    idempotencyKey,
    metadata: {
      patientName: `${invoice.patientFirstName} ${invoice.patientLastName}`.trim(),
      invoiceCode: invoice.invoiceCode,
    },
  });

  if (transaction.checkoutUrl && transaction.providerCheckoutId) return transaction;

  const gateway = getPaymentGateway(config.provider);
  const checkoutInput: CreateCheckoutInput = {
    clinicId: params.clinicId,
    invoiceId: params.invoiceId,
    patientId: invoice.patientId,
    invoiceCode: invoice.invoiceCode,
    amount,
    currency: config.currency,
    successUrl: resolveCheckoutReturnUrl(params.successUrl, transaction.id),
    cancelUrl: resolveCheckoutReturnUrl(params.cancelUrl, transaction.id),
    failureUrl: resolveCheckoutReturnUrl(params.failureUrl, transaction.id),
    idempotencyKey,
  };

  const checkout = await gateway.createCheckout(config, checkoutInput);
  return markCheckoutGenerated({
    transactionId: transaction.id,
    providerCheckoutId: checkout.providerCheckoutId,
    providerTransactionId: checkout.providerTransactionId,
    providerReference: checkout.providerReference,
    checkoutUrl: checkout.checkoutUrl,
    rawProviderPayload: checkout.rawProviderPayload,
  });
}
