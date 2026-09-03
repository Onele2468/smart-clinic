import { db, invoicesTable, paymentRefundsTable, paymentsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export async function createPendingRefund(params: {
  clinicId: string; paymentId: string; amount: number; refundMethod: string; origin: "manual" | "provider";
  providerTransactionId?: string | null; authorisedById: string; reason?: string | null;
}) {
  if (!Number.isFinite(params.amount) || params.amount <= 0) throw new Error("Refund amount must be greater than zero");
  const [payment] = await db.select().from(paymentsTable).where(and(eq(paymentsTable.id, params.paymentId), eq(paymentsTable.clinicId, params.clinicId)));
  if (!payment) throw new Error("Payment not found for clinic");
  if (params.providerTransactionId && payment.providerTransactionId !== params.providerTransactionId) throw new Error("Payment does not belong to provider transaction");
  const [refund] = await db.insert(paymentRefundsTable).values({
    clinicId: params.clinicId, invoiceId: payment.invoiceId, paymentId: payment.id,
    providerTransactionId: params.providerTransactionId ?? null, amount: String(params.amount),
    refundMethod: params.refundMethod, origin: params.origin, reason: params.reason ?? null,
    authorisedById: params.authorisedById, status: "pending",
  }).returning();
  return { refund, payment };
}

export async function attachProviderRefund(params: { refundId: string; clinicId: string; providerRefundId: string }) {
  const [refund] = await db.update(paymentRefundsTable)
    .set({ providerRefundId: params.providerRefundId })
    .where(and(eq(paymentRefundsTable.id, params.refundId), eq(paymentRefundsTable.clinicId, params.clinicId), eq(paymentRefundsTable.status, "pending")))
    .returning();
  if (!refund) throw new Error("Pending refund not found");
  return refund;
}

export async function markRefundFailed(params: { refundId: string; clinicId: string }) {
  await db.update(paymentRefundsTable).set({ status: "failed" })
    .where(and(eq(paymentRefundsTable.id, params.refundId), eq(paymentRefundsTable.clinicId, params.clinicId), eq(paymentRefundsTable.status, "pending")));
}

export async function completeInvoiceRefund(params: { clinicId: string; refundId: string }) {
  return db.transaction(async (tx) => {
    const [refund] = await tx.update(paymentRefundsTable).set({ status: "completed", completedAt: new Date() })
      .where(and(eq(paymentRefundsTable.id, params.refundId), eq(paymentRefundsTable.clinicId, params.clinicId), eq(paymentRefundsTable.status, "pending")))
      .returning();
    if (!refund) return null;
    const [invoice] = await tx.select().from(invoicesTable).where(and(eq(invoicesTable.id, refund.invoiceId), eq(invoicesTable.clinicId, params.clinicId)));
    if (!invoice) throw new Error("Refund invoice not found for clinic");
    const paidAmount = Math.max(Number(invoice.paidAmount) - Number(refund.amount), 0);
    const balance = Math.max(Number(invoice.totalAmount) - paidAmount, 0);
    const status = balance <= 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
    const [updatedInvoice] = await tx.update(invoicesTable).set({ paidAmount: String(paidAmount), balance: String(balance), status })
      .where(eq(invoicesTable.id, invoice.id)).returning();
    return { refund, invoice: updatedInvoice };
  });
}

export async function findPendingProviderRefund(params: { clinicId: string; providerTransactionId: string; providerRefundId: string }) {
  const conditions = [eq(paymentRefundsTable.clinicId, params.clinicId), eq(paymentRefundsTable.providerTransactionId, params.providerTransactionId), eq(paymentRefundsTable.status, "pending")];
  conditions.push(eq(paymentRefundsTable.providerRefundId, params.providerRefundId));
  const rows = await db.select().from(paymentRefundsTable).where(and(...conditions));
  return rows[0] ?? null;
}
