import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  appointmentsTable, patientsTable, usersTable,
  consultationNotesTable, nurseAssessmentsTable, labRequestsTable, prescriptionsTable, invoicesTable
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { CreateAppointmentBody, UpdateAppointmentBody } from "@workspace/api-zod";
import { requireAuth, requireClinicMember, requireRole } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";
import { getClinicSchedulingSettings, validateAppointmentSlot } from "../services/scheduling.service";
import { logQueueAudit, notifyStaffWorkflow } from "../services/notifications/workflow-notifications.service";

const router: IRouter = Router();

const APT_SELECT = {
  id: appointmentsTable.id,
  clinicId: appointmentsTable.clinicId,
  patientId: appointmentsTable.patientId,
  patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
  patientCode: patientsTable.patientCode,
  doctorId: appointmentsTable.doctorId,
  doctorName: usersTable.name,
  scheduledAt: appointmentsTable.scheduledAt,
  checkedInAt: appointmentsTable.checkedInAt,
  type: appointmentsTable.type,
  visitReason: appointmentsTable.visitReason,
  status: appointmentsTable.status,
  notes: appointmentsTable.notes,
  durationMinutes: appointmentsTable.durationMinutes,
  createdAt: appointmentsTable.createdAt,
};

router.get("/clinics/:clinicId/appointments", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin", "doctor", "receptionist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const date = req.query.date as string | undefined;
  const status = req.query.status as string | undefined;
  const doctorId = req.query.doctorId as string | undefined;

  const appointments = await db
    .select(APT_SELECT)
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .where(
      and(
        eq(appointmentsTable.clinicId, clinicId),
        status ? eq(appointmentsTable.status, status) : undefined,
        doctorId ? eq(appointmentsTable.doctorId, doctorId) : undefined,
        date ? sql`DATE(${appointmentsTable.scheduledAt}) = ${date}` : undefined
      )
    )
    .orderBy(sql`${appointmentsTable.scheduledAt} ASC`);

  res.json(appointments);
});

router.post("/clinics/:clinicId/appointments", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const user = (req as any).user;
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const visitReason = (req.body as any).visitReason ?? null;
  const settings = await getClinicSchedulingSettings(clinicId);
  if (!settings.onlineBookingEnabled && user.role !== "clinic_admin" && user.role !== "receptionist") {
    res.status(403).json({ error: "Online booking is disabled for this clinic." });
    return;
  }
  const durationMinutes = parsed.data.durationMinutes ?? settings.appointmentSlotDurationMinutes;
  const scheduledAt = new Date(parsed.data.scheduledAt);
  const validation = await validateAppointmentSlot({
    clinicId,
    doctorId: parsed.data.doctorId,
    scheduledAt,
    durationMinutes,
  });
  if (!validation.available) {
    res.status(409).json({ error: validation.reason, code: validation.code });
    return;
  }

  const [appointment] = await db.insert(appointmentsTable).values({
    clinicId,
    patientId: parsed.data.patientId,
    doctorId: parsed.data.doctorId,
    createdById: user.userId,
    scheduledAt,
    type: parsed.data.type,
    status: "scheduled",
    visitReason,
    notes: parsed.data.notes ?? null,
    durationMinutes,
  }).returning();

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, appointment.patientId));
  const [doctor] = await db.select().from(usersTable).where(eq(usersTable.id, appointment.doctorId));

  logActivity({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    module: "appointments",
    actionType: "appointment_booked",
    type: "appointment_booked",
    message: `Appointment booked for ${patient?.firstName ?? ""} ${patient?.lastName ?? ""} with Dr. ${doctor?.name ?? ""}`,
    entityId: appointment.id,
  });
  void notifyStaffWorkflow({
    clinicId,
    roles: ["receptionist"],
    userIds: [appointment.doctorId],
    preferenceKey: "appointmentBooked",
    type: "appointment",
    title: "Appointment booked",
    message: `Appointment booked for ${patient?.firstName ?? ""} ${patient?.lastName ?? ""} with Dr. ${doctor?.name ?? ""}`,
    entityId: appointment.id,
    targetUrl: `/appointments?appointmentId=${appointment.id}`,
  }).catch(() => {});

  res.status(201).json({
    ...appointment,
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : "",
    patientCode: patient?.patientCode ?? "",
    doctorName: doctor?.name ?? "",
  });
});

router.get("/clinics/:clinicId/appointments/:appointmentId", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin", "doctor", "receptionist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const appointmentId = Array.isArray(req.params.appointmentId) ? req.params.appointmentId[0] : req.params.appointmentId;

  const [appointment] = await db
    .select(APT_SELECT)
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .where(and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.clinicId, clinicId)));

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  res.json(appointment);
});

router.patch("/clinics/:clinicId/appointments/:appointmentId", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const appointmentId = Array.isArray(req.params.appointmentId) ? req.params.appointmentId[0] : req.params.appointmentId;
  const user = (req as any).user;

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.scheduledAt) updateData.scheduledAt = new Date(parsed.data.scheduledAt);

  // Handle visitReason from raw body (not in generated zod yet)
  const visitReason = (req.body as any).visitReason;
  if (visitReason !== undefined) updateData.visitReason = visitReason;

  // Auto-set checkedInAt when status transitions to checked_in
  if (parsed.data.status === "checked_in" && !updateData.checkedInAt) {
    updateData.checkedInAt = new Date();
  }

  const [previousAppointment] = await db.select().from(appointmentsTable).where(
    and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.clinicId, clinicId))
  );
  const [appointment] = await db.update(appointmentsTable).set(updateData).where(
    and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.clinicId, clinicId))
  ).returning();

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  // Log status changes
  if (parsed.data.status) {
    logActivity({
      clinicId,
      userId: user.userId,
      userRole: user.role,
      module: "appointments",
      actionType: "appointment_updated",
      type: "appointment_updated",
      message: `Appointment status changed to ${parsed.data.status}`,
      entityId: appointmentId,
    });

    if (parsed.data.status === "checked_in") {
      logActivity({
        clinicId,
        userId: user.userId,
        userRole: user.role,
        module: "appointments",
        actionType: "appointment_checked_in",
        type: "appointment_checked_in",
        message: `Patient checked in for appointment`,
        entityId: appointmentId,
      });
      void Promise.all([
        logQueueAudit({
          clinicId,
          patientId: appointment.patientId,
          appointmentId,
          staffId: user.userId,
          oldStatus: previousAppointment?.status ?? null,
          newStatus: "checked_in",
          notes: "Check In",
        }),
        notifyStaffWorkflow({
          clinicId,
          roles: ["nurse"],
          preferenceKey: "appointmentCheckedIn",
          type: "queue",
          title: "Patient checked in",
          message: `Patient checked in and is waiting for nurse assessment.`,
          entityId: appointment.patientId,
          targetUrl: `/patients/${appointment.patientId}`,
        }),
        notifyStaffWorkflow({
          clinicId,
          roles: ["receptionist"],
          preferenceKey: "appointmentCheckedIn",
          type: "appointment",
          title: "Patient checked in",
          message: `Patient checked in for appointment.`,
          entityId: appointmentId,
          targetUrl: `/appointments?appointmentId=${appointmentId}`,
        }),
      ]).catch(() => {});
    }
  }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, appointment.patientId));
  const [doctor] = await db.select().from(usersTable).where(eq(usersTable.id, appointment.doctorId));
  res.json({
    ...appointment,
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : "",
    patientCode: patient?.patientCode ?? "",
    doctorName: doctor?.name ?? "",
  });
});

router.delete("/clinics/:clinicId/appointments/:appointmentId", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin", "receptionist", "doctor") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const appointmentId = Array.isArray(req.params.appointmentId) ? req.params.appointmentId[0] : req.params.appointmentId;
  const user = (req as any).user;

  const [appointment] = await db.select().from(appointmentsTable).where(
    and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.clinicId, clinicId))
  );
  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  await db.update(appointmentsTable).set({ status: "cancelled" }).where(eq(appointmentsTable.id, appointmentId));
  logActivity({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    module: "appointments",
    actionType: "appointment_cancelled",
    type: "appointment_cancelled",
    message: `Appointment cancelled`,
    entityId: appointmentId,
  });

  res.json({ success: true, message: "Appointment cancelled" });
});

// EMR — Full patient timeline
router.get("/clinics/:clinicId/patients/:patientId/emr", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin", "doctor", "nurse") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(patientId)) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const [consultations, prescriptions, labRequests, appointments, assessments, invoices] = await Promise.all([
    db.select({
      id: consultationNotesTable.id,
      clinicId: consultationNotesTable.clinicId,
      patientId: consultationNotesTable.patientId,
      doctorId: consultationNotesTable.doctorId,
      doctorName: usersTable.name,
      consultationCode: consultationNotesTable.consultationCode,
      status: consultationNotesTable.status,
      queueEntryId: consultationNotesTable.queueEntryId,
      appointmentId: consultationNotesTable.appointmentId,
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
    })
      .from(consultationNotesTable)
      .leftJoin(usersTable, eq(consultationNotesTable.doctorId, usersTable.id))
      .where(and(eq(consultationNotesTable.clinicId, clinicId), eq(consultationNotesTable.patientId, patientId)))
      .orderBy(desc(consultationNotesTable.createdAt)),

    db.select().from(prescriptionsTable)
      .where(and(eq(prescriptionsTable.clinicId, clinicId), eq(prescriptionsTable.patientId, patientId)))
      .orderBy(desc(prescriptionsTable.createdAt)),

    db.select({
      id: labRequestsTable.id,
      clinicId: labRequestsTable.clinicId,
      patientId: labRequestsTable.patientId,
      doctorId: labRequestsTable.doctorId,
      doctorName: usersTable.name,
      requestCode: labRequestsTable.requestCode,
      testName: labRequestsTable.testName,
      testCategory: labRequestsTable.testCategory,
      urgency: labRequestsTable.urgency,
      notes: labRequestsTable.notes,
      status: labRequestsTable.status,
      createdAt: labRequestsTable.createdAt,
    })
      .from(labRequestsTable)
      .leftJoin(usersTable, eq(labRequestsTable.doctorId, usersTable.id))
      .where(and(eq(labRequestsTable.clinicId, clinicId), eq(labRequestsTable.patientId, patientId)))
      .orderBy(desc(labRequestsTable.createdAt)),

    db.select(APT_SELECT)
      .from(appointmentsTable)
      .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
      .where(and(eq(appointmentsTable.clinicId, clinicId), eq(appointmentsTable.patientId, patientId)))
      .orderBy(desc(appointmentsTable.scheduledAt)),

    db.select().from(nurseAssessmentsTable)
      .where(and(eq(nurseAssessmentsTable.clinicId, clinicId), eq(nurseAssessmentsTable.patientId, patientId)))
      .orderBy(desc(nurseAssessmentsTable.createdAt)),

    db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.clinicId, clinicId), eq(invoicesTable.patientId, patientId)))
      .orderBy(desc(invoicesTable.createdAt)),
  ]);

  res.json({ patientId, consultations, prescriptions, labRequests, appointments, assessments, invoices });
});

export default router;
