import { db, invoicesTable, paymentsTable, patientsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logActivity } from "../../lib/activityLogger";
import { generateReceiptForPayment } from "./receipt.service";
import { recordPatientJourneyEvent } from "../patient-journey/timeline.service";

export interface RecordPaymentInput {
  clinicId: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  receivedById?: string | null;
  userRole?: string | null;
  source?: "manual" | "provider";
  providerTransactionId?: string | null;
  paidAt?: Date;
}

export async function recordInvoicePayment(input: RecordPaymentInput) {
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.id, input.invoiceId), eq(invoicesTable.clinicId, input.clinicId)));

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (invoice.status === "paid") {
    throw new Error("Invoice is already fully paid");
  }

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(and(eq(patientsTable.id, invoice.patientId), eq(patientsTable.clinicId, input.clinicId)));

  const currentPaid = Number(invoice.paidAmount);
  const total = Number(invoice.totalAmount);
  const amountToApply = Math.min(input.amount, Math.max(total - currentPaid, 0));
  const newPaid = Math.min(currentPaid + amountToApply, total);
  const newBalance = Math.max(total - newPaid, 0);
  const newStatus = newBalance <= 0 ? "paid" : newPaid > 0 ? "partial" : "unpaid";

  const [payment] = await db.insert(paymentsTable).values({
    invoiceId: input.invoiceId,
    clinicId: input.clinicId,
    receivedById: input.receivedById ?? null,
    amount: String(amountToApply),
    paymentMethod: input.paymentMethod,
    reference: input.reference ?? null,
    paidAt: input.paidAt ?? new Date(),
  }).returning();

  const [updatedInvoice] = await db.update(invoicesTable)
    .set({ paidAmount: String(newPaid), balance: String(newBalance), status: newStatus })
    .where(eq(invoicesTable.id, input.invoiceId))
    .returning();

  const receipt = await generateReceiptForPayment({
    clinicId: input.clinicId,
    invoiceId: input.invoiceId,
    paymentId: payment.id,
  });

  logActivity({
    clinicId: input.clinicId,
    userId: input.receivedById ?? null,
    userRole: input.userRole ?? null,
    module: "billing",
    actionType: "payment_recorded",
    type: "payment_recorded",
    message: `Payment of ${amountToApply} recorded for invoice ${invoice.invoiceCode} via ${input.paymentMethod}`,
    entityId: input.invoiceId,
    suppressWhatsAppDispatch: true,
  });

  await recordPatientJourneyEvent({
    clinicId: input.clinicId,
    patientId: invoice.patientId,
    actorUserId: input.receivedById ?? null,
    module: "billing",
    eventType: "PAYMENT_COMPLETED",
    title: "Payment completed",
    description: `Payment of ${receipt.currency} ${amountToApply.toFixed(2)} recorded for invoice ${invoice.invoiceCode}.`,
    entityType: "invoice",
    entityId: input.invoiceId,
    metadata: {
      paymentId: payment.id,
      receiptNumber: receipt.receiptNumber,
      source: input.source ?? "manual",
      providerTransactionId: input.providerTransactionId ?? null,
      invoiceStatus: newStatus,
    },
  });

  await recordPatientJourneyEvent({
    clinicId: input.clinicId,
    patientId: invoice.patientId,
    actorUserId: input.receivedById ?? null,
    module: "billing",
    eventType: "receipt_generated",
    title: "Receipt generated",
    description: `Receipt ${receipt.receiptNumber} generated for ${receipt.currency} ${receipt.amountPaid.toFixed(2)}.`,
    entityType: "payment",
    entityId: payment.id,
    metadata: { receipt },
  });

  return {
    payment,
    invoice: updatedInvoice,
    patient,
    receipt,
    wasFullyPaid: newStatus === "paid",
    amountApplied: amountToApply,
  };
}
