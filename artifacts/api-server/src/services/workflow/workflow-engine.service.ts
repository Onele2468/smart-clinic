import { WorkflowEvent } from "../../constants/workflowEvents";
import { logActivity } from "../../lib/activityLogger";
import { recordInvoicePayment } from "../billing/billing.service";
import { completeInvoiceRefund } from "../billing/refund.service";
import { recordPatientJourneyEvent } from "../patient-journey/timeline.service";
import { notifyStaffWorkflow } from "../notifications/workflow-notifications.service";
import { generateVisitSummary } from "./visit-summary.service";

export async function processWorkflowEvent(event: WorkflowEvent, data: unknown) {
  switch (event) {
    case WorkflowEvent.PAYMENT_COMPLETED:
      return processPaymentCompleted(data as {
        clinicId: string;
        invoiceId: string;
        patientId: string;
        amount: number;
        paymentMethod: string;
        reference?: string | null;
        providerTransactionId?: string | null;
        provider?: string | null;
        paidAt?: Date | null;
        receivedById?: string | null;
        userRole?: string | null;
        source?: "manual" | "provider";
      });
    case WorkflowEvent.PAYMENT_FAILED:
      return processPaymentFailed(data as {
        clinicId: string;
        patientId: string;
        invoiceId?: string | null;
        providerTransactionId?: string | null;
        reason?: string | null;
      });
    case WorkflowEvent.PAYMENT_REFUNDED:
      return processPaymentRefunded(data as { clinicId: string; refundId: string; patientId: string; userId?: string | null; userRole?: string | null; });
    default:
      return null;
  }
}

async function processPaymentRefunded(params: { clinicId: string; refundId: string; patientId: string; userId?: string | null; userRole?: string | null; }) {
  const result = await completeInvoiceRefund({ clinicId: params.clinicId, refundId: params.refundId });
  if (!result) return { duplicate: true };
  await recordPatientJourneyEvent({ clinicId: params.clinicId, patientId: params.patientId, actorUserId: params.userId ?? null, module: "billing", eventType: WorkflowEvent.PAYMENT_REFUNDED, title: "Payment refunded", description: `Refund of ZAR ${Number(result.refund.amount).toFixed(2)} completed.`, entityType: "payment_refund", entityId: result.refund.id, metadata: { paymentId: result.refund.paymentId, invoiceId: result.invoice.id, origin: result.refund.origin } });
  logActivity({ clinicId: params.clinicId, userId: params.userId ?? null, userRole: params.userRole ?? "payment_gateway", module: "billing", actionType: "payment_refunded", type: "payment_refunded", message: `Refund of ZAR ${Number(result.refund.amount).toFixed(2)} completed for invoice ${result.invoice.invoiceCode}.`, entityId: result.refund.id });
  await notifyStaffWorkflow({ clinicId: params.clinicId, roles: ["clinic_admin", "cashier", "receptionist"], type: "billing", title: "Payment refunded", message: `Refund of ZAR ${Number(result.refund.amount).toFixed(2)} completed for invoice ${result.invoice.invoiceCode}.`, entityId: result.refund.id, targetUrl: "/billing" });
  return result;
}

async function processPaymentCompleted(params: {
  clinicId: string;
  invoiceId: string;
  patientId: string;
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  providerTransactionId?: string | null;
  provider?: string | null;
  paidAt?: Date | null;
  receivedById?: string | null;
  userRole?: string | null;
  source?: "manual" | "provider";
}) {
  const result = await recordInvoicePayment({
    clinicId: params.clinicId,
    invoiceId: params.invoiceId,
    amount: params.amount,
    paymentMethod: params.paymentMethod,
    reference: params.reference ?? params.providerTransactionId ?? null,
    receivedById: params.receivedById ?? null,
    userRole: params.userRole ?? (params.source === "manual" ? "cashier" : "payment_gateway"),
    source: params.source ?? "provider",
    providerTransactionId: params.providerTransactionId ?? null,
    paidAt: params.paidAt ?? new Date(),
  });

  const visitSummary = await generateVisitSummary({
    clinicId: params.clinicId,
    patientId: params.patientId,
    invoiceId: params.invoiceId,
    receipt: result.receipt,
  });

  await recordPatientJourneyEvent({
    clinicId: params.clinicId,
    patientId: params.patientId,
    module: "workflow",
    eventType: WorkflowEvent.VISIT_COMPLETED,
    title: "Visit completed",
    description: visitSummary,
    entityType: "invoice",
    entityId: params.invoiceId,
    metadata: {
      receiptNumber: result.receipt.receiptNumber,
      providerTransactionId: params.providerTransactionId ?? null,
    },
  });

  logActivity({
    clinicId: params.clinicId,
    userId: null,
    userRole: params.source === "manual" ? (params.userRole ?? "cashier") : "payment_gateway",
    module: "billing",
    actionType: "visit_completed",
    type: "visit_completed",
    message: `Visit summary generated after payment for invoice ${result.invoice.invoiceCode}`,
    entityId: params.invoiceId,
  });

  await notifyStaffWorkflow({
    clinicId: params.clinicId,
    roles: ["clinic_admin", "cashier", "receptionist"],
    type: "billing",
    title: "Payment completed",
    message: `Payment completed for invoice ${result.invoice.invoiceCode}. Receipt ${result.receipt.receiptNumber} is available.`,
    entityId: params.invoiceId,
    targetUrl: "/billing",
  });

  logActivity({
    clinicId: params.clinicId,
    userId: null,
    userRole: params.source === "manual" ? (params.userRole ?? "cashier") : "payment_gateway",
    module: "billing",
    actionType: "payment_recorded",
    type: "payment_recorded",
    message: [
      `Hello ${result.patient ? `${result.patient.firstName} ${result.patient.lastName}`.trim() : "Patient"}.`,
      "",
      "Your payment has been received successfully.",
      "",
      "Receipt Number",
      result.receipt.receiptNumber,
      "",
      "Amount Paid",
      `${result.receipt.currency} ${result.receipt.amountPaid.toFixed(2)}`,
      "",
      "Your visit has now been completed.",
      "",
      "Your receipt is now available.",
      "",
      "If you need help with:",
      "• Your medication",
      "• Laboratory results",
      "• Doctor instructions",
      "• Follow-up appointment",
      "",
      "Simply send me a message at any time.",
      "",
      "Thank you for choosing Health Nexus.",
      "",
      "We wish you a speedy recovery.",
      "",
      "Health Nexus",
    ].join("\n"),
    entityId: params.invoiceId,
  });

  return { ...result, visitSummary };
}

async function processPaymentFailed(params: {
  clinicId: string;
  patientId: string;
  invoiceId?: string | null;
  providerTransactionId?: string | null;
  reason?: string | null;
}) {
  await recordPatientJourneyEvent({
    clinicId: params.clinicId,
    patientId: params.patientId,
    module: "billing",
    eventType: "payment_failed",
    title: "Payment failed",
    description: params.reason ?? "Online payment attempt failed.",
    entityType: params.invoiceId ? "invoice" : "payment_provider_transaction",
    entityId: params.invoiceId ?? params.providerTransactionId ?? null,
    metadata: { providerTransactionId: params.providerTransactionId ?? null },
  });
  logActivity({
    clinicId: params.clinicId,
    userId: null,
    userRole: "payment_gateway",
    module: "billing",
    actionType: "payment_failed",
    type: "payment_failed",
    message: params.reason ?? "Online payment attempt failed.",
    entityId: params.invoiceId ?? params.providerTransactionId ?? null,
  });
  await notifyStaffWorkflow({ clinicId: params.clinicId, roles: ["clinic_admin", "cashier", "receptionist"], type: "billing", title: "Payment failed", message: params.reason ?? "An online payment attempt failed.", entityId: params.invoiceId ?? params.providerTransactionId ?? null, targetUrl: "/billing" });
  return { success: true };
}
