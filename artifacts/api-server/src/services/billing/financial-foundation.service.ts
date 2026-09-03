import {
  db,
  financialResponsibilityAllocationsTable,
  invoicesTable,
  manualPaymentVerificationsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

export async function createResponsibilityAllocation(params: {
  clinicId: string;
  invoiceId: string;
  patientId: string;
  payerType: "patient" | "medical_aid" | "government" | "ngo" | "donor" | "sponsor" | "clinic";
  payerReference?: string | null;
  authorizationReference?: string | null;
  claimStatus?: "not_applicable" | "pending" | "authorised" | "declined" | "settled";
  allocatedAmount: number;
  createdById: string;
}) {
  const [invoice] = await db.select().from(invoicesTable)
    .where(and(eq(invoicesTable.id, params.invoiceId), eq(invoicesTable.clinicId, params.clinicId), eq(invoicesTable.patientId, params.patientId)));
  if (!invoice) throw new Error("Invoice not found for clinic patient");
  if (params.allocatedAmount < 0) throw new Error("Allocation amount must not be negative");
  const [totals] = await db.select({ total: sql<string>`COALESCE(SUM(${financialResponsibilityAllocationsTable.allocatedAmount}), 0)` })
    .from(financialResponsibilityAllocationsTable)
    .where(and(eq(financialResponsibilityAllocationsTable.clinicId, params.clinicId), eq(financialResponsibilityAllocationsTable.invoiceId, params.invoiceId)));
  if (Number(totals?.total ?? 0) + params.allocatedAmount > Number(invoice.totalAmount)) {
    throw new Error("Financial responsibility allocation exceeds invoice total");
  }
  const [allocation] = await db.insert(financialResponsibilityAllocationsTable).values({
    ...params,
    payerReference: params.payerReference ?? null,
    authorizationReference: params.authorizationReference ?? null,
    claimStatus: params.claimStatus ?? "not_applicable",
    allocatedAmount: String(params.allocatedAmount),
  }).returning();
  return allocation;
}

export async function createManualTransferVerification(params: {
  clinicId: string; invoiceId: string; patientId: string; amount: number; reference?: string | null; createdById: string;
}) {
  const [verification] = await db.insert(manualPaymentVerificationsTable).values({
    ...params, amount: String(params.amount), paymentMethod: "transfer", reference: params.reference ?? null,
  }).returning();
  return verification;
}

export async function claimManualTransferVerification(params: { clinicId: string; verificationId: string; verifiedById: string }) {
  const [verification] = await db.update(manualPaymentVerificationsTable)
    .set({ status: "verified", verifiedById: params.verifiedById, verifiedAt: new Date() })
    .where(and(
      eq(manualPaymentVerificationsTable.id, params.verificationId),
      eq(manualPaymentVerificationsTable.clinicId, params.clinicId),
      eq(manualPaymentVerificationsTable.status, "awaiting_manual_verification"),
    )).returning();
  return verification ?? null;
}

export async function reopenManualTransferVerification(params: { clinicId: string; verificationId: string }) {
  await db.update(manualPaymentVerificationsTable)
    .set({ status: "awaiting_manual_verification", verifiedById: null, verifiedAt: null, updatedAt: new Date() })
    .where(and(
      eq(manualPaymentVerificationsTable.id, params.verificationId),
      eq(manualPaymentVerificationsTable.clinicId, params.clinicId),
      eq(manualPaymentVerificationsTable.status, "verified"),
    ));
}

export async function rejectManualTransferVerification(params: { clinicId: string; verificationId: string; rejectedById: string; reason?: string | null }) {
  const [verification] = await db.update(manualPaymentVerificationsTable)
    .set({ status: "rejected", verifiedById: params.rejectedById, verifiedAt: new Date(), rejectionReason: params.reason ?? null })
    .where(and(eq(manualPaymentVerificationsTable.id, params.verificationId), eq(manualPaymentVerificationsTable.clinicId, params.clinicId), eq(manualPaymentVerificationsTable.status, "awaiting_manual_verification")))
    .returning();
  return verification ?? null;
}
