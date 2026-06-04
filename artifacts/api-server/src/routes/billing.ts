import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable, invoiceItemsTable, paymentsTable,
  patientsTable, usersTable, clinicsTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth, requireClinicMember, requireRole, requireClinicModule } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";
import {
  countUnpaidInvoices,
  maybeLogUnpaidInvoicesAlert,
} from "../services/whatsapp/operationalAlerts.triggers";
import { stripWhatsappFieldsFromUpdate, toPublicClinic } from "../lib/clinicSerializer";
import { z } from "zod";

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
  const currentPaid = parseFloat(String(invoice.paidAmount));
  const total = parseFloat(String(invoice.totalAmount));
  const newPaid = Math.min(currentPaid + amount, total);
  const newBalance = total - newPaid;
  const newStatus = newBalance <= 0 ? "paid" : newPaid > 0 ? "partial" : "unpaid";

  const [payment] = await db.insert(paymentsTable).values({
    invoiceId,
    clinicId,
    receivedById: user.userId,
    amount: String(amount),
    paymentMethod,
    reference: reference ?? null,
    paidAt: new Date(),
  }).returning();

  const [updatedInvoice] = await db.update(invoicesTable)
    .set({ paidAmount: String(newPaid), balance: String(newBalance), status: newStatus })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  logActivity({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    module: "billing",
    actionType: "payment_recorded",
    type: "payment_recorded",
    message: `Payment of ${amount} recorded for invoice ${invoice.invoiceCode} via ${paymentMethod}`,
    entityId: invoiceId,
  });

  res.status(201).json({ payment, invoice: updatedInvoice });
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
  });

  const parsed = UpdateBillingSettings.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [clinic] = await db
    .update(clinicsTable)
    .set(stripWhatsappFieldsFromUpdate(parsed.data))
    .where(eq(clinicsTable.id, clinicId))
    .returning();
  res.json(toPublicClinic(clinic));
});

export default router;
