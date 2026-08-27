import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  appointmentsTable,
  clinicSettingsTable,
  clinicsTable,
  consultationNotesTable,
  invoiceItemsTable,
  invoicesTable,
  labResultsTable,
  nurseAssessmentsTable,
  patientJourneyTimelineTable,
  patientsTable,
  paymentsTable,
  prescriptionsTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { logActivityAsync } from "../lib/activityLogger.js";
import { requireAuth, requireClinicMember, requireClinicModule, requireRole } from "../lib/auth.js";
import { aiService } from "../services/ai/AIService.js";

const router = Router();

function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

async function respondReviewOnly(params: {
  req: Request;
  res: Response;
  clinicId: string;
  entityId: string;
  purpose: string;
  generate: () => Promise<{ response: string }>;
}): Promise<void> {
  const user = (params.req as any).user;
  const staffRole = (params.req as any).clinicMember?.role ?? user?.role ?? "unknown";
  try {
    const result = await params.generate();
    await logActivityAsync({
      clinicId: params.clinicId,
      userId: user?.userId ?? null,
      userRole: staffRole,
      module: "ai",
      actionType: "review_only_ai_requested",
      type: "review_only_ai_completed",
      message: `Review-only AI assistance generated for ${params.purpose}.`,
      entityId: params.entityId,
      suppressWhatsAppDispatch: true,
    });
    params.res.json({
      reviewOnly: true,
      purpose: params.purpose,
      assistance: result.response,
      disclaimer: "AI-generated draft for authorised human review only. No clinical, workflow, prescription, laboratory, appointment, or payment action has been taken.",
    });
  } catch (error) {
    logger.warn({ error, clinicId: params.clinicId, purpose: params.purpose, entityId: params.entityId }, "Review-only AI unavailable");
    await logActivityAsync({
      clinicId: params.clinicId,
      userId: user?.userId ?? null,
      userRole: staffRole,
      module: "ai",
      actionType: "review_only_ai_failed",
      type: "review_only_ai_unavailable",
      message: `Review-only AI assistance was unavailable for ${params.purpose}.`,
      entityId: params.entityId,
      suppressWhatsAppDispatch: true,
    });
    params.res.status(503).json({
      reviewOnly: true,
      error: "AI assistance is temporarily unavailable. Continue the existing review manually.",
    });
  }
}

// The legacy generic prompt endpoint intentionally no longer submits arbitrary content to the AI provider.
router.post("/ai/summary", requireAuth as any, (_req: Request, res: Response): void => {
  res.status(410).json({
    error: "Generic AI summaries are unavailable. Use an authorised clinic-scoped review-only AI endpoint.",
  });
});

router.post(
  "/clinics/:clinicId/ai/consultations/:consultationId/summary",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("doctor", "clinic_admin") as any,
  async (req: Request, res: Response): Promise<void> => {
    const clinicId = routeParam(req, "clinicId");
    const consultationId = routeParam(req, "consultationId");
    const [consultation] = await db.select().from(consultationNotesTable)
      .where(and(eq(consultationNotesTable.id, consultationId), eq(consultationNotesTable.clinicId, clinicId))).limit(1);
    if (!consultation) { res.status(404).json({ error: "Consultation not found" }); return; }
    await respondReviewOnly({
      req, res, clinicId, entityId: consultation.id, purpose: "doctor_consultation_summary",
      generate: () => aiService.summarizeConsultation({ clinicId, staffRole: (req as any).clinicMember.role, sourceData: consultation }),
    });
  },
);

router.post(
  "/clinics/:clinicId/ai/nurse-assessments/:assessmentId/summary",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("nurse", "clinic_admin") as any,
  async (req: Request, res: Response): Promise<void> => {
    const clinicId = routeParam(req, "clinicId");
    const assessmentId = routeParam(req, "assessmentId");
    const [assessment] = await db.select().from(nurseAssessmentsTable)
      .where(and(eq(nurseAssessmentsTable.id, assessmentId), eq(nurseAssessmentsTable.clinicId, clinicId))).limit(1);
    if (!assessment) { res.status(404).json({ error: "Nurse assessment not found" }); return; }
    await respondReviewOnly({
      req, res, clinicId, entityId: assessment.id, purpose: "nurse_assessment_summary",
      generate: () => aiService.summarizeNurseAssessment({ clinicId, staffRole: (req as any).clinicMember.role, sourceData: assessment }),
    });
  },
);

router.post(
  "/clinics/:clinicId/ai/lab-results/:labResultId/explanation",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("laboratory") as any,
  requireRole("lab_technician", "doctor", "clinic_admin") as any,
  async (req: Request, res: Response): Promise<void> => {
    const clinicId = routeParam(req, "clinicId");
    const labResultId = routeParam(req, "labResultId");
    const [labResult] = await db.select().from(labResultsTable)
      .where(and(eq(labResultsTable.id, labResultId), eq(labResultsTable.clinicId, clinicId))).limit(1);
    if (!labResult) { res.status(404).json({ error: "Laboratory result not found" }); return; }
    await respondReviewOnly({
      req, res, clinicId, entityId: labResult.id, purpose: "laboratory_result_explanation",
      generate: () => aiService.explainLabResults({ clinicId, staffRole: (req as any).clinicMember.role, sourceData: labResult }),
    });
  },
);

router.post(
  "/clinics/:clinicId/ai/prescriptions/:prescriptionId/explanation",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("pharmacy") as any,
  requireRole("pharmacist", "doctor", "clinic_admin") as any,
  async (req: Request, res: Response): Promise<void> => {
    const clinicId = routeParam(req, "clinicId");
    const prescriptionId = routeParam(req, "prescriptionId");
    const [prescription] = await db.select().from(prescriptionsTable)
      .where(and(eq(prescriptionsTable.id, prescriptionId), eq(prescriptionsTable.clinicId, clinicId))).limit(1);
    if (!prescription) { res.status(404).json({ error: "Prescription not found" }); return; }
    await respondReviewOnly({
      req, res, clinicId, entityId: prescription.id, purpose: "prescription_explanation",
      generate: () => aiService.explainMedication({ clinicId, staffRole: (req as any).clinicMember.role, sourceData: prescription }),
    });
  },
);

router.post(
  "/clinics/:clinicId/ai/invoices/:invoiceId/summary",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("billing") as any,
  requireRole("clinic_admin", "cashier", "receptionist") as any,
  async (req: Request, res: Response): Promise<void> => {
    const clinicId = routeParam(req, "clinicId");
    const invoiceId = routeParam(req, "invoiceId");
    const [clinic] = await db.select({ billingEnabled: clinicsTable.billingEnabled }).from(clinicsTable)
      .where(eq(clinicsTable.id, clinicId)).limit(1);
    if (!clinic?.billingEnabled) { res.status(403).json({ error: "Billing is not enabled for this clinic" }); return; }
    const [invoice] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.clinicId, clinicId))).limit(1);
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
    const [items, payments] = await Promise.all([
      db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, invoice.id)),
      db.select().from(paymentsTable).where(and(eq(paymentsTable.invoiceId, invoice.id), eq(paymentsTable.clinicId, clinicId))),
    ]);
    await respondReviewOnly({
      req, res, clinicId, entityId: invoice.id, purpose: "billing_summary",
      generate: () => aiService.summarizeBilling({ clinicId, staffRole: (req as any).clinicMember.role, sourceData: { invoice, items, payments } }),
    });
  },
);

router.post(
  "/clinics/:clinicId/ai/patients/:patientId/follow-up-summary",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("doctor", "nurse", "clinic_admin") as any,
  async (req: Request, res: Response): Promise<void> => {
    const clinicId = routeParam(req, "clinicId");
    const patientId = routeParam(req, "patientId");
    const [patient] = await db.select({ id: patientsTable.id }).from(patientsTable)
      .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId))).limit(1);
    if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }
    const [timeline, consultations, appointments, settings] = await Promise.all([
      db.select().from(patientJourneyTimelineTable).where(and(eq(patientJourneyTimelineTable.clinicId, clinicId), eq(patientJourneyTimelineTable.patientId, patientId))).orderBy(desc(patientJourneyTimelineTable.createdAt)).limit(12),
      db.select({ id: consultationNotesTable.id, followUpInstructions: consultationNotesTable.followUpInstructions, createdAt: consultationNotesTable.createdAt }).from(consultationNotesTable).where(and(eq(consultationNotesTable.clinicId, clinicId), eq(consultationNotesTable.patientId, patientId))).orderBy(desc(consultationNotesTable.createdAt)).limit(3),
      db.select({ id: appointmentsTable.id, scheduledAt: appointmentsTable.scheduledAt, status: appointmentsTable.status }).from(appointmentsTable).where(and(eq(appointmentsTable.clinicId, clinicId), eq(appointmentsTable.patientId, patientId))).orderBy(desc(appointmentsTable.scheduledAt)).limit(3),
      db.select({ timezone: clinicSettingsTable.timezone }).from(clinicSettingsTable).where(eq(clinicSettingsTable.clinicId, clinicId)).limit(1),
    ]);
    await respondReviewOnly({
      req, res, clinicId, entityId: patient.id, purpose: "follow_up_summary",
      generate: () => aiService.summarizeFollowUp({ clinicId, staffRole: (req as any).clinicMember.role, sourceData: { timeline, consultations, appointments, timezone: settings[0]?.timezone ?? null } }),
    });
  },
);

export default router;
