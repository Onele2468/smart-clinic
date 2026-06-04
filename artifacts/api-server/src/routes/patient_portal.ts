import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import {
  usersTable,
  clinicsTable,
  clinicMembersTable,
  patientsTable,
  appointmentsTable,
  prescriptionsTable,
  labRequestsTable,
  labResultsTable,
  consultationNotesTable,
  invoicesTable,
  invoiceItemsTable,
  queueEntriesTable,
  nurseAssessmentsTable,
} from "@workspace/db";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { signToken, requireAuth, requirePatientUser, generatePatientCode } from "../lib/auth";
import { isPresentationMode, isDevelopmentOtpBypassEnabled } from "../lib/config";
import { logActivity } from "../lib/activityLogger";
import { toPublicClinic } from "../lib/clinicSerializer";
import { PatientPortalRegisterBody } from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { generateOtp, otpExpiresAt, sendOtpEmail, sendWelcomeEmail } from "../lib/email";

const router: IRouter = Router();

// POST /patient-portal/register
router.post("/patient-portal/register", async (req, res): Promise<void> => {
  const parsed = PatientPortalRegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    name,
    email,
    password,
    clinicCode,
    firstName,
    lastName,
    dateOfBirth,
    gender,
    contactNumber,
    bloodType,
    allergies,
    medicalAidName,
    medicalAidNumber,
    governmentIdType,
    governmentIdNumber,
  } = parsed.data;

  const nationality = (req.body as any).nationality ?? null;

  // Check for duplicate email
  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existingUser) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  // Check for duplicate government ID
  if (governmentIdNumber) {
    const [dupId] = await db.select().from(usersTable).where(
      sql`government_id_number = ${governmentIdNumber}`
    );
    if (dupId) {
      res.status(409).json({ error: "An account with this ID number is already registered" });
      return;
    }
  }

  // Look up clinic by code
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.code, clinicCode));
  if (!clinic) {
    res.status(400).json({ error: "Invalid clinic code. Please check with your clinic." });
    return;
  }

  // Create user
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    role: "patient",
    userType: "patient",
    staffCode: null,
    governmentIdType: (governmentIdType as string | null) ?? null,
    governmentIdNumber: governmentIdNumber ?? null,
    nationality,
  }).returning();

  // Count existing patients in clinic for patient code
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(patientsTable)
    .where(eq(patientsTable.clinicId, clinic.id));
  const patientCount = Number(countResult?.count ?? 0) + 1;
  const patientCode = generatePatientCode(patientCount);

  // Create patient record, linked to the new user
  await db.insert(patientsTable).values({
    clinicId: clinic.id,
    userId: user.id,
    patientCode,
    firstName,
    lastName,
    dateOfBirth,
    gender,
    contactNumber,
    email,
    bloodType: bloodType ?? null,
    allergies: allergies ?? null,
    medicalAidName: medicalAidName ?? null,
    medicalAidNumber: medicalAidNumber ?? null,
    governmentIdType: (governmentIdType as string | null) ?? null,
    governmentIdNumber: governmentIdNumber ?? null,
    nationality,
    status: "active",
  });

  // Add user as a clinic member with patient role
  await db.insert(clinicMembersTable).values({
    clinicId: clinic.id,
    userId: user.id,
    role: "patient",
    status: "active",
  });

  // Presentation mode or development bypass: activate immediately, skip OTP
  if (isPresentationMode() || isDevelopmentOtpBypassEnabled()) {
    if (isDevelopmentOtpBypassEnabled()) {
      req.log.info("[DEV-AUTH] OTP bypass active");
    }
    await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, user.id));
    const token = signToken({ userId: user.id, email: user.email, role: user.role, userType: user.userType });
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, userType: user.userType, createdAt: user.createdAt },
    });
    return;
  }

  // Production mode: generate OTP and require email verification
  const otp = generateOtp();
  const expiresAt = otpExpiresAt();
  await db.update(usersTable).set({ otpCode: otp, otpExpiresAt: expiresAt, emailVerified: false }).where(eq(usersTable.id, user.id));
  await sendOtpEmail(email, name, otp);

  res.status(201).json({ requiresVerification: true, email });
});

// POST /patient-portal/verify-email
router.post("/patient-portal/verify-email", async (req, res): Promise<void> => {
  const { email, otp } = req.body as { email?: string; otp?: string };
  if (!email || !otp) {
    res.status(400).json({ error: "Email and verification code are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(400).json({ error: "Invalid verification request" });
    return;
  }

  if (user.emailVerified) {
    const token = signToken({ userId: user.id, email: user.email, role: user.role, userType: user.userType });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, userType: user.userType, createdAt: user.createdAt } });
    return;
  }

  if (!user.otpCode || !user.otpExpiresAt) {
    res.status(400).json({ error: "No verification code found. Please request a new one." });
    return;
  }

  if (new Date() > user.otpExpiresAt) {
    res.status(400).json({ error: "Verification code has expired. Please request a new one." });
    return;
  }

  if (user.otpCode !== otp.trim()) {
    res.status(400).json({ error: "Invalid verification code. Please check and try again." });
    return;
  }

  await db.update(usersTable)
    .set({ emailVerified: true, otpCode: null, otpExpiresAt: null })
    .where(eq(usersTable.id, user.id));

  sendWelcomeEmail(user.email, user.name).catch(() => {});

  const token = signToken({ userId: user.id, email: user.email, role: user.role, userType: user.userType });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, userType: user.userType, createdAt: user.createdAt } });
});

// POST /patient-portal/resend-otp
router.post("/patient-portal/resend-otp", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.json({ success: true, message: "If this email is registered and unverified, a new code has been sent." });
    return;
  }

  if (user.emailVerified) {
    res.status(400).json({ error: "This email is already verified" });
    return;
  }

  const otp = generateOtp();
  const expiresAt = otpExpiresAt();
  await db.update(usersTable).set({ otpCode: otp, otpExpiresAt: expiresAt }).where(eq(usersTable.id, user.id));
  await sendOtpEmail(email, user.name, otp);

  res.json({ success: true, message: "Verification code resent" });
});

// GET /patient-portal/me
router.get("/patient-portal/me", requireAuth as any, requirePatientUser as any, async (req, res): Promise<void> => {
  const authUser = (req as any).user as { userId: string; role: string; userType: string };

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, authUser.userId));
  if (!patient) {
    res.status(404).json({ error: "Patient profile not found for this account" });
    return;
  }

  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, patient.clinicId));
  if (!clinic) {
    res.status(404).json({ error: "Associated clinic not found" });
    return;
  }

  res.json({ patient, clinic: toPublicClinic(clinic) });
});

// PATCH /patient-portal/me — update own profile
router.patch("/patient-portal/me", requireAuth as any, requirePatientUser as any, async (req, res): Promise<void> => {
  const authUser = (req as any).user as { userId: string };

  const UpdateSchema = z.object({
    contactNumber: z.string().optional(),
    address: z.string().nullable().optional(),
    emergencyContactName: z.string().nullable().optional(),
    emergencyContactPhone: z.string().nullable().optional(),
    bloodType: z.string().nullable().optional(),
    allergies: z.string().nullable().optional(),
    medicalAidName: z.string().nullable().optional(),
    medicalAidNumber: z.string().nullable().optional(),
  });

  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, authUser.userId));
  if (!patient) {
    res.status(404).json({ error: "Patient profile not found" });
    return;
  }

  const [updated] = await db.update(patientsTable)
    .set(parsed.data)
    .where(eq(patientsTable.userId, authUser.userId))
    .returning();

  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, updated.clinicId));
  res.json({ patient: updated, clinic: clinic ? toPublicClinic(clinic) : null });
});

// POST /patient-portal/me/change-password
router.post("/patient-portal/me/change-password", requireAuth as any, requirePatientUser as any, async (req, res): Promise<void> => {
  const authUser = (req as any).user as { userId: string };

  const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  });

  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, authUser.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, authUser.userId));
  res.json({ success: true });
});

// PATCH /patient-portal/me/appointments/:appointmentId/cancel
router.patch("/patient-portal/me/appointments/:appointmentId/cancel", requireAuth as any, requirePatientUser as any, async (req, res): Promise<void> => {
  const authUser = (req as any).user as { userId: string };
  const appointmentId = req.params.appointmentId;

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, authUser.userId));
  if (!patient) {
    res.status(404).json({ error: "Patient profile not found" });
    return;
  }

  const [appt] = await db.select().from(appointmentsTable).where(
    and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.patientId, patient.id))
  );

  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (appt.status === "cancelled" || appt.status === "completed") {
    res.status(400).json({ error: `Cannot cancel an appointment that is already ${appt.status}` });
    return;
  }

  const [updated] = await db.update(appointmentsTable)
    .set({ status: "cancelled" })
    .where(eq(appointmentsTable.id, appointmentId))
    .returning();

  logActivity({
    clinicId: appt.clinicId,
    userId: authUser.userId,
    module: "appointments",
    actionType: "appointment_cancelled",
    type: "appointment_cancelled",
    message: `Appointment cancelled via patient portal`,
    entityId: appointmentId,
  });

  res.json(updated);
});

// GET /patient-portal/me/appointments
router.get("/patient-portal/me/appointments", requireAuth as any, requirePatientUser as any, async (req, res): Promise<void> => {
  const authUser = (req as any).user as { userId: string };

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, authUser.userId));
  if (!patient) {
    res.status(404).json({ error: "Patient profile not found" });
    return;
  }

  const appointments = await db
    .select({
      id: appointmentsTable.id,
      clinicId: appointmentsTable.clinicId,
      patientId: appointmentsTable.patientId,
      doctorId: appointmentsTable.doctorId,
      doctorName: usersTable.name,
      scheduledAt: appointmentsTable.scheduledAt,
      type: appointmentsTable.type,
      status: appointmentsTable.status,
      visitReason: appointmentsTable.visitReason,
      notes: appointmentsTable.notes,
      durationMinutes: appointmentsTable.durationMinutes,
      createdAt: appointmentsTable.createdAt,
    })
    .from(appointmentsTable)
    .leftJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .where(eq(appointmentsTable.patientId, patient.id))
    .orderBy(desc(appointmentsTable.scheduledAt));

  res.json(appointments);
});

// GET /patient-portal/me/prescriptions
router.get("/patient-portal/me/prescriptions", requireAuth as any, requirePatientUser as any, async (req, res): Promise<void> => {
  const authUser = (req as any).user as { userId: string };

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, authUser.userId));
  if (!patient) {
    res.status(404).json({ error: "Patient profile not found" });
    return;
  }

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
      dispensedAt: prescriptionsTable.dispensedAt,
      collectedAt: prescriptionsTable.collectedAt,
      createdAt: prescriptionsTable.createdAt,
    })
    .from(prescriptionsTable)
    .leftJoin(usersTable, eq(prescriptionsTable.doctorId, usersTable.id))
    .where(eq(prescriptionsTable.patientId, patient.id))
    .orderBy(desc(prescriptionsTable.createdAt));

  res.json(prescriptions);
});

// GET /patient-portal/me/lab-requests
router.get("/patient-portal/me/lab-requests", requireAuth as any, requirePatientUser as any, async (req, res): Promise<void> => {
  const authUser = (req as any).user as { userId: string };

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, authUser.userId));
  if (!patient) {
    res.status(404).json({ error: "Patient profile not found" });
    return;
  }

  const labRequests = await db
    .select({
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
    .where(
      and(
        eq(labRequestsTable.patientId, patient.id),
        // Only show finalized results to patients — hide pending/internal
        sql`${labRequestsTable.status} IN ('completed', 'reported', 'collected', 'sent')`
      )
    )
    .orderBy(desc(labRequestsTable.createdAt));

  // Attach the latest submitted result (findings) to each request
  const resultsByRequest = new Map<string, Record<string, unknown>>();
  const reqIds = labRequests.map(r => r.id);
  if (reqIds.length > 0) {
    const allResults = await db
      .select({
        labRequestId: labResultsTable.labRequestId,
        resultId: labResultsTable.id,
        resultText: labResultsTable.resultText,
        resultNotes: labResultsTable.resultNotes,
        resultStatus: labResultsTable.status,
        technicianId: labResultsTable.technicianId,
        technicianName: usersTable.name,
        resultCreatedAt: labResultsTable.createdAt,
      })
      .from(labResultsTable)
      .leftJoin(usersTable, eq(labResultsTable.technicianId, usersTable.id))
      .where(inArray(labResultsTable.labRequestId, reqIds))
      .orderBy(desc(labResultsTable.createdAt));
    for (const r of allResults) {
      if (!resultsByRequest.has(r.labRequestId)) resultsByRequest.set(r.labRequestId, r);
    }
  }

  res.json(labRequests.map(r => ({ ...r, result: resultsByRequest.get(r.id) ?? null })));
});

// GET /patient-portal/me/emr
router.get("/patient-portal/me/emr", requireAuth as any, requirePatientUser as any, async (req, res): Promise<void> => {
  const authUser = (req as any).user as { userId: string };

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, authUser.userId));
  if (!patient) {
    res.status(404).json({ error: "Patient profile not found" });
    return;
  }

  const [consultations, prescriptions, labRequests, appointments, assessments, invoices] = await Promise.all([
    db.select({
      id: consultationNotesTable.id,
      doctorId: consultationNotesTable.doctorId,
      doctorName: usersTable.name,
      consultationCode: consultationNotesTable.consultationCode,
      status: consultationNotesTable.status,
      chiefComplaint: consultationNotesTable.chiefComplaint,
      symptoms: consultationNotesTable.symptoms,
      diagnosis: consultationNotesTable.diagnosis,
      treatmentPlan: consultationNotesTable.treatmentPlan,
      followUpInstructions: consultationNotesTable.followUpInstructions,
      notes: consultationNotesTable.notes,
      createdAt: consultationNotesTable.createdAt,
    }).from(consultationNotesTable)
      .leftJoin(usersTable, eq(consultationNotesTable.doctorId, usersTable.id))
      .where(eq(consultationNotesTable.patientId, patient.id))
      .orderBy(desc(consultationNotesTable.createdAt)),

    db.select({
      id: prescriptionsTable.id,
      doctorId: prescriptionsTable.doctorId,
      prescriptionCode: prescriptionsTable.prescriptionCode,
      medicationName: prescriptionsTable.medicationName,
      dosage: prescriptionsTable.dosage,
      frequency: prescriptionsTable.frequency,
      duration: prescriptionsTable.duration,
      instructions: prescriptionsTable.instructions,
      status: prescriptionsTable.status,
      dispensedAt: prescriptionsTable.dispensedAt,
      createdAt: prescriptionsTable.createdAt,
    }).from(prescriptionsTable)
      .where(eq(prescriptionsTable.patientId, patient.id))
      .orderBy(desc(prescriptionsTable.createdAt)),

    db.select({
      id: labRequestsTable.id,
      doctorId: labRequestsTable.doctorId,
      requestCode: labRequestsTable.requestCode,
      testName: labRequestsTable.testName,
      testCategory: labRequestsTable.testCategory,
      urgency: labRequestsTable.urgency,
      status: labRequestsTable.status,
      createdAt: labRequestsTable.createdAt,
    }).from(labRequestsTable)
      .where(
        and(
          eq(labRequestsTable.patientId, patient.id),
          sql`${labRequestsTable.status} IN ('completed', 'reported', 'collected', 'sent')`
        )
      )
      .orderBy(desc(labRequestsTable.createdAt)),

    db.select({
      id: appointmentsTable.id,
      doctorId: appointmentsTable.doctorId,
      scheduledAt: appointmentsTable.scheduledAt,
      type: appointmentsTable.type,
      status: appointmentsTable.status,
      visitReason: appointmentsTable.visitReason,
      createdAt: appointmentsTable.createdAt,
    }).from(appointmentsTable)
      .where(eq(appointmentsTable.patientId, patient.id))
      .orderBy(desc(appointmentsTable.scheduledAt)),

    db.select({
      id: nurseAssessmentsTable.id,
      nurseId: nurseAssessmentsTable.nurseId,
      weight: nurseAssessmentsTable.weight,
      height: nurseAssessmentsTable.height,
      bloodPressure: nurseAssessmentsTable.bloodPressure,
      pulseRate: nurseAssessmentsTable.pulseRate,
      temperature: nurseAssessmentsTable.temperature,
      oxygenSaturation: nurseAssessmentsTable.oxygenSaturation,
      triageNotes: nurseAssessmentsTable.triageNotes,
      createdAt: nurseAssessmentsTable.createdAt,
    }).from(nurseAssessmentsTable)
      .where(eq(nurseAssessmentsTable.patientId, patient.id))
      .orderBy(desc(nurseAssessmentsTable.createdAt)),

    db.select({
      id: invoicesTable.id,
      invoiceCode: invoicesTable.invoiceCode,
      totalAmount: invoicesTable.totalAmount,
      paidAmount: invoicesTable.paidAmount,
      balance: invoicesTable.balance,
      status: invoicesTable.status,
      createdAt: invoicesTable.createdAt,
    }).from(invoicesTable)
      .where(eq(invoicesTable.patientId, patient.id))
      .orderBy(desc(invoicesTable.createdAt)),
  ]);

  res.json({ patientId: patient.id, consultations, prescriptions, labRequests, appointments, assessments, invoices });
});

// GET /patient-portal/me/invoices
router.get("/patient-portal/me/invoices", requireAuth as any, requirePatientUser as any, async (req, res): Promise<void> => {
  const authUser = (req as any).user as { userId: string };

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, authUser.userId));
  if (!patient) {
    res.status(404).json({ error: "Patient profile not found" });
    return;
  }

  // Fetch clinic to check type and billing details
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, patient.clinicId));

  const clinicBilling = {
    clinicType: clinic?.clinicType ?? "government",
    billingEnabled: clinic?.billingEnabled ?? false,
    clinicName: clinic?.name ?? null,
    bankName: clinic?.bankName ?? null,
    bankAccountHolder: clinic?.bankAccountHolder ?? null,
    bankAccountNumber: clinic?.bankAccountNumber ?? null,
    bankBranchCode: clinic?.bankBranchCode ?? null,
    paymentReferenceInstructions: clinic?.paymentReferenceInstructions ?? null,
  };

  // Government clinics and clinics with billing disabled don't generate patient invoices
  if (!clinic || clinic.clinicType === "government" || !clinic.billingEnabled) {
    res.json({ invoices: [], clinicBilling });
    return;
  }

  const invoices = await db.select({
    id: invoicesTable.id,
    clinicId: invoicesTable.clinicId,
    patientId: invoicesTable.patientId,
    doctorId: invoicesTable.doctorId,
    invoiceCode: invoicesTable.invoiceCode,
    totalAmount: invoicesTable.totalAmount,
    paidAmount: invoicesTable.paidAmount,
    balance: invoicesTable.balance,
    status: invoicesTable.status,
    notes: invoicesTable.notes,
    dueDate: invoicesTable.dueDate,
    createdAt: invoicesTable.createdAt,
  }).from(invoicesTable)
    .where(eq(invoicesTable.patientId, patient.id))
    .orderBy(desc(invoicesTable.createdAt));

  // Fetch all invoice items in one query, then group by invoice
  const invoiceIds = invoices.map(i => i.id);
  const items = invoiceIds.length > 0
    ? await db.select().from(invoiceItemsTable).where(inArray(invoiceItemsTable.invoiceId, invoiceIds))
    : [];

  const itemsByInvoice = new Map<string, typeof items>();
  for (const item of items) {
    if (!itemsByInvoice.has(item.invoiceId)) itemsByInvoice.set(item.invoiceId, []);
    itemsByInvoice.get(item.invoiceId)!.push(item);
  }

  res.json({
    invoices: invoices.map(inv => ({ ...inv, items: itemsByInvoice.get(inv.id) ?? [] })),
    clinicBilling,
  });
});

// POST /patient-portal/me/invoices/:invoiceId/payment-request
router.post("/patient-portal/me/invoices/:invoiceId/payment-request", requireAuth as any, requirePatientUser as any, async (req, res): Promise<void> => {
  const authUser = (req as any).user as { userId: string };
  const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, authUser.userId));
  if (!patient) {
    res.status(404).json({ error: "Patient profile not found" });
    return;
  }

  // Verify invoice belongs to this patient
  const [invoice] = await db.select().from(invoicesTable).where(
    and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.patientId, patient.id))
  );
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (invoice.status === "paid" || invoice.status === "cancelled") {
    res.status(400).json({ error: `Invoice is already ${invoice.status}` });
    return;
  }

  const { reference, notes } = req.body ?? {};

  logActivity({
    clinicId: invoice.clinicId,
    userId: authUser.userId,
    type: "queue_update",
    message: `Patient submitted payment request for invoice ${invoice.invoiceCode}${reference ? ` (ref: ${reference})` : ""}${notes ? ` — ${notes}` : ""}`,
    entityId: invoiceId,
  });

  res.json({ success: true, message: "Payment notification submitted. Our team will verify and update your invoice." });
});

// GET /patient-portal/me/queue-status
router.get("/patient-portal/me/queue-status", requireAuth as any, requirePatientUser as any, async (req, res): Promise<void> => {
  const authUser = (req as any).user as { userId: string };

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.userId, authUser.userId));
  if (!patient) {
    res.status(404).json({ error: "Patient profile not found" });
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const empty = { inQueue: false, ticketNumber: null, position: null, aheadCount: null, estimatedWaitMinutes: null, status: null, type: null, enteredAt: null, currentlyServing: null, completedAt: null };

  // Find today's most recent queue entry for this patient
  const [entry] = await db.select().from(queueEntriesTable).where(
    and(
      eq(queueEntriesTable.patientId, patient.id),
      eq(queueEntriesTable.clinicId, patient.clinicId),
      sql`${queueEntriesTable.createdAt} >= ${today.toISOString()}`
    )
  ).orderBy(desc(queueEntriesTable.createdAt)).limit(1);

  if (!entry) {
    res.json(empty);
    return;
  }

  // Completed / skipped — expose visit summary so patient can see it happened today
  if (entry.status === "completed" || entry.status === "skipped") {
    res.json({ ...empty, ticketNumber: entry.ticketNumber, status: entry.status, type: entry.type, enteredAt: entry.createdAt, completedAt: entry.completedAt ?? null });
    return;
  }

  // Active in queue — run parallel queries for position, currently-serving, and avg wait
  const [aheadResult, currentEntry, completedToday] = await Promise.all([
    // Count people in "waiting" status who checked in before this patient
    db.select({ count: sql<number>`count(*)` }).from(queueEntriesTable).where(
      and(
        eq(queueEntriesTable.clinicId, patient.clinicId),
        eq(queueEntriesTable.status, "waiting"),
        sql`${queueEntriesTable.createdAt} < ${entry.createdAt}`,
        sql`${queueEntriesTable.createdAt} >= ${today.toISOString()}`
      )
    ).then(r => r[0]),

    // Ticket currently being actively served (no patient name — privacy preserved)
    db.select({ ticketNumber: queueEntriesTable.ticketNumber })
      .from(queueEntriesTable)
      .where(
        and(
          eq(queueEntriesTable.clinicId, patient.clinicId),
          sql`${queueEntriesTable.status} IN ('called', 'nurse_assessment', 'doctor_consultation')`,
          sql`${queueEntriesTable.createdAt} >= ${today.toISOString()}`
        )
      )
      .orderBy(sql`${queueEntriesTable.calledAt} DESC NULLS LAST, ${queueEntriesTable.createdAt} DESC`)
      .limit(1)
      .then(r => r[0] ?? null),

    // Today's completed entries for avg-wait calculation
    db.select({ createdAt: queueEntriesTable.createdAt, completedAt: queueEntriesTable.completedAt })
      .from(queueEntriesTable)
      .where(
        and(
          eq(queueEntriesTable.clinicId, patient.clinicId),
          sql`${queueEntriesTable.status} = 'completed'`,
          sql`${queueEntriesTable.completedAt} IS NOT NULL`,
          sql`${queueEntriesTable.createdAt} >= ${today.toISOString()}`
        )
      )
      .limit(20),
  ]);

  const aheadCount = Number(aheadResult?.count ?? 0);
  const position = aheadCount + 1;

  let avgWaitMinutes = 15;
  if (completedToday.length > 0) {
    const totalMs = completedToday.reduce((sum, e) => {
      const ms = new Date(e.completedAt as Date).getTime() - new Date(e.createdAt).getTime();
      return sum + Math.max(0, ms);
    }, 0);
    avgWaitMinutes = Math.max(5, Math.round(totalMs / completedToday.length / 60000));
  }
  const estimatedWaitMinutes = Math.max(1, aheadCount * avgWaitMinutes);

  res.json({
    inQueue: true,
    ticketNumber: entry.ticketNumber,
    position,
    aheadCount,
    estimatedWaitMinutes,
    status: entry.status,
    type: entry.type,
    enteredAt: entry.createdAt,
    currentlyServing: currentEntry?.ticketNumber ?? null,
    completedAt: null,
  });
});

export default router;
