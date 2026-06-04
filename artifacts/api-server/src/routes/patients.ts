import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { patientsTable, appointmentsTable } from "@workspace/db";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { CreatePatientBody, UpdatePatientBody } from "@workspace/api-zod";
import { requireAuth, requireClinicMember, requireRole, generatePatientCode } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";
import { logOperationalAlert } from "../services/whatsapp/operationalAlerts.triggers";

const router: IRouter = Router();

router.get("/clinics/:clinicId/patients", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin", "doctor", "nurse", "receptionist", "cashier") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;

  const whereClause = search
    ? and(
        eq(patientsTable.clinicId, clinicId),
        status ? eq(patientsTable.status, status) : undefined,
        or(
          ilike(patientsTable.firstName, `%${search}%`),
          ilike(patientsTable.lastName, `%${search}%`),
          ilike(patientsTable.patientCode, `%${search}%`),
          ilike(patientsTable.contactNumber, `%${search}%`),
          ilike(patientsTable.email, `%${search}%`),
          ilike(patientsTable.governmentIdNumber, `%${search}%`)
        )
      )
    : and(
        eq(patientsTable.clinicId, clinicId),
        status ? eq(patientsTable.status, status) : undefined
      );

  const patients = await db.select().from(patientsTable)
    .where(whereClause)
    .orderBy(sql`${patientsTable.createdAt} DESC`);
  res.json(patients);
});

router.post("/clinics/:clinicId/patients", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin", "receptionist", "nurse", "doctor") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const user = (req as any).user;
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existingCount = await db.select({ count: sql<number>`count(*)` }).from(patientsTable).where(eq(patientsTable.clinicId, clinicId));
  const count = Number(existingCount[0]?.count ?? 0) + 1;
  const patientCode = generatePatientCode(count);

  const dateOfBirth = parsed.data.dateOfBirth instanceof Date
    ? parsed.data.dateOfBirth.toISOString().split("T")[0]
    : String(parsed.data.dateOfBirth);

  const [patient] = await db.insert(patientsTable).values({
    ...parsed.data,
    dateOfBirth,
    clinicId,
    patientCode,
    status: "active",
  }).returning();

  const registrationMessage = `New patient registered: ${patient.firstName} ${patient.lastName} (${patientCode})`;

  logActivity({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    module: "patients",
    actionType: "patient_added",
    type: "patient_registered",
    message: registrationMessage,
    entityId: patient.id,
  });

  logOperationalAlert({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    module: "patients",
    actionType: "op_alert_patient_registered",
    message: registrationMessage,
    entityId: patient.id,
  });

  res.status(201).json(patient);
});

router.get("/clinics/:clinicId/patients/:patientId", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin", "doctor", "nurse", "receptionist", "cashier") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;

  const [patient] = await db.select().from(patientsTable).where(
    and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId))
  );
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const visitsCount = await db.select({ count: sql<number>`count(*)` }).from(appointmentsTable).where(
    and(eq(appointmentsTable.patientId, patientId), eq(appointmentsTable.status, "completed"))
  );

  res.json({ ...patient, recentVisits: Number(visitsCount[0]?.count ?? 0) });
});

router.patch("/clinics/:clinicId/patients/:patientId", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin", "receptionist", "nurse", "doctor") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;

  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [patient] = await db.update(patientsTable).set(parsed.data).where(
    and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId))
  ).returning();

  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }
  res.json(patient);
});

export default router;
