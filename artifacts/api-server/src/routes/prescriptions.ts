import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { prescriptionsTable, patientsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireClinicMember, requireRole, generatePrescriptionCode } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";

const router: IRouter = Router();

// List prescriptions for a patient
router.get(
  "/clinics/:clinicId/patients/:patientId/prescriptions",
  requireAuth as any,
  requireClinicMember as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;

    const prescriptions = await db
      .select({
        id: prescriptionsTable.id,
        clinicId: prescriptionsTable.clinicId,
        patientId: prescriptionsTable.patientId,
        doctorId: prescriptionsTable.doctorId,
        doctorName: usersTable.name,
        prescriptionCode: prescriptionsTable.prescriptionCode,
        medicationName: prescriptionsTable.medicationName,
        dosage: prescriptionsTable.dosage,
        frequency: prescriptionsTable.frequency,
        duration: prescriptionsTable.duration,
        instructions: prescriptionsTable.instructions,
        status: prescriptionsTable.status,
        createdAt: prescriptionsTable.createdAt,
        updatedAt: prescriptionsTable.updatedAt,
      })
      .from(prescriptionsTable)
      .leftJoin(usersTable, eq(prescriptionsTable.doctorId, usersTable.id))
      .where(
        and(
          eq(prescriptionsTable.clinicId, clinicId),
          eq(prescriptionsTable.patientId, patientId)
        )
      )
      .orderBy(sql`${prescriptionsTable.createdAt} DESC`);

    res.json(prescriptions);
  }
);

// Create prescription (doctor/admin only)
router.post(
  "/clinics/:clinicId/patients/:patientId/prescriptions",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("doctor", "clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    const user = (req as any).user;

    const { medicationName, dosage, frequency, duration, instructions } = req.body;
    if (!medicationName || !dosage || !frequency || !duration) {
      res.status(400).json({ error: "medicationName, dosage, frequency, and duration are required" });
      return;
    }

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.clinicId, clinicId));
    const count = Number(countResult[0]?.count ?? 0) + 1;
    const prescriptionCode = generatePrescriptionCode(count);

    const [prescription] = await db.insert(prescriptionsTable).values({
      clinicId,
      patientId,
      doctorId: user.userId,
      prescriptionCode,
      medicationName,
      dosage,
      frequency,
      duration,
      instructions: instructions ?? null,
      status: "active",
    }).returning();

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
    logActivity({
      clinicId,
      userId: user.userId,
      userRole: user.role,
      module: "pharmacy",
      actionType: "prescription_created",
      type: "prescription_created",
      message: `Prescription ${prescriptionCode} issued for ${patient?.firstName ?? ""} ${patient?.lastName ?? ""}: ${medicationName}`,
      entityId: prescription.id,
    });

    const [doctor] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));
    res.status(201).json({ ...prescription, doctorName: doctor?.name ?? "" });
  }
);

// Update prescription status
router.patch(
  "/clinics/:clinicId/patients/:patientId/prescriptions/:prescriptionId",
  requireAuth as any,
  requireClinicMember as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    const prescriptionId = Array.isArray(req.params.prescriptionId) ? req.params.prescriptionId[0] : req.params.prescriptionId;

    const { status } = req.body;
    if (!status || !["active", "dispensed", "collected", "cancelled"].includes(status)) {
      res.status(400).json({ error: "status must be active, dispensed, collected, or cancelled" });
      return;
    }

    const [prescription] = await db.update(prescriptionsTable).set({ status }).where(
      and(
        eq(prescriptionsTable.id, prescriptionId),
        eq(prescriptionsTable.clinicId, clinicId),
        eq(prescriptionsTable.patientId, patientId)
      )
    ).returning();

    if (!prescription) {
      res.status(404).json({ error: "Prescription not found" });
      return;
    }

    const [doctor] = await db.select().from(usersTable).where(eq(usersTable.id, prescription.doctorId));
    res.json({ ...prescription, doctorName: doctor?.name ?? "" });
  }
);

export default router;
