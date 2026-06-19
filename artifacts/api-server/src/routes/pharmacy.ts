import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { prescriptionsTable, patientsTable, usersTable, queueEntriesTable, consultationNotesTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth, requireClinicMember, requireRole, requireClinicModule } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";
import { logQueueAudit, notifyStaffWorkflow } from "../services/notifications/workflow-notifications.service";

const router: IRouter = Router();

// Pharmacy queue — all active/pending prescriptions for the clinic
router.get(
  "/clinics/:clinicId/pharmacy/queue",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("pharmacy") as any,
  requireRole("clinic_admin", "pharmacist", "nurse") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const status = req.query.status as string | undefined;

    const doctorUser = db.$with("doctor_user").as(
      db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
    );

    const prescriptions = await db
      .select({
        id: prescriptionsTable.id,
        clinicId: prescriptionsTable.clinicId,
        patientId: prescriptionsTable.patientId,
        patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
        patientCode: patientsTable.patientCode,
        doctorId: prescriptionsTable.doctorId,
        doctorName: usersTable.name,
        dispensedById: prescriptionsTable.dispensedById,
        prescriptionCode: prescriptionsTable.prescriptionCode,
        medicationName: prescriptionsTable.medicationName,
        dosage: prescriptionsTable.dosage,
        frequency: prescriptionsTable.frequency,
        duration: prescriptionsTable.duration,
        instructions: prescriptionsTable.instructions,
        status: prescriptionsTable.status,
        dispensedAt: prescriptionsTable.dispensedAt,
        collectedAt: prescriptionsTable.collectedAt,
        createdAt: prescriptionsTable.createdAt,
        updatedAt: prescriptionsTable.updatedAt,
      })
      .from(prescriptionsTable)
      .innerJoin(patientsTable, eq(prescriptionsTable.patientId, patientsTable.id))
      .leftJoin(usersTable, eq(prescriptionsTable.doctorId, usersTable.id))
      .where(
        and(
          eq(prescriptionsTable.clinicId, clinicId),
          status
            ? eq(prescriptionsTable.status, status)
            : inArray(prescriptionsTable.status, ["active", "dispensed"])
        )
      )
      .orderBy(sql`${prescriptionsTable.createdAt} DESC`);

    res.json(prescriptions);
  }
);

// Dispense / update prescription status from pharmacy
router.patch(
  "/clinics/:clinicId/pharmacy/prescriptions/:prescriptionId",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("pharmacy") as any,
  requireRole("pharmacist", "clinic_admin", "nurse") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const prescriptionId = Array.isArray(req.params.prescriptionId) ? req.params.prescriptionId[0] : req.params.prescriptionId;
    const user = (req as any).user;

    const { status } = req.body;
    if (!status || !["active", "dispensed", "collected", "cancelled"].includes(status)) {
      res.status(400).json({ error: "status must be active, dispensed, collected, or cancelled" });
      return;
    }

    const updateData: Record<string, unknown> = { status };
    if (status === "dispensed") {
      updateData.dispensedById = user.userId;
      updateData.dispensedAt = new Date();
    }
    if (status === "collected") {
      updateData.collectedAt = new Date();
    }

    const [prescription] = await db.update(prescriptionsTable).set(updateData).where(
      and(eq(prescriptionsTable.id, prescriptionId), eq(prescriptionsTable.clinicId, clinicId))
    ).returning();

    if (!prescription) {
      res.status(404).json({ error: "Prescription not found" });
      return;
    }

    const [doctor] = await db.select().from(usersTable).where(eq(usersTable.id, prescription.doctorId));
    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, prescription.patientId));

    logActivity({
      clinicId,
      userId: user.userId,
      userRole: "pharmacist",
      module: "pharmacy",
      actionType: "dispense",
      type: "queue_update",
      message: `Prescription ${prescription.prescriptionCode} marked ${status} for ${patient?.firstName ?? ""} ${patient?.lastName ?? ""}`,
      entityId: prescriptionId,
    });
    void Promise.all([
      logQueueAudit({
        clinicId,
        patientId: prescription.patientId,
        staffId: user.userId,
        oldStatus: "pharmacy",
        newStatus: status === "collected" ? "completed" : "pharmacy",
        notes: status === "dispensed" ? "Medication Dispensed" : status === "collected" ? "Visit Completed" : `Prescription ${status}`,
      }),
      status === "dispensed"
        ? notifyStaffWorkflow({
            clinicId,
            roles: ["receptionist"],
            preferenceKey: "medicationReady",
            type: "prescription",
            title: "Medication ready",
            message: `Medication ready for ${patient?.firstName ?? ""} ${patient?.lastName ?? ""} (${prescription.prescriptionCode}).`,
            entityId: prescriptionId,
            targetUrl: `/pharmacy?prescriptionId=${prescriptionId}`,
          })
        : Promise.resolve(),
      status === "collected"
        ? notifyStaffWorkflow({
            clinicId,
            roles: ["receptionist"],
            preferenceKey: "visitCompleted",
            type: "queue",
            title: "Medication collected",
            message: `${patient?.firstName ?? ""} ${patient?.lastName ?? ""} collected medication.`,
            entityId: prescriptionId,
            targetUrl: `/patients/${prescription.patientId}`,
          })
        : Promise.resolve(),
    ]).catch(() => {});

    res.json({
      ...prescription,
      doctorName: doctor?.name ?? "",
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : "",
      patientCode: patient?.patientCode ?? "",
    });
  }
);

// Pharmacy live queue — today's patients with completed consultations and active prescriptions
router.get(
  "/clinics/:clinicId/pharmacy/live-queue",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("pharmacy") as any,
  requireRole("clinic_admin", "pharmacist", "nurse") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's queue entries that have reached pharmacy or are completed
    const queueEntries = await db
      .select({
        id: queueEntriesTable.id,
        patientId: queueEntriesTable.patientId,
        patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
        patientCode: patientsTable.patientCode,
        ticketNumber: queueEntriesTable.ticketNumber,
        queueStatus: queueEntriesTable.status,
        createdAt: queueEntriesTable.createdAt,
      })
      .from(queueEntriesTable)
      .innerJoin(patientsTable, eq(queueEntriesTable.patientId, patientsTable.id))
      .where(
        and(
          eq(queueEntriesTable.clinicId, clinicId),
          sql`${queueEntriesTable.createdAt} >= ${today.toISOString()}`,
          sql`${queueEntriesTable.status} IN ('pharmacy', 'completed', 'doctor_consultation')`
        )
      )
      .orderBy(sql`${queueEntriesTable.createdAt} ASC`);

    if (queueEntries.length === 0) {
      res.json([]);
      return;
    }

    const patientIds = [...new Set(queueEntries.map(e => e.patientId))];

    // Run in parallel: active/dispensed prescriptions + completed consultations for these patients
    const [prescriptions, consultations] = await Promise.all([
      db
        .select({
          id: prescriptionsTable.id,
          patientId: prescriptionsTable.patientId,
          prescriptionCode: prescriptionsTable.prescriptionCode,
          medicationName: prescriptionsTable.medicationName,
          dosage: prescriptionsTable.dosage,
          status: prescriptionsTable.status,
          dispensedAt: prescriptionsTable.dispensedAt,
          collectedAt: prescriptionsTable.collectedAt,
          createdAt: prescriptionsTable.createdAt,
        })
        .from(prescriptionsTable)
        .where(
          and(
            eq(prescriptionsTable.clinicId, clinicId),
            inArray(prescriptionsTable.patientId, patientIds),
            inArray(prescriptionsTable.status, ["active", "dispensed"]),
            sql`${prescriptionsTable.createdAt} >= ${today.toISOString()}`
          )
        )
        .orderBy(sql`${prescriptionsTable.createdAt} ASC`),

      db
        .select({ patientId: consultationNotesTable.patientId })
        .from(consultationNotesTable)
        .where(
          and(
            eq(consultationNotesTable.clinicId, clinicId),
            inArray(consultationNotesTable.patientId, patientIds),
            eq(consultationNotesTable.status, "completed"),
            sql`${consultationNotesTable.createdAt} >= ${today.toISOString()}`
          )
        ),
    ]);

    const consultationSet = new Set(consultations.map(c => c.patientId));
    const rxByPatient = new Map<string, typeof prescriptions>();
    for (const rx of prescriptions) {
      if (!rxByPatient.has(rx.patientId)) rxByPatient.set(rx.patientId, []);
      rxByPatient.get(rx.patientId)!.push(rx);
    }

    const result = queueEntries
      .map(e => ({
        queueEntryId: e.id,
        ticketNumber: e.ticketNumber,
        queueStatus: e.queueStatus,
        patientId: e.patientId,
        patientName: e.patientName,
        patientCode: e.patientCode,
        consultationCompleted: consultationSet.has(e.patientId),
        prescriptions: rxByPatient.get(e.patientId) ?? [],
        enteredAt: e.createdAt,
      }))
      .filter(e =>
        e.prescriptions.length > 0 &&
        (e.consultationCompleted || e.queueStatus === "pharmacy")
      );

    res.json(result);
  }
);

export default router;
