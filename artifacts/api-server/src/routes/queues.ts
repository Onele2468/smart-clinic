import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { queueEntriesTable, patientsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { AddToQueueBody, UpdateQueueEntryBody } from "@workspace/api-zod";
import { requireAuth, requireClinicMember, requireRole, generateTicketNumber } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";
import { logQueueAudit, notifyStaffWorkflow } from "../services/notifications/workflow-notifications.service";
import {
  countTodayQueueEntries,
  countWaitingQueue,
  maybeLogHighPatientVolumeAlert,
  maybeLogQueueThresholdAlert,
} from "../services/whatsapp/operationalAlerts.triggers";
import { syncDoctorAvailabilityFromQueueStatus } from "./staff_availability";

const router: IRouter = Router();
const nurseTable = alias(usersTable, "nurse_user");

const QUEUE_SELECT = (includeNurseJoin: boolean) => ({
  id: queueEntriesTable.id,
  clinicId: queueEntriesTable.clinicId,
  patientId: queueEntriesTable.patientId,
  patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
  patientCode: patientsTable.patientCode,
  ticketNumber: queueEntriesTable.ticketNumber,
  type: queueEntriesTable.type,
  status: queueEntriesTable.status,
  priority: queueEntriesTable.priority,
  assignedDoctorId: queueEntriesTable.assignedDoctorId,
  assignedDoctorName: usersTable.name,
  assignedNurseId: queueEntriesTable.assignedNurseId,
  assignedNurseName: nurseTable.name,
  notes: queueEntriesTable.notes,
  calledAt: queueEntriesTable.calledAt,
  completedAt: queueEntriesTable.completedAt,
  createdAt: queueEntriesTable.createdAt,
});

router.get("/clinics/:clinicId/queues/live", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin", "doctor", "nurse", "receptionist", "pharmacist", "lab_technician", "cashier") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entries = await db
    .select(QUEUE_SELECT(true))
    .from(queueEntriesTable)
    .innerJoin(patientsTable, eq(queueEntriesTable.patientId, patientsTable.id))
    .leftJoin(usersTable, eq(queueEntriesTable.assignedDoctorId, usersTable.id))
    .leftJoin(nurseTable, eq(queueEntriesTable.assignedNurseId, nurseTable.id))
    .where(and(eq(queueEntriesTable.clinicId, clinicId), sql`${queueEntriesTable.createdAt} >= ${today.toISOString()}`))
    .orderBy(sql`${queueEntriesTable.priority} DESC, ${queueEntriesTable.createdAt} ASC`);

  const waiting = entries.filter(e => e.status === "waiting").length;
  const nurseAssessment = entries.filter(e => e.status === "nurse_assessment").length;
  const doctorConsultation = entries.filter(e => e.status === "doctor_consultation").length;
  const inProgress = nurseAssessment + doctorConsultation;
  const pharmacy = entries.filter(e => e.status === "pharmacy").length;
  const laboratory = entries.filter(e => e.status === "laboratory").length;
  const completed = entries.filter(e => e.status === "completed").length;
  const skipped = entries.filter(e => e.status === "skipped").length;

  const completedEntries = entries.filter(e => e.completedAt && e.calledAt);
  const avgWaitMs = completedEntries.length > 0
    ? completedEntries.reduce((sum, e) => {
        const wait = new Date(e.completedAt!).getTime() - new Date(e.createdAt).getTime();
        return sum + Math.max(0, wait);
      }, 0) / completedEntries.length
    : 0;
  const avgWaitMinutes = Math.max(0, Math.round(avgWaitMs / 60000));

  const entriesWithWait = entries.map(e => ({
    ...e,
    assignedDoctorName: e.assignedDoctorName ?? null,
    assignedNurseName: e.assignedNurseName ?? null,
    estimatedWaitMinutes: e.status === "waiting" ? Math.max(5, avgWaitMinutes) : null,
  }));

  res.json({ waiting, nurseAssessment, doctorConsultation, pharmacy, laboratory, inProgress, completed, skipped, avgWaitMinutes, entries: entriesWithWait });
});

router.get("/clinics/:clinicId/queues", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin", "doctor", "nurse", "receptionist", "pharmacist", "lab_technician", "cashier") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const status = req.query.status as string | undefined;
  const type = req.query.type as string | undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entries = await db
    .select(QUEUE_SELECT(true))
    .from(queueEntriesTable)
    .innerJoin(patientsTable, eq(queueEntriesTable.patientId, patientsTable.id))
    .leftJoin(usersTable, eq(queueEntriesTable.assignedDoctorId, usersTable.id))
    .leftJoin(nurseTable, eq(queueEntriesTable.assignedNurseId, nurseTable.id))
    .where(
      and(
        eq(queueEntriesTable.clinicId, clinicId),
        sql`${queueEntriesTable.createdAt} >= ${today.toISOString()}`,
        status ? eq(queueEntriesTable.status, status) : undefined,
        type ? eq(queueEntriesTable.type, type) : undefined
      )
    )
    .orderBy(sql`${queueEntriesTable.priority} DESC, ${queueEntriesTable.createdAt} ASC`);

  res.json(entries.map(e => ({
    ...e,
    assignedDoctorName: e.assignedDoctorName ?? null,
    assignedNurseName: e.assignedNurseName ?? null,
    estimatedWaitMinutes: null,
  })));
});

router.post("/clinics/:clinicId/queues", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const user = (req as any).user;
  const parsed = AddToQueueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const waitingBefore = await countWaitingQueue(clinicId, today);
  const volumeBefore = await countTodayQueueEntries(clinicId, today);

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(queueEntriesTable)
    .where(and(eq(queueEntriesTable.clinicId, clinicId), sql`${queueEntriesTable.createdAt} >= ${today}`));
  const count = Number(countResult[0]?.count ?? 0) + 1;
  const ticketNumber = generateTicketNumber(parsed.data.type, count);

  const assignedNurseId = (parsed.data as any).assignedNurseId ?? null;

  const [entry] = await db.insert(queueEntriesTable).values({
    clinicId,
    patientId: parsed.data.patientId,
    ticketNumber,
    type: parsed.data.type,
    status: "waiting",
    priority: parsed.data.priority ?? (parsed.data.type === "emergency" ? 10 : 0),
    assignedDoctorId: parsed.data.assignedDoctorId ?? null,
    assignedNurseId,
    notes: parsed.data.notes ?? null,
  }).returning();

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, entry.patientId));
  logActivity({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    module: "queue",
    actionType: "queue_added",
    type: "queue_update",
    message: `${patient?.firstName ?? ""} ${patient?.lastName ?? ""} added to queue (${ticketNumber})`,
    entityId: entry.id,
  });
  void Promise.all([
    logQueueAudit({
      clinicId,
      patientId: entry.patientId,
      staffId: user.userId,
      oldStatus: null,
      newStatus: "waiting",
      notes: "Check In",
    }),
    notifyStaffWorkflow({
      clinicId,
      roles: ["nurse"],
      userIds: entry.assignedNurseId ? [entry.assignedNurseId] : [],
      preferenceKey: "appointmentCheckedIn",
      type: "queue",
      title: entry.assignedNurseId ? "Patient assigned to nurse queue" : "Patient waiting for nurse",
      message: `${patient?.firstName ?? ""} ${patient?.lastName ?? ""} is checked in and waiting for assessment (${ticketNumber}).`,
      entityId: entry.id,
      targetUrl: `/queue?queueId=${entry.id}`,
    }),
    notifyStaffWorkflow({
      clinicId,
      roles: ["receptionist"],
      preferenceKey: "appointmentCheckedIn",
      type: "queue",
      title: "Patient checked in",
      message: `${patient?.firstName ?? ""} ${patient?.lastName ?? ""} checked in (${ticketNumber}).`,
      entityId: entry.id,
      targetUrl: `/queue?queueId=${entry.id}`,
    }),
  ]).catch(() => {});

  logActivity({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    module: "queue",
    actionType: "queue_check_in",
    type: "queue_check_in",
    message: `${patient?.firstName ?? ""} ${patient?.lastName ?? ""} checked in to queue (${ticketNumber})`,
    entityId: parsed.data.patientId,
  });

  void maybeLogQueueThresholdAlert({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    waitingBefore,
    waitingAfter: waitingBefore + 1,
    entityId: entry.id,
    ticketNumber,
  }).catch(() => {});

  void maybeLogHighPatientVolumeAlert({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    volumeBefore,
    volumeAfter: volumeBefore + 1,
    entityId: entry.id,
  }).catch(() => {});

  res.status(201).json({
    ...entry,
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : "",
    patientCode: patient?.patientCode ?? "",
    assignedDoctorName: null,
    assignedNurseId: entry.assignedNurseId,
    assignedNurseName: null,
    estimatedWaitMinutes: 15,
  });
});

router.patch("/clinics/:clinicId/queues/:queueId", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const queueId = Array.isArray(req.params.queueId) ? req.params.queueId[0] : req.params.queueId;
  const user = (req as any).user;
  const parsed = UpdateQueueEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [previousEntry] = await db.select().from(queueEntriesTable).where(
    and(eq(queueEntriesTable.id, queueId), eq(queueEntriesTable.clinicId, clinicId))
  );
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "nurse_assessment") {
    updateData.calledAt = new Date();
    updateData.nurseStartedAt = new Date();
  } else if (parsed.data.status === "doctor_consultation") {
    if (!updateData.calledAt) updateData.calledAt = new Date();
    updateData.doctorStartedAt = new Date();
  } else if (parsed.data.status === "pharmacy") {
    updateData.pharmacyAt = new Date();
  } else if (parsed.data.status === "laboratory") {
    updateData.labAt = new Date();
  }
  if (parsed.data.status === "completed" || parsed.data.status === "skipped") {
    updateData.completedAt = new Date();
  }

  const [entry] = await db.update(queueEntriesTable).set(updateData).where(
    and(eq(queueEntriesTable.id, queueId), eq(queueEntriesTable.clinicId, clinicId))
  ).returning();

  if (!entry) {
    res.status(404).json({ error: "Queue entry not found" });
    return;
  }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, entry.patientId));

  if (parsed.data.status) {
    logActivity({
      clinicId,
      userId: user.userId,
      userRole: user.role,
      module: "queue",
      actionType: parsed.data.status === "completed" ? "queue_completed" : "queue_stage_changed",
      type: parsed.data.status === "completed" ? "queue_completed" : "queue_update",
      message: `${patient?.firstName ?? ""} ${patient?.lastName ?? ""} moved to ${parsed.data.status.replace(/_/g, " ")} (${entry.ticketNumber})`,
      entityId: entry.id,
    });

    // Auto-sync doctor availability when queue status changes
    if (entry.assignedDoctorId) {
      await syncDoctorAvailabilityFromQueueStatus(clinicId, entry.assignedDoctorId, parsed.data.status);
    }

    const statusAuditLabel: Record<string, string> = {
      waiting: "Check In",
      nurse_assessment: "Nurse Assessment Start",
      doctor_consultation: "Nurse Assessment Complete",
      laboratory: "Lab Request Created",
      pharmacy: "Prescription Issued",
      completed: "Visit Completed",
    };
    void logQueueAudit({
      clinicId,
      patientId: entry.patientId,
      staffId: user.userId,
      oldStatus: previousEntry?.status ?? null,
      newStatus: parsed.data.status,
      notes: statusAuditLabel[parsed.data.status] ?? `Status changed to ${parsed.data.status}`,
    }).catch(() => {});

    const patientName = `${patient?.firstName ?? ""} ${patient?.lastName ?? ""}`.trim();
    if (parsed.data.status === "nurse_assessment") {
      void notifyStaffWorkflow({
        clinicId,
        roles: ["nurse"],
        userIds: entry.assignedNurseId ? [entry.assignedNurseId] : [],
        preferenceKey: "appointmentCheckedIn",
        type: "queue",
        title: "Patient ready for assessment",
        message: `${patientName} is in the nurse assessment workflow (${entry.ticketNumber}).`,
        entityId: entry.id,
        targetUrl: `/queue?queueId=${entry.id}`,
      }).catch(() => {});
    } else if (parsed.data.status === "doctor_consultation") {
      void notifyStaffWorkflow({
        clinicId,
        roles: ["doctor"],
        userIds: entry.assignedDoctorId ? [entry.assignedDoctorId] : [],
        preferenceKey: "nurseAssessmentComplete",
        type: "queue",
        title: "Patient ready for consultation",
        message: `${patientName} is ready for doctor consultation (${entry.ticketNumber}).`,
        entityId: entry.id,
        targetUrl: `/consultations/${entry.patientId}?queueId=${entry.id}`,
      }).catch(() => {});
    } else if (parsed.data.status === "laboratory") {
      void notifyStaffWorkflow({
        clinicId,
        roles: ["lab_technician"],
        preferenceKey: "labRequested",
        type: "lab_request",
        title: "Patient sent to laboratory",
        message: `${patientName} has been sent to laboratory (${entry.ticketNumber}).`,
        entityId: entry.id,
        targetUrl: `/lab?queueId=${entry.id}`,
      }).catch(() => {});
    } else if (parsed.data.status === "pharmacy") {
      void notifyStaffWorkflow({
        clinicId,
        roles: ["pharmacist"],
        preferenceKey: "prescriptionIssued",
        type: "prescription",
        title: "Patient sent to pharmacy",
        message: `${patientName} has been sent to pharmacy (${entry.ticketNumber}).`,
        entityId: entry.id,
        targetUrl: `/pharmacy?queueId=${entry.id}`,
      }).catch(() => {});
    } else if (parsed.data.status === "completed") {
      void notifyStaffWorkflow({
        clinicId,
        roles: ["receptionist"],
        preferenceKey: "visitCompleted",
        type: "queue",
        title: "Visit completed",
        message: `${patientName} completed the visit (${entry.ticketNumber}).`,
        entityId: entry.id,
        targetUrl: `/queue?queueId=${entry.id}`,
      }).catch(() => {});
    }
  }

  res.json({
    ...entry,
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : "",
    patientCode: patient?.patientCode ?? "",
    assignedDoctorName: null,
    assignedNurseName: null,
    estimatedWaitMinutes: null,
  });
});

router.delete("/clinics/:clinicId/queues/:queueId", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const queueId = Array.isArray(req.params.queueId) ? req.params.queueId[0] : req.params.queueId;
  await db.delete(queueEntriesTable).where(and(eq(queueEntriesTable.id, queueId), eq(queueEntriesTable.clinicId, clinicId)));
  res.json({ success: true, message: "Removed from queue" });
});

export default router;
