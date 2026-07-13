import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, requireClinicMember, requireRole } from "../lib/auth";
import {
  createReferral,
  getDoctorReferralHistory,
  getPatientReferralHistory,
  getReferral,
  getReferralDashboard,
  listReferrals,
  updateReferralStatus,
} from "../services/referrals/referral.service";

const router: IRouter = Router();

const uuid = z.string().uuid();
const CreateReferralBody = z.object({
  patientId: uuid,
  consultationId: uuid.optional().nullable(),
  referringDoctorId: uuid.optional().nullable(),
  targetClinicId: uuid.optional().nullable(),
  referralType: z.enum(["internal", "external", "specialist", "hospital"]).default("external"),
  destinationName: z.string().min(1).max(200),
  specialty: z.string().max(120).optional().nullable(),
  urgency: z.enum(["routine", "urgent", "emergency"]).default("routine"),
  reason: z.string().min(3),
  clinicalSummary: z.string().optional().nullable(),
  consentGiven: z.boolean().default(false),
});

const UpdateReferralStatusBody = z.object({
  status: z.enum(["accepted", "rejected", "completed", "cancelled"]),
  notes: z.string().optional().nullable(),
});

const ListReferralQuery = z.object({
  search: z.string().optional(),
  status: z.enum(["all", "pending", "accepted", "rejected", "completed", "cancelled"]).optional(),
  urgency: z.enum(["all", "routine", "urgent", "emergency"]).optional(),
  referralType: z.enum(["all", "internal", "external", "specialist", "hospital"]).optional(),
  patientId: uuid.optional(),
  doctorId: uuid.optional(),
  direction: z.enum(["all", "outgoing", "incoming"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

function errorResponse(error: unknown, res: any): void {
  const message = String((error as Error)?.message ?? error);
  const status = message.includes("NOT_FOUND")
    ? 404
    : message.includes("FORBIDDEN")
      ? 403
      : message.includes("UNCHANGED") || message.includes("ALREADY_CLOSED")
        ? 409
        : 400;
  res.status(status).json({ error: message.replaceAll("_", " ").toLowerCase(), code: message });
}

router.get(
  "/clinics/:clinicId/referrals/dashboard",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin", "doctor", "nurse", "receptionist") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    res.json(await getReferralDashboard(clinicId));
  },
);

router.get(
  "/clinics/:clinicId/referrals",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin", "doctor", "nurse", "receptionist") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const parsed = ListReferralQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    res.json(await listReferrals({ clinicId, ...parsed.data }));
  },
);

router.post(
  "/clinics/:clinicId/referrals",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin", "doctor", "nurse", "receptionist") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const user = (req as any).user;
    const parsed = CreateReferralBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    try {
      const referral = await createReferral({
        clinicId,
        ...parsed.data,
        createdById: user.userId,
        createdByRole: user.role,
      });
      res.status(201).json(referral);
    } catch (error) {
      errorResponse(error, res);
    }
  },
);

router.get(
  "/clinics/:clinicId/patients/:patientId/referrals",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin", "doctor", "nurse", "receptionist") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    res.json(await getPatientReferralHistory(clinicId, patientId));
  },
);

router.get(
  "/clinics/:clinicId/doctors/:doctorId/referrals",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin", "doctor", "nurse", "receptionist") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const doctorId = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
    const user = (req as any).user;
    const member = (req as any).clinicMember;
    if (member?.role === "doctor" && user?.userId !== doctorId) {
      res.status(403).json({ error: "Doctors can only view their own referral history" });
      return;
    }
    res.json(await getDoctorReferralHistory(clinicId, doctorId));
  },
);

router.get(
  "/clinics/:clinicId/referrals/:referralId",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin", "doctor", "nurse", "receptionist") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const referralId = Array.isArray(req.params.referralId) ? req.params.referralId[0] : req.params.referralId;
    const referral = await getReferral(clinicId, referralId);
    if (!referral) {
      res.status(404).json({ error: "Referral not found" });
      return;
    }
    res.json(referral);
  },
);

router.patch(
  "/clinics/:clinicId/referrals/:referralId/status",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin", "doctor", "nurse", "receptionist") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const referralId = Array.isArray(req.params.referralId) ? req.params.referralId[0] : req.params.referralId;
    const user = (req as any).user;
    const parsed = UpdateReferralStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    try {
      res.json(await updateReferralStatus({
        clinicId,
        referralId,
        status: parsed.data.status,
        notes: parsed.data.notes,
        userId: user.userId,
        userRole: user.role,
      }));
    } catch (error) {
      errorResponse(error, res);
    }
  },
);

export default router;
