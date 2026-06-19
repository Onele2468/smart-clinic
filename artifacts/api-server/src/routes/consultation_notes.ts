import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { consultationNotesTable, patientsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireClinicMember, requireRole } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";
import { logQueueAudit, notifyStaffWorkflow } from "../services/notifications/workflow-notifications.service";

const router: IRouter = Router();

function generateConsultationCode(count: number): string {
  return `CN-${String(count).padStart(5, "0")}`;
}

const NOTE_SELECT = {
  id: consultationNotesTable.id,
  clinicId: consultationNotesTable.clinicId,
  patientId: consultationNotesTable.patientId,
  doctorId: consultationNotesTable.doctorId,
  doctorName: usersTable.name,
  queueEntryId: consultationNotesTable.queueEntryId,
  appointmentId: consultationNotesTable.appointmentId,
  consultationCode: consultationNotesTable.consultationCode,
  status: consultationNotesTable.status,
  chiefComplaint: consultationNotesTable.chiefComplaint,
  symptoms: consultationNotesTable.symptoms,
  vitalSigns: consultationNotesTable.vitalSigns,
  diagnosis: consultationNotesTable.diagnosis,
  prescription: consultationNotesTable.prescription,
  treatmentPlan: consultationNotesTable.treatmentPlan,
  followUpInstructions: consultationNotesTable.followUpInstructions,
  notes: consultationNotesTable.notes,
  createdAt: consultationNotesTable.createdAt,
  updatedAt: consultationNotesTable.updatedAt,
};

router.get(
  "/clinics/:clinicId/patients/:patientId/notes",
  requireAuth as any,
  requireClinicMember as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;

    const notes = await db
      .select(NOTE_SELECT)
      .from(consultationNotesTable)
      .leftJoin(usersTable, eq(consultationNotesTable.doctorId, usersTable.id))
      .where(and(eq(consultationNotesTable.clinicId, clinicId), eq(consultationNotesTable.patientId, patientId)))
      .orderBy(sql`${consultationNotesTable.createdAt} DESC`);

    res.json(notes);
  }
);

router.post(
  "/clinics/:clinicId/patients/:patientId/notes",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("doctor", "clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    const user = (req as any).user;

    const { chiefComplaint, symptoms, vitalSigns, diagnosis, prescription, treatmentPlan, followUpInstructions, notes, status, queueEntryId, appointmentId } = req.body;

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(consultationNotesTable).where(eq(consultationNotesTable.clinicId, clinicId));
    const consultationCode = generateConsultationCode(Number(countResult?.count ?? 0) + 1);

    const [note] = await db.insert(consultationNotesTable).values({
      clinicId,
      patientId,
      doctorId: user.userId,
      consultationCode,
      status: status ?? "in_progress",
      queueEntryId: queueEntryId ?? null,
      appointmentId: appointmentId ?? null,
      chiefComplaint: chiefComplaint ?? null,
      symptoms: symptoms ?? null,
      vitalSigns: vitalSigns ?? null,
      diagnosis: diagnosis ?? null,
      prescription: prescription ?? null,
      treatmentPlan: treatmentPlan ?? null,
      followUpInstructions: followUpInstructions ?? null,
      notes: notes ?? null,
    }).returning();

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
    logActivity({
      clinicId,
      userId: user.userId,
      type: "consultation_created",
      message: `Consultation ${consultationCode} created for ${patient?.firstName ?? ""} ${patient?.lastName ?? ""}`,
      entityId: note.id,
    });

    const [doctor] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));
    res.status(201).json({ ...note, doctorName: doctor?.name ?? "" });
  }
);

router.get(
  "/clinics/:clinicId/patients/:patientId/notes/:noteId",
  requireAuth as any,
  requireClinicMember as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    const noteId = Array.isArray(req.params.noteId) ? req.params.noteId[0] : req.params.noteId;

    const [note] = await db
      .select(NOTE_SELECT)
      .from(consultationNotesTable)
      .leftJoin(usersTable, eq(consultationNotesTable.doctorId, usersTable.id))
      .where(and(eq(consultationNotesTable.id, noteId), eq(consultationNotesTable.clinicId, clinicId), eq(consultationNotesTable.patientId, patientId)));

    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(note);
  }
);

router.patch(
  "/clinics/:clinicId/patients/:patientId/notes/:noteId",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("doctor", "clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    const noteId = Array.isArray(req.params.noteId) ? req.params.noteId[0] : req.params.noteId;
    const user = (req as any).user;

    const { chiefComplaint, symptoms, vitalSigns, diagnosis, prescription, treatmentPlan, followUpInstructions, notes, status } = req.body;

    const updateData: Record<string, unknown> = {};
    if (chiefComplaint !== undefined) updateData.chiefComplaint = chiefComplaint;
    if (symptoms !== undefined) updateData.symptoms = symptoms;
    if (vitalSigns !== undefined) updateData.vitalSigns = vitalSigns;
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
    if (prescription !== undefined) updateData.prescription = prescription;
    if (treatmentPlan !== undefined) updateData.treatmentPlan = treatmentPlan;
    if (followUpInstructions !== undefined) updateData.followUpInstructions = followUpInstructions;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    const [note] = await db.update(consultationNotesTable).set(updateData).where(
      and(eq(consultationNotesTable.id, noteId), eq(consultationNotesTable.clinicId, clinicId), eq(consultationNotesTable.patientId, patientId))
    ).returning();

    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    if (status === "completed") {
      const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
      logActivity({
        clinicId,
        userId: user.userId,
        userRole: user.role,
        module: "consultations",
        actionType: "consultation_completed",
        type: "consultation_completed",
        message: `Consultation completed for ${patient?.firstName ?? ""} ${patient?.lastName ?? ""}`,
        entityId: patientId,
      });
      void Promise.all([
        logQueueAudit({
          clinicId,
          patientId,
          appointmentId: note.appointmentId ?? null,
          staffId: user.userId,
          oldStatus: "doctor_consultation",
          newStatus: "completed",
          notes: "Consultation Complete",
        }),
        notifyStaffWorkflow({
          clinicId,
          roles: ["receptionist"],
          preferenceKey: "visitCompleted",
          type: "queue",
          title: "Consultation completed",
          message: `Consultation completed for ${patient?.firstName ?? ""} ${patient?.lastName ?? ""}.`,
          entityId: note.id,
          targetUrl: `/patients/${patientId}`,
        }),
      ]).catch(() => {});
    }

    const [doctor] = await db.select().from(usersTable).where(eq(usersTable.id, note.doctorId));
    res.json({ ...note, doctorName: doctor?.name ?? "" });
  }
);

export default router;
