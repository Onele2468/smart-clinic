import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { nurseAssessmentsTable, patientsTable, usersTable, queueEntriesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireClinicMember, requireRole } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";

const router: IRouter = Router();

// List nurse assessments for a patient
router.get(
  "/clinics/:clinicId/patients/:patientId/assessments",
  requireAuth as any,
  requireClinicMember as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;

    const assessments = await db
      .select({
        id: nurseAssessmentsTable.id,
        clinicId: nurseAssessmentsTable.clinicId,
        patientId: nurseAssessmentsTable.patientId,
        nurseId: nurseAssessmentsTable.nurseId,
        nurseName: usersTable.name,
        queueEntryId: nurseAssessmentsTable.queueEntryId,
        bloodPressure: nurseAssessmentsTable.bloodPressure,
        temperature: nurseAssessmentsTable.temperature,
        pulseRate: nurseAssessmentsTable.pulseRate,
        oxygenSaturation: nurseAssessmentsTable.oxygenSaturation,
        weight: nurseAssessmentsTable.weight,
        height: nurseAssessmentsTable.height,
        bloodSugar: nurseAssessmentsTable.bloodSugar,
        symptoms: nurseAssessmentsTable.symptoms,
        triageNotes: nurseAssessmentsTable.triageNotes,
        triageLevel: nurseAssessmentsTable.triageLevel,
        createdAt: nurseAssessmentsTable.createdAt,
      })
      .from(nurseAssessmentsTable)
      .leftJoin(usersTable, eq(nurseAssessmentsTable.nurseId, usersTable.id))
      .where(and(eq(nurseAssessmentsTable.clinicId, clinicId), eq(nurseAssessmentsTable.patientId, patientId)))
      .orderBy(sql`${nurseAssessmentsTable.createdAt} DESC`);

    res.json(assessments);
  }
);

// Get latest nurse assessment for a queue entry
router.get(
  "/clinics/:clinicId/queues/:queueId/assessment",
  requireAuth as any,
  requireClinicMember as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const queueId = Array.isArray(req.params.queueId) ? req.params.queueId[0] : req.params.queueId;

    const [assessment] = await db
      .select({
        id: nurseAssessmentsTable.id,
        clinicId: nurseAssessmentsTable.clinicId,
        patientId: nurseAssessmentsTable.patientId,
        nurseId: nurseAssessmentsTable.nurseId,
        nurseName: usersTable.name,
        queueEntryId: nurseAssessmentsTable.queueEntryId,
        bloodPressure: nurseAssessmentsTable.bloodPressure,
        temperature: nurseAssessmentsTable.temperature,
        pulseRate: nurseAssessmentsTable.pulseRate,
        oxygenSaturation: nurseAssessmentsTable.oxygenSaturation,
        weight: nurseAssessmentsTable.weight,
        height: nurseAssessmentsTable.height,
        bloodSugar: nurseAssessmentsTable.bloodSugar,
        symptoms: nurseAssessmentsTable.symptoms,
        triageNotes: nurseAssessmentsTable.triageNotes,
        triageLevel: nurseAssessmentsTable.triageLevel,
        createdAt: nurseAssessmentsTable.createdAt,
      })
      .from(nurseAssessmentsTable)
      .leftJoin(usersTable, eq(nurseAssessmentsTable.nurseId, usersTable.id))
      .where(and(eq(nurseAssessmentsTable.clinicId, clinicId), eq(nurseAssessmentsTable.queueEntryId, queueId)))
      .orderBy(sql`${nurseAssessmentsTable.createdAt} DESC`)
      .limit(1);

    if (!assessment) {
      res.status(404).json({ error: "No assessment found for this queue entry" });
      return;
    }
    res.json(assessment);
  }
);

// Create nurse assessment (nurse/admin only)
router.post(
  "/clinics/:clinicId/patients/:patientId/assessments",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("nurse", "clinic_admin", "doctor") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    const user = (req as any).user;

    const {
      queueEntryId, bloodPressure, temperature, pulseRate, oxygenSaturation,
      weight, height, bloodSugar, symptoms, triageNotes, triageLevel,
    } = req.body;

    const [assessment] = await db.insert(nurseAssessmentsTable).values({
      clinicId,
      patientId,
      nurseId: user.userId,
      queueEntryId: queueEntryId ?? null,
      bloodPressure: bloodPressure ?? null,
      temperature: temperature ?? null,
      pulseRate: pulseRate ?? null,
      oxygenSaturation: oxygenSaturation ?? null,
      weight: weight ?? null,
      height: height ?? null,
      bloodSugar: bloodSugar ?? null,
      symptoms: symptoms ?? null,
      triageNotes: triageNotes ?? null,
      triageLevel: triageLevel ?? "normal",
    }).returning();

    // If linked to a queue entry, move to doctor_consultation
    if (queueEntryId) {
      await db.update(queueEntriesTable).set({
        status: "doctor_consultation",
        nurseStartedAt: assessment.createdAt,
        doctorStartedAt: new Date(),
      }).where(and(eq(queueEntriesTable.id, queueEntryId), eq(queueEntriesTable.clinicId, clinicId)));
    }

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
    logActivity({
      clinicId,
      module: "nursing",
      userId: user.userId,
      userRole: user.role,
      actionType: "nurse_assessment_completed",
      type: "nurse_assessment_completed",
      message: `Nurse assessment completed for ${patient?.firstName ?? ""} ${patient?.lastName ?? ""}`,
      entityId: patientId,
    });

    const [nurse] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));
    res.status(201).json({ ...assessment, nurseName: nurse?.name ?? "" });
  }
);

export default router;
