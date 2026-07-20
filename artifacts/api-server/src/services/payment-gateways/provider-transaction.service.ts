import {
  db,
  paymentProviderEventsTable,
  paymentProviderTransactionsTable,
  type PaymentProviderTransaction,
} from "@workspace/db";
import { and, eq, ne, or } from "drizzle-orm";
import type { PaymentProviderStatus, VerifiedProviderEvent } from "./payment-provider.types";

export async function createProviderTransaction(params: {
  clinicId: string;
  invoiceId: string;
  patientId: string;
  provider: string;
  amount: number;
  currency: string;
  mode: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<PaymentProviderTransaction> {
  const [existing] = await db
    .select()
    .from(paymentProviderTransactionsTable)
    .where(eq(paymentProviderTransactionsTable.idempotencyKey, params.idempotencyKey));
  if (existing) return existing;

  const [transaction] = await db.insert(paymentProviderTransactionsTable).values({
    clinicId: params.clinicId,
    invoiceId: params.invoiceId,
    patientId: params.patientId,
    provider: params.provider,
    amount: String(params.amount),
    currency: params.currency,
    mode: params.mode,
    status: "created",
    idempotencyKey: params.idempotencyKey,
    metadata: params.metadata ?? {},
  }).returning();
  return transaction;
}

export async function markCheckoutGenerated(params: {
  transactionId: string;
  providerCheckoutId: string;
  providerTransactionId?: string | null;
  providerReference?: string | null;
  checkoutUrl: string;
  rawProviderPayload: Record<string, unknown>;
}): Promise<PaymentProviderTransaction> {
  const [transaction] = await db.update(paymentProviderTransactionsTable)
    .set({
      providerCheckoutId: params.providerCheckoutId,
      providerTransactionId: params.providerTransactionId ?? null,
      providerReference: params.providerReference ?? null,
      checkoutUrl: params.checkoutUrl,
      rawProviderPayload: params.rawProviderPayload,
      status: "awaiting_payment",
    })
    .where(eq(paymentProviderTransactionsTable.id, params.transactionId))
    .returning();
  return transaction;
}

export async function findProviderTransactionForEvent(event: VerifiedProviderEvent): Promise<PaymentProviderTransaction | null> {
  if (!event.providerCheckoutId && !event.providerTransactionId) return null;
  const match = event.providerCheckoutId && event.providerTransactionId
    ? or(
        eq(paymentProviderTransactionsTable.providerCheckoutId, event.providerCheckoutId),
        eq(paymentProviderTransactionsTable.providerTransactionId, event.providerTransactionId),
      )
    : event.providerCheckoutId
      ? eq(paymentProviderTransactionsTable.providerCheckoutId, event.providerCheckoutId)
      : eq(paymentProviderTransactionsTable.providerTransactionId, event.providerTransactionId!);
  const rows = await db
    .select()
    .from(paymentProviderTransactionsTable)
    .where(and(eq(paymentProviderTransactionsTable.provider, event.provider), match))
    .limit(1);
  return rows[0] ?? null;
}

export async function hasProcessedProviderEvent(provider: string, providerEventId: string): Promise<boolean> {
  const [event] = await db
    .select({ id: paymentProviderEventsTable.id, processedAt: paymentProviderEventsTable.processedAt })
    .from(paymentProviderEventsTable)
    .where(and(eq(paymentProviderEventsTable.provider, provider), eq(paymentProviderEventsTable.providerEventId, providerEventId)));
  return !!event?.processedAt;
}

export async function recordProviderEvent(params: {
  transactionId?: string | null;
  clinicId?: string | null;
  event: VerifiedProviderEvent;
}): Promise<void> {
  const [existing] = await db
    .select()
    .from(paymentProviderEventsTable)
    .where(and(eq(paymentProviderEventsTable.provider, params.event.provider), eq(paymentProviderEventsTable.providerEventId, params.event.providerEventId)));
  if (existing) return;

  await db.insert(paymentProviderEventsTable).values({
    clinicId: params.clinicId ?? null,
    transactionId: params.transactionId ?? null,
    provider: params.event.provider,
    providerEventId: params.event.providerEventId,
    eventType: params.event.eventType,
    rawPayload: params.event.rawPayload,
  });
}

export async function markProviderEventProcessed(provider: string, providerEventId: string): Promise<void> {
  await db.update(paymentProviderEventsTable)
    .set({ processedAt: new Date() })
    .where(and(eq(paymentProviderEventsTable.provider, provider), eq(paymentProviderEventsTable.providerEventId, providerEventId)));
}

export async function updateProviderTransactionStatus(params: {
  transactionId: string;
  status: PaymentProviderStatus;
  providerTransactionId?: string | null;
  rawProviderPayload?: Record<string, unknown>;
  failureReason?: string | null;
  paidAt?: Date | null;
}): Promise<PaymentProviderTransaction> {
  const [transaction] = await db.update(paymentProviderTransactionsTable)
    .set({
      status: params.status,
      providerTransactionId: params.providerTransactionId ?? undefined,
      rawProviderPayload: params.rawProviderPayload ?? undefined,
      failureReason: params.failureReason ?? undefined,
      paidAt: params.paidAt ?? undefined,
    })
    .where(eq(paymentProviderTransactionsTable.id, params.transactionId))
    .returning();
  return transaction;
}

export async function markProviderTransactionPaidOnce(params: {
  transactionId: string;
  providerTransactionId?: string | null;
  rawProviderPayload?: Record<string, unknown>;
  paidAt?: Date | null;
}): Promise<PaymentProviderTransaction | null> {
  const [transaction] = await db.update(paymentProviderTransactionsTable)
    .set({
      status: "paid",
      providerTransactionId: params.providerTransactionId ?? undefined,
      rawProviderPayload: params.rawProviderPayload ?? undefined,
      paidAt: params.paidAt ?? new Date(),
    })
    .where(and(
      eq(paymentProviderTransactionsTable.id, params.transactionId),
      ne(paymentProviderTransactionsTable.status, "paid"),
    ))
    .returning();
  return transaction ?? null;
}
