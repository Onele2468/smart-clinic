import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable, invoiceItemsTable, paymentsTable,
  patientsTable, usersTable, clinicsTable, financialResponsibilityAllocationsTable,
  manualPaymentVerificationsTable,
  paymentProviderTransactionsTable, paymentRefundsTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth, requireClinicMember, requireRole, requireClinicModule } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";
import { WorkflowEvent } from "../constants/workflowEvents";
import { processWorkflowEvent } from "../services/workflow/workflow-engine.service";
import {
  countUnpaidInvoices,
  maybeLogUnpaidInvoicesAlert,
} from "../services/whatsapp/operationalAlerts.triggers";
import { stripWhatsappFieldsFromUpdate, toPublicClinic } from "../lib/clinicSerializer";
import { z } from "zod";
import {
  claimManualTransferVerification, createManualTransferVerification, createResponsibilityAllocation, reopenManualTransferVerification, rejectManualTransferVerification,
} from "../services/billing/financial-foundation.service";
import { attachProviderRefund, createPendingRefund, markRefundFailed } from "../services/billing/refund.service";
import { getClinicPaymentGatewayConfig, getPaymentGateway } from "../services/payment-gateways/payment-gateway.service";
import { notifyStaffWorkflow } from "../services/notifications/workflow-notifications.service";

const router: IRouter = Router();

function generateInvoiceCode(count: number): string {
  return `INV-${String(count).padStart(5, "0")}`;
}

const CreateInvoiceBody = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    type: z.enum(["consultation", "medication", "laboratory", "procedure"]),
    description: z.string().min(1),
    quantity: z.number().int().min(1).default(1),
    unitPrice: z.number().min(0),
  })).min(1),
});

const RecordPaymentBody = z.object({
  amount: z.number().min(0.01),
  paymentMethod: z.enum(["cash", "card", "transfer", "mobile_money"]),
  reference: z.string().optional(),
});

const ResponsibilityBody = z.object({
  payerType: z.enum(["patient", "medical_aid", "government", "ngo", "donor", "sponsor", "clinic"]),
  payerReference: z.string().max(200).optional().nullable(),
  authorizationReference: z.string().max(200).optional().nullable(),
  claimStatus: z.enum(["not_applicable", "pending", "authorised", "declined", "settled"]).optional(),
  allocatedAmount: z.number().min(0),
});

const RefundBody = z.object({ amount: z.number().positive(), reason: z.string().max(500).optional().nullable() });

async function getClinicOrFail(clinicId: string, res: any): Promise<typeof clinicsTable.$inferSelect | null> {
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return null;
  }
  return clinic;
}

// List invoices for clinic
router.get("/clinics/:clinicId/invoices", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier", "receptionist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const clinic = await getClinicOrFail(clinicId, res);
  if (!clinic) return;

  if (!clinic.billingEnabled) {
    res.json([]);
    return;
  }

  const status = req.query.status as string | undefined;
  const patientId = req.query.patientId as string | undefined;

  const invoices = await db
    .select({
      id: invoicesTable.id,
      clinicId: invoicesTable.clinicId,
      patientId: invoicesTable.patientId,
      patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
      patientCode: patientsTable.patientCode,
      doctorId: invoicesTable.doctorId,
      doctorName: usersTable.name,
      invoiceCode: invoicesTable.invoiceCode,
      totalAmount: invoicesTable.totalAmount,
      paidAmount: invoicesTable.paidAmount,
      balance: invoicesTable.balance,
      status: invoicesTable.status,
      notes: invoicesTable.notes,
      createdAt: invoicesTable.createdAt,
      updatedAt: invoicesTable.updatedAt,
    })
    .from(invoicesTable)
    .innerJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
    .leftJoin(usersTable, eq(invoicesTable.doctorId, usersTable.id))
    .where(
      and(
        eq(invoicesTable.clinicId, clinicId),
        status ? eq(invoicesTable.status, status) : undefined,
        patientId ? eq(invoicesTable.patientId, patientId) : undefined,
      )
    )
    .orderBy(desc(invoicesTable.createdAt));

  res.json(invoices);
});

// Create invoice
router.post("/clinics/:clinicId/invoices", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier", "receptionist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const user = (req as any).user;

  const clinic = await getClinicOrFail(clinicId, res);
  if (!clinic) return;

  if (!clinic.billingEnabled) {
    res.status(403).json({ error: "Billing is not enabled for this clinic" });
    return;
  }

  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { patientId, doctorId, notes, items } = parsed.data;

  const [patient] = await db.select().from(patientsTable).where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)));
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const totalAmount = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice, 0);
  const unpaidBefore = await countUnpaidInvoices(clinicId);
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.clinicId, clinicId));
  const invoiceCode = generateInvoiceCode(Number(countResult?.count ?? 0) + 1);

  const [invoice] = await db.insert(invoicesTable).values({
    clinicId,
    patientId,
    doctorId: doctorId ?? null,
    invoiceCode,
    totalAmount: String(totalAmount),
    paidAmount: "0",
    balance: String(totalAmount),
    status: "unpaid",
    notes: notes ?? null,
  }).returning();

  const itemRows = items.map((item: { type: string; description: string; quantity: number; unitPrice: number }) => ({
    invoiceId: invoice.id,
    type: item.type,
    description: item.description,
    quantity: item.quantity,
    unitPrice: String(item.unitPrice),
    total: String(item.quantity * item.unitPrice),
  }));

  await db.insert(invoiceItemsTable).values(itemRows);

  logActivity({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    module: "billing",
    actionType: "invoice_created",
    type: "invoice_created",
    message: `Invoice ${invoiceCode} created for ${patient.firstName} ${patient.lastName} — Total: ${totalAmount}`,
    entityId: invoice.id,
  });

  void maybeLogUnpaidInvoicesAlert({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    unpaidBefore,
    unpaidAfter: unpaidBefore + 1,
    entityId: invoice.id,
  }).catch(() => {});

  res.status(201).json({ ...invoice, items: itemRows });
});

// Get invoice with items and payments
router.get("/clinics/:clinicId/invoices/:invoiceId", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier", "receptionist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(invoiceId)) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const [invoice] = await db
    .select({
      id: invoicesTable.id,
      clinicId: invoicesTable.clinicId,
      patientId: invoicesTable.patientId,
      patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
      patientCode: patientsTable.patientCode,
      doctorId: invoicesTable.doctorId,
      doctorName: usersTable.name,
      invoiceCode: invoicesTable.invoiceCode,
      totalAmount: invoicesTable.totalAmount,
      paidAmount: invoicesTable.paidAmount,
      balance: invoicesTable.balance,
      status: invoicesTable.status,
      notes: invoicesTable.notes,
      createdAt: invoicesTable.createdAt,
      updatedAt: invoicesTable.updatedAt,
    })
    .from(invoicesTable)
    .innerJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
    .leftJoin(usersTable, eq(invoicesTable.doctorId, usersTable.id))
    .where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.clinicId, clinicId)));

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, invoiceId));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, invoiceId)).orderBy(desc(paymentsTable.paidAt));

  res.json({ ...invoice, items, payments });
});

router.get("/clinics/:clinicId/invoices/:invoiceId/financial-responsibilities", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier", "receptionist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const allocations = await db.select().from(financialResponsibilityAllocationsTable)
    .where(and(eq(financialResponsibilityAllocationsTable.clinicId, clinicId), eq(financialResponsibilityAllocationsTable.invoiceId, invoiceId)));
  res.json(allocations);
});

router.post("/clinics/:clinicId/invoices/:invoiceId/financial-responsibilities", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier", "receptionist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const parsed = ResponsibilityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [invoice] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.clinicId, clinicId)));
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  try {
    const allocation = await createResponsibilityAllocation({ ...parsed.data, clinicId, invoiceId, patientId: invoice.patientId, createdById: (req as any).user.userId });
    logActivity({ clinicId, userId: (req as any).user.userId, userRole: (req as any).clinicMember.role, module: "billing", actionType: "financial_responsibility_created", type: "financial_responsibility_created", message: `Financial responsibility allocation recorded for invoice ${invoice.invoiceCode}.`, entityId: allocation.id, suppressWhatsAppDispatch: true });
    res.status(201).json(allocation);
  } catch (err: unknown) { res.status(400).json({ error: err instanceof Error ? err.message : "Unable to create allocation" }); }
});

router.get("/clinics/:clinicId/invoices/:invoiceId/refunds", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier", "receptionist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const refunds = await db.select().from(paymentRefundsTable).where(and(eq(paymentRefundsTable.clinicId, clinicId), eq(paymentRefundsTable.invoiceId, invoiceId)));
  res.json(refunds);
});

router.post("/clinics/:clinicId/payments/:paymentId/refunds", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const paymentId = Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId;
  const parsed = RefundBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const user = (req as any).user;
  try {
    const [payment] = await db.select().from(paymentsTable).where(and(eq(paymentsTable.id, paymentId), eq(paymentsTable.clinicId, clinicId)));
    if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }
    const providerTransaction = payment.providerTransactionId
      ? (await db.select().from(paymentProviderTransactionsTable).where(and(eq(paymentProviderTransactionsTable.id, payment.providerTransactionId), eq(paymentProviderTransactionsTable.clinicId, clinicId))))[0]
      : null;
    const origin = providerTransaction ? "provider" as const : "manual" as const;
    const { refund } = await createPendingRefund({ clinicId, paymentId, amount: parsed.data.amount, refundMethod: providerTransaction?.provider ?? payment.paymentMethod, origin, providerTransactionId: providerTransaction?.id ?? null, authorisedById: user.userId, reason: parsed.data.reason ?? null });
    if (providerTransaction) {
      if (!providerTransaction.providerCheckoutId) throw new Error("Provider payment cannot be refunded because its checkout reference is missing");
      try {
        const config = await getClinicPaymentGatewayConfig(clinicId);
        const gateway = getPaymentGateway(providerTransaction.provider);
        const providerRefund = await gateway.refundPayment(config, { providerCheckoutId: providerTransaction.providerCheckoutId, amount: parsed.data.amount, currency: providerTransaction.currency, idempotencyKey: `refund:${refund.id}`, metadata: { refundId: refund.id, paymentId, invoiceId: payment.invoiceId } });
        await attachProviderRefund({ refundId: refund.id, clinicId, providerRefundId: providerRefund.providerRefundId });
        if (providerRefund.status === "succeeded") {
          const [invoice] = await db.select({ patientId: invoicesTable.patientId }).from(invoicesTable).where(and(eq(invoicesTable.id, payment.invoiceId), eq(invoicesTable.clinicId, clinicId)));
          await processWorkflowEvent(WorkflowEvent.PAYMENT_REFUNDED, { clinicId, refundId: refund.id, patientId: invoice.patientId, userId: user.userId, userRole: (req as any).clinicMember.role });
        }
      } catch (err) { await markRefundFailed({ refundId: refund.id, clinicId }); throw err; }
    } else {
      const [invoice] = await db.select({ patientId: invoicesTable.patientId }).from(invoicesTable).where(and(eq(invoicesTable.id, payment.invoiceId), eq(invoicesTable.clinicId, clinicId)));
      await processWorkflowEvent(WorkflowEvent.PAYMENT_REFUNDED, { clinicId, refundId: refund.id, patientId: invoice.patientId, userId: user.userId, userRole: (req as any).clinicMember.role });
    }
    logActivity({ clinicId, userId: user.userId, userRole: (req as any).clinicMember.role, module: "billing", actionType: "refund_requested", type: "refund_requested", message: `Refund requested for payment ${paymentId}.`, entityId: refund.id, suppressWhatsAppDispatch: true });
    res.status(201).json(refund);
  } catch (err: unknown) { res.status(400).json({ error: err instanceof Error ? err.message : "Unable to process refund" }); }
});

// Record payment on invoice
router.post("/clinics/:clinicId/invoices/:invoiceId/payments", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier", "receptionist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const user = (req as any).user;

  const clinic = await getClinicOrFail(clinicId, res);
  if (!clinic) return;

  if (!clinic.billingEnabled) {
    res.status(403).json({ error: "Billing is not enabled for this clinic" });
    return;
  }

  const parsed = RecordPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.clinicId, clinicId)));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  if (invoice.status === "paid") {
    res.status(400).json({ error: "Invoice is already fully paid" });
    return;
  }

  const { amount, paymentMethod, reference } = parsed.data;
  const allowedMethods = Array.isArray(clinic.allowedManualPaymentMethods) ? clinic.allowedManualPaymentMethods : [];
  if (!allowedMethods.includes(paymentMethod)) {
    res.status(403).json({ error: "This manual payment method is disabled for this clinic" });
    return;
  }
  if (paymentMethod === "transfer" && clinic.eftVerificationRequired) {
    const verification = await createManualTransferVerification({
      clinicId, invoiceId, patientId: invoice.patientId, amount, reference: reference ?? null, createdById: user.userId,
    });
    logActivity({ clinicId, userId: user.userId, userRole: (req as any).clinicMember.role, module: "billing", actionType: "eft_awaiting_manual_verification", type: "eft_awaiting_manual_verification", message: `EFT payment submitted for manual verification on invoice ${invoice.invoiceCode}.`, entityId: verification.id, suppressWhatsAppDispatch: true });
    await notifyStaffWorkflow({ clinicId, roles: ["clinic_admin", "cashier"], type: "billing", title: "EFT awaiting verification", message: `EFT payment for invoice ${invoice.invoiceCode} is awaiting manual verification.`, entityId: verification.id, targetUrl: "/billing" });
    res.status(202).json({ verification, status: "awaiting_manual_verification" });
    return;
  }
  const result = await processWorkflowEvent(WorkflowEvent.PAYMENT_COMPLETED, {
    clinicId,
    invoiceId,
    patientId: invoice.patientId,
    amount,
    paymentMethod,
    reference: reference ?? null,
    receivedById: user.userId,
    userRole: user.role,
    source: "manual",
    paidAt: new Date(),
  }) as any;

  res.status(201).json({ payment: result.payment, invoice: result.invoice, receipt: result.receipt, visitSummary: result.visitSummary });
});

router.get("/clinics/:clinicId/manual-payment-verifications", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const rows = await db.select({ verification: manualPaymentVerificationsTable, patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`, invoiceCode: invoicesTable.invoiceCode })
    .from(manualPaymentVerificationsTable).innerJoin(patientsTable, eq(manualPaymentVerificationsTable.patientId, patientsTable.id)).innerJoin(invoicesTable, eq(manualPaymentVerificationsTable.invoiceId, invoicesTable.id))
    .where(and(eq(manualPaymentVerificationsTable.clinicId, clinicId), eq(manualPaymentVerificationsTable.status, "awaiting_manual_verification")));
  res.json(rows);
});

router.post("/clinics/:clinicId/manual-payment-verifications/:verificationId/verify", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const verificationId = Array.isArray(req.params.verificationId) ? req.params.verificationId[0] : req.params.verificationId;
  const user = (req as any).user;
  const verification = await claimManualTransferVerification({ clinicId, verificationId, verifiedById: user.userId });
  if (!verification) { res.status(404).json({ error: "Awaiting EFT verification not found" }); return; }
  try {
    const result = await processWorkflowEvent(WorkflowEvent.PAYMENT_COMPLETED, {
      clinicId, invoiceId: verification.invoiceId, patientId: verification.patientId, amount: Number(verification.amount), paymentMethod: "transfer", reference: verification.reference, receivedById: user.userId, userRole: (req as any).clinicMember.role, source: "manual", paidAt: new Date(),
    }) as any;
    logActivity({ clinicId, userId: user.userId, userRole: (req as any).clinicMember.role, module: "billing", actionType: "eft_manual_verification_completed", type: "eft_manual_verification_completed", message: "EFT payment verified and completed through the payment workflow.", entityId: verification.id, suppressWhatsAppDispatch: true });
    res.json({ verification, payment: result.payment, invoice: result.invoice, receipt: result.receipt });
  } catch (err: unknown) {
    await reopenManualTransferVerification({ clinicId, verificationId });
    res.status(400).json({ error: err instanceof Error ? err.message : "Unable to complete verified EFT payment" });
  }
});

router.post("/clinics/:clinicId/manual-payment-verifications/:verificationId/reject", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const verificationId = Array.isArray(req.params.verificationId) ? req.params.verificationId[0] : req.params.verificationId;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : null;
  const verification = await rejectManualTransferVerification({ clinicId, verificationId, rejectedById: (req as any).user.userId, reason });
  if (!verification) { res.status(404).json({ error: "Awaiting EFT verification not found" }); return; }
  logActivity({ clinicId, userId: (req as any).user.userId, userRole: (req as any).clinicMember.role, module: "billing", actionType: "eft_manual_verification_rejected", type: "eft_manual_verification_rejected", message: "EFT payment rejected after manual review.", entityId: verification.id, suppressWhatsAppDispatch: true });
  await notifyStaffWorkflow({ clinicId, roles: ["clinic_admin", "cashier", "receptionist"], type: "billing", title: "EFT verification rejected", message: "An EFT payment was rejected after manual review.", entityId: verification.id, targetUrl: "/billing" });
  res.json(verification);
});

// Billing stats for clinic
router.get("/clinics/:clinicId/billing/stats", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin", "cashier", "receptionist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;

  const clinic = await getClinicOrFail(clinicId, res);
  if (!clinic) return;

  if (!clinic.billingEnabled) {
    res.json({ billingEnabled: false, totalRevenue: 0, totalOutstanding: 0, invoiceCount: 0, paidCount: 0, unpaidCount: 0 });
    return;
  }

  const [revenueResult] = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(${invoicesTable.paidAmount}), 0)`,
      totalOutstanding: sql<number>`COALESCE(SUM(${invoicesTable.balance}), 0)`,
      invoiceCount: sql<number>`count(*)`,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.clinicId, clinicId));

  const [paidResult] = await db.select({ count: sql<number>`count(*)` })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.clinicId, clinicId), eq(invoicesTable.status, "paid")));

  const [unpaidResult] = await db.select({ count: sql<number>`count(*)` })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.clinicId, clinicId), eq(invoicesTable.status, "unpaid")));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayRevenue] = await db
    .select({ amount: sql<number>`COALESCE(SUM(${paymentsTable.amount}), 0)` })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.clinicId, clinicId), sql`${paymentsTable.paidAt} >= ${today}`));

  res.json({
    billingEnabled: true,
    clinicType: clinic.clinicType,
    totalRevenue: Number(revenueResult?.totalRevenue ?? 0),
    totalOutstanding: Number(revenueResult?.totalOutstanding ?? 0),
    invoiceCount: Number(revenueResult?.invoiceCount ?? 0),
    paidCount: Number(paidResult?.count ?? 0),
    unpaidCount: Number(unpaidResult?.count ?? 0),
    todayRevenue: Number(todayRevenue?.amount ?? 0),
    bankName: clinic.bankName ?? null,
    bankAccountHolder: clinic.bankAccountHolder ?? null,
    bankAccountNumber: clinic.bankAccountNumber ?? null,
    bankBranchCode: clinic.bankBranchCode ?? null,
    paymentReferenceInstructions: clinic.paymentReferenceInstructions ?? null,
    onlinePaymentsEnabled: clinic.onlinePaymentsEnabled ?? false,
    paymentProvider: clinic.paymentProvider ?? "yoco",
    paymentProviderMode: clinic.paymentProviderMode ?? "test",
    paymentCurrency: clinic.paymentCurrency ?? "ZAR",
    paymentProviderConnectionStatus: clinic.paymentProviderConnectionStatus ?? "not_configured",
    paymentProviderWebhookStatus: clinic.paymentProviderWebhookStatus ?? "not_configured",
    paymentTiming: clinic.paymentTiming,
    allowedManualPaymentMethods: clinic.allowedManualPaymentMethods,
    eftVerificationRequired: clinic.eftVerificationRequired,
    paymentProviderPublicKeyConfigured: !!((clinic.paymentProviderCredentials as any)?.publicKey),
    paymentProviderConfigured: !!((clinic.paymentProviderCredentials as any)?.secretKey),
    paymentProviderWebhookConfigured: !!((clinic.paymentProviderCredentials as any)?.webhookSecret),
  });
});

// Update billing settings for clinic (admin only)
router.patch("/clinics/:clinicId/billing/settings", requireAuth as any, requireClinicMember as any, requireClinicModule("billing") as any, requireRole("clinic_admin") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;

  const UpdateBillingSettings = z.object({
    billingEnabled: z.boolean().optional(),
    consultationFeeEnabled: z.boolean().optional(),
    pharmacyBillingEnabled: z.boolean().optional(),
    labBillingEnabled: z.boolean().optional(),
    bankName: z.string().optional().nullable(),
    bankAccountHolder: z.string().optional().nullable(),
    bankAccountNumber: z.string().optional().nullable(),
    bankBranchCode: z.string().optional().nullable(),
    paymentReferenceInstructions: z.string().optional().nullable(),
    onlinePaymentsEnabled: z.boolean().optional(),
    paymentProvider: z.enum(["yoco"]).optional(),
    paymentProviderMode: z.enum(["test", "live"]).optional(),
    paymentCurrency: z.literal("ZAR").optional(),
    paymentProviderPublicKey: z.string().optional().nullable(),
    paymentProviderSecretKey: z.string().optional().nullable(),
    paymentProviderWebhookSecret: z.string().optional().nullable(),
    paymentTiming: z.enum(["BEFORE_SERVICE", "DURING_WORKFLOW", "AFTER_SERVICE", "END_OF_VISIT"]).optional(),
    allowedManualPaymentMethods: z.array(z.enum(["cash", "card", "transfer", "mobile_money"])).min(1).optional(),
    eftVerificationRequired: z.boolean().optional(),
  });

  const parsed = UpdateBillingSettings.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const update: any = { ...parsed.data };
  const credentialsPatch: Record<string, string> = {};
  if ("paymentProviderPublicKey" in update) {
    if (update.paymentProviderPublicKey) credentialsPatch.publicKey = update.paymentProviderPublicKey;
    delete update.paymentProviderPublicKey;
  }
  if ("paymentProviderSecretKey" in update) {
    if (update.paymentProviderSecretKey) credentialsPatch.secretKey = update.paymentProviderSecretKey;
    delete update.paymentProviderSecretKey;
  }
  if ("paymentProviderWebhookSecret" in update) {
    if (update.paymentProviderWebhookSecret) credentialsPatch.webhookSecret = update.paymentProviderWebhookSecret;
    delete update.paymentProviderWebhookSecret;
  }
  if (Object.keys(credentialsPatch).length > 0) {
    const [current] = await db.select({ paymentProviderCredentials: clinicsTable.paymentProviderCredentials }).from(clinicsTable).where(eq(clinicsTable.id, clinicId));
    update.paymentProviderCredentials = { ...((current?.paymentProviderCredentials as Record<string, unknown>) ?? {}), ...credentialsPatch };
    if (credentialsPatch.secretKey || credentialsPatch.publicKey) update.paymentProviderConnectionStatus = "configured";
    if (credentialsPatch.webhookSecret) update.paymentProviderWebhookStatus = "configured";
  }

  const [clinic] = await db
    .update(clinicsTable)
    .set(stripWhatsappFieldsFromUpdate(update))
    .where(eq(clinicsTable.id, clinicId))
    .returning();
  const financialPolicyFields = ["paymentTiming", "allowedManualPaymentMethods", "eftVerificationRequired"];
  const changedFinancialPolicy = financialPolicyFields.filter(field => field in parsed.data);
  if (changedFinancialPolicy.length > 0) {
    logActivity({
      clinicId,
      userId: (req as any).user.userId,
      userRole: (req as any).clinicMember.role,
      module: "billing",
      actionType: "financial_policy_updated",
      type: "financial_policy_updated",
      message: `Financial policy updated: ${changedFinancialPolicy.join(", ")}.`,
      entityId: clinic.id,
      suppressWhatsAppDispatch: true,
    });
  }
  res.json(toPublicClinic(clinic));
});

export default router;
