import { db } from "@workspace/db";
import {
  clinicMembersTable,
  clinicsTable,
  patientsTable,
  referralsTable,
  referralDocumentsTable,
  referralStatusHistoryTable,
  usersTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { logActivityAsync } from "../../lib/activityLogger";
import { notifyStaffWorkflow } from "../notifications/workflow-notifications.service";

export type ReferralType = "internal" | "external" | "specialist" | "hospital";
export type ReferralStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";
export type ReferralUrgency = "routine" | "urgent" | "emergency";
export type ReferralDirection = "all" | "outgoing" | "incoming";

export interface CreateReferralInput {
  clinicId: string;
  patientId: string;
  consultationId?: string | null;
  referringDoctorId?: string | null;
  targetClinicId?: string | null;
  referralType: ReferralType;
  destinationName: string;
  specialty?: string | null;
  urgency: ReferralUrgency;
  reason: string;
  clinicalSummary?: string | null;
  consentGiven: boolean;
  createdById: string;
  createdByRole?: string | null;
}

export interface UpdateReferralStatusInput {
  clinicId: string;
  referralId: string;
  status: ReferralStatus;
  notes?: string | null;
  userId: string;
  userRole?: string | null;
}

export interface ListReferralsInput {
  clinicId: string;
  search?: string;
  status?: ReferralStatus | "all";
  urgency?: ReferralUrgency | "all";
  referralType?: ReferralType | "all";
  patientId?: string;
  doctorId?: string;
  direction?: ReferralDirection;
  page?: number;
  limit?: number;
}

const TERMINAL_STATUSES = new Set<ReferralStatus>(["completed", "cancelled", "rejected"]);
const REFERRAL_SELECT = {
  id: referralsTable.id,
  clinicId: referralsTable.clinicId,
  patientId: referralsTable.patientId,
  patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
  patientCode: patientsTable.patientCode,
  consultationId: referralsTable.consultationId,
  referringDoctorId: referralsTable.referringDoctorId,
  referringDoctorName: usersTable.name,
  targetClinicId: referralsTable.targetClinicId,
  referralType: referralsTable.referralType,
  destinationName: referralsTable.destinationName,
  specialty: referralsTable.specialty,
  urgency: referralsTable.urgency,
  reason: referralsTable.reason,
  clinicalSummary: referralsTable.clinicalSummary,
  documentText: referralsTable.documentText,
  status: referralsTable.status,
  consentGiven: referralsTable.consentGiven,
  consentGivenAt: referralsTable.consentGivenAt,
  createdById: referralsTable.createdById,
  acceptedById: referralsTable.acceptedById,
  acceptedAt: referralsTable.acceptedAt,
  rejectedById: referralsTable.rejectedById,
  rejectedAt: referralsTable.rejectedAt,
  completedAt: referralsTable.completedAt,
  createdAt: referralsTable.createdAt,
  updatedAt: referralsTable.updatedAt,
};

function buildReferralDocument(input: CreateReferralInput, patientName: string): string {
  return [
    "Health Nexus Referral Letter",
    "",
    `Patient: ${patientName}`,
    `Referral type: ${input.referralType}`,
    `Destination: ${input.destinationName.trim()}`,
    input.specialty ? `Specialty: ${input.specialty}` : null,
    `Urgency: ${input.urgency}`,
    "",
    "Reason for referral:",
    input.reason,
    "",
    input.clinicalSummary ? `Clinical summary:\n${input.clinicalSummary}` : null,
    "",
    "Note: AI may assist referral preparation, but clinical decisions remain with healthcare professionals.",
  ].filter(Boolean).join("\n");
}

function clampPage(input?: number) {
  return Math.max(1, Number.isFinite(input ?? 1) ? Number(input ?? 1) : 1);
}

function clampLimit(input?: number) {
  const value = Number.isFinite(input ?? 20) ? Number(input ?? 20) : 20;
  return Math.min(100, Math.max(1, value));
}

function buildListWhere(input: ListReferralsInput) {
  const q = input.search?.trim().toLowerCase();
  const direction = input.direction ?? "all";
  return and(
    direction === "outgoing"
      ? eq(referralsTable.clinicId, input.clinicId)
      : direction === "incoming"
        ? eq(referralsTable.targetClinicId, input.clinicId)
        : or(eq(referralsTable.clinicId, input.clinicId), eq(referralsTable.targetClinicId, input.clinicId)),
    input.status && input.status !== "all" ? eq(referralsTable.status, input.status) : undefined,
    input.urgency && input.urgency !== "all" ? eq(referralsTable.urgency, input.urgency) : undefined,
    input.referralType && input.referralType !== "all" ? eq(referralsTable.referralType, input.referralType) : undefined,
    input.patientId ? eq(referralsTable.patientId, input.patientId) : undefined,
    input.doctorId ? eq(referralsTable.referringDoctorId, input.doctorId) : undefined,
    q
      ? sql`(
          lower(${patientsTable.firstName} || ' ' || ${patientsTable.lastName}) LIKE ${`%${q}%`}
          OR lower(${patientsTable.patientCode}) LIKE ${`%${q}%`}
          OR lower(${referralsTable.destinationName}) LIKE ${`%${q}%`}
          OR lower(coalesce(${referralsTable.specialty}, '')) LIKE ${`%${q}%`}
          OR lower(${referralsTable.reason}) LIKE ${`%${q}%`}
        )`
      : undefined,
  );
}

export async function listReferrals(input: ListReferralsInput) {
  const page = clampPage(input.page);
  const limit = clampLimit(input.limit);
  const where = buildListWhere(input);

  const [rows, totalRows] = await Promise.all([
    db
      .select(REFERRAL_SELECT)
      .from(referralsTable)
      .innerJoin(patientsTable, eq(referralsTable.patientId, patientsTable.id))
      .leftJoin(usersTable, eq(referralsTable.referringDoctorId, usersTable.id))
      .where(where)
      .orderBy(desc(referralsTable.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)` })
      .from(referralsTable)
      .innerJoin(patientsTable, eq(referralsTable.patientId, patientsTable.id))
      .where(where),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);
  return {
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getReferralDashboard(clinicId: string) {
  const rows = await db
    .select({
      status: referralsTable.status,
      urgency: referralsTable.urgency,
      direction: sql<"incoming" | "outgoing">`case when ${referralsTable.targetClinicId} = ${clinicId} then 'incoming' else 'outgoing' end`,
      count: sql<number>`count(*)`,
    })
    .from(referralsTable)
    .where(or(eq(referralsTable.clinicId, clinicId), eq(referralsTable.targetClinicId, clinicId)))
    .groupBy(referralsTable.status, referralsTable.urgency, sql`case when ${referralsTable.targetClinicId} = ${clinicId} then 'incoming' else 'outgoing' end`);

  const summary = {
    total: 0,
    incoming: 0,
    outgoing: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    completed: 0,
    cancelled: 0,
    urgent: 0,
    emergency: 0,
  };

  for (const row of rows) {
    const count = Number(row.count ?? 0);
    summary.total += count;
    if (row.direction === "incoming") summary.incoming += count;
    else summary.outgoing += count;
    if (row.status in summary) (summary as Record<string, number>)[row.status] += count;
    if (row.urgency === "urgent") summary.urgent += count;
    if (row.urgency === "emergency") summary.emergency += count;
  }

  return summary;
}

export async function getReferral(clinicId: string, referralId: string) {
  const [referral] = await db
    .select(REFERRAL_SELECT)
    .from(referralsTable)
    .innerJoin(patientsTable, eq(referralsTable.patientId, patientsTable.id))
    .leftJoin(usersTable, eq(referralsTable.referringDoctorId, usersTable.id))
    .where(and(eq(referralsTable.id, referralId), or(eq(referralsTable.clinicId, clinicId), eq(referralsTable.targetClinicId, clinicId))));
  if (!referral) return null;

  const [documents, history] = await Promise.all([
    db.select().from(referralDocumentsTable).where(eq(referralDocumentsTable.referralId, referralId)).orderBy(desc(referralDocumentsTable.createdAt)),
    db
      .select({
        id: referralStatusHistoryTable.id,
        clinicId: referralStatusHistoryTable.clinicId,
        referralId: referralStatusHistoryTable.referralId,
        oldStatus: referralStatusHistoryTable.oldStatus,
        newStatus: referralStatusHistoryTable.newStatus,
        notes: referralStatusHistoryTable.notes,
        createdById: referralStatusHistoryTable.createdById,
        createdByName: usersTable.name,
        createdAt: referralStatusHistoryTable.createdAt,
      })
      .from(referralStatusHistoryTable)
      .leftJoin(usersTable, eq(referralStatusHistoryTable.createdById, usersTable.id))
      .where(eq(referralStatusHistoryTable.referralId, referralId))
      .orderBy(asc(referralStatusHistoryTable.createdAt)),
  ]);

  return { ...referral, documents, history };
}

export async function getPatientReferralHistory(clinicId: string, patientId: string) {
  return db
    .select(REFERRAL_SELECT)
    .from(referralsTable)
    .innerJoin(patientsTable, eq(referralsTable.patientId, patientsTable.id))
    .leftJoin(usersTable, eq(referralsTable.referringDoctorId, usersTable.id))
    .where(and(eq(referralsTable.patientId, patientId), or(eq(referralsTable.clinicId, clinicId), eq(referralsTable.targetClinicId, clinicId))))
    .orderBy(desc(referralsTable.createdAt));
}

export async function getDoctorReferralHistory(clinicId: string, doctorId: string) {
  return db
    .select(REFERRAL_SELECT)
    .from(referralsTable)
    .innerJoin(patientsTable, eq(referralsTable.patientId, patientsTable.id))
    .leftJoin(usersTable, eq(referralsTable.referringDoctorId, usersTable.id))
    .where(and(eq(referralsTable.referringDoctorId, doctorId), or(eq(referralsTable.clinicId, clinicId), eq(referralsTable.targetClinicId, clinicId))))
    .orderBy(desc(referralsTable.createdAt));
}

async function assertActiveDoctor(clinicId: string, doctorId: string | null | undefined) {
  if (!doctorId) return;
  const [member] = await db
    .select({ userId: clinicMembersTable.userId })
    .from(clinicMembersTable)
    .where(and(
      eq(clinicMembersTable.clinicId, clinicId),
      eq(clinicMembersTable.userId, doctorId),
      eq(clinicMembersTable.status, "active"),
      inArray(clinicMembersTable.role, ["doctor", "clinic_admin"]),
    ));
  if (!member) throw new Error("REFERRING_DOCTOR_NOT_FOUND");
}

export async function createReferral(input: CreateReferralInput) {
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(and(eq(patientsTable.id, input.patientId), eq(patientsTable.clinicId, input.clinicId)));
  if (!patient) throw new Error("PATIENT_NOT_FOUND");

  if (input.targetClinicId) {
    const [targetClinic] = await db.select({ id: clinicsTable.id }).from(clinicsTable).where(eq(clinicsTable.id, input.targetClinicId));
    if (!targetClinic) throw new Error("TARGET_CLINIC_NOT_FOUND");
  }

  if (input.referralType === "internal" && !input.targetClinicId) {
    throw new Error("INTERNAL_REFERRAL_REQUIRES_TARGET_CLINIC");
  }

  if (input.referralType === "internal" && !input.consentGiven) {
    throw new Error("INTERNAL_REFERRAL_REQUIRES_CONSENT");
  }
  await assertActiveDoctor(input.clinicId, input.referringDoctorId);

  const patientName = `${patient.firstName} ${patient.lastName}`;
  const documentText = buildReferralDocument(input, patientName);
  const now = new Date();

  const [referral] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(referralsTable)
      .values({
        clinicId: input.clinicId,
        patientId: input.patientId,
        consultationId: input.consultationId ?? null,
        referringDoctorId: input.referringDoctorId ?? null,
        targetClinicId: input.targetClinicId ?? null,
        referralType: input.referralType,
        destinationName: input.destinationName.trim(),
        specialty: input.specialty?.trim() || null,
        urgency: input.urgency,
        reason: input.reason.trim(),
        clinicalSummary: input.clinicalSummary?.trim() || null,
        documentText,
        status: "pending",
        consentGiven: input.consentGiven,
        consentGivenAt: input.consentGiven ? now : null,
        createdById: input.createdById,
      })
      .returning();

    await tx.insert(referralDocumentsTable).values({
      clinicId: input.clinicId,
      referralId: created.id,
      documentType: "referral_letter",
      documentText,
      createdById: input.createdById,
    });

    await tx.insert(referralStatusHistoryTable).values({
      clinicId: input.clinicId,
      referralId: created.id,
      oldStatus: null,
      newStatus: "pending",
      notes: "Referral created",
      createdById: input.createdById,
    });

    return [created];
  });

  await logActivityAsync({
    clinicId: input.clinicId,
    userId: input.createdById,
    userRole: input.createdByRole ?? null,
    module: "referrals",
    actionType: "referral_created",
    type: "referral_created",
    message: `Referral created for ${patientName} to ${input.destinationName}`,
    entityId: referral.id,
    suppressWhatsAppDispatch: true,
  });

  void notifyStaffWorkflow({
    clinicId: input.targetClinicId ?? input.clinicId,
    roles: input.targetClinicId ? ["clinic_admin", "doctor", "receptionist"] : ["clinic_admin", "doctor"],
    preferenceKey: undefined,
    type: "referral",
    title: "New referral",
    message: `Referral created for ${patientName} to ${input.destinationName}`,
    entityId: referral.id,
    targetUrl: `/referrals?referralId=${referral.id}`,
  }).catch(() => {});

  return referral;
}

export async function updateReferralStatus(input: UpdateReferralStatusInput) {
  const [existing] = await db
    .select()
    .from(referralsTable)
    .where(and(eq(referralsTable.id, input.referralId), or(eq(referralsTable.clinicId, input.clinicId), eq(referralsTable.targetClinicId, input.clinicId))));
  if (!existing) throw new Error("REFERRAL_NOT_FOUND");
  if (existing.status === input.status) throw new Error("REFERRAL_STATUS_UNCHANGED");
  if (TERMINAL_STATUSES.has(existing.status as ReferralStatus)) throw new Error("REFERRAL_ALREADY_CLOSED");

  const role = input.userRole ?? "";
  const isAdmin = role === "clinic_admin";
  const isDoctor = role === "doctor";
  const isReception = role === "receptionist";
  const isOriginClinic = existing.clinicId === input.clinicId;

  if (input.status === "accepted" && !(isAdmin || isDoctor || isReception)) {
    throw new Error("REFERRAL_ACCEPT_FORBIDDEN");
  }
  if (input.status === "rejected" && !(isAdmin || isDoctor || isReception)) {
    throw new Error("REFERRAL_REJECT_FORBIDDEN");
  }
  if (input.status === "completed" && !(isAdmin || isDoctor)) {
    throw new Error("REFERRAL_COMPLETE_FORBIDDEN");
  }
  if (input.status === "cancelled" && !(isOriginClinic && (isAdmin || isDoctor || isReception))) {
    throw new Error("REFERRAL_CANCEL_FORBIDDEN");
  }
  if (input.status === "pending") {
    throw new Error("REFERRAL_PENDING_FORBIDDEN");
  }

  const patch: Partial<typeof referralsTable.$inferInsert> = {
    status: input.status,
    updatedAt: new Date(),
  };
  if (input.status === "accepted") {
    patch.acceptedById = input.userId;
    patch.acceptedAt = new Date();
  }
  if (input.status === "rejected") {
    patch.rejectedById = input.userId;
    patch.rejectedAt = new Date();
  }
  if (input.status === "completed") {
    patch.completedAt = new Date();
  }

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx.update(referralsTable).set(patch).where(eq(referralsTable.id, input.referralId)).returning();
    await tx.insert(referralStatusHistoryTable).values({
      clinicId: existing.clinicId,
      referralId: input.referralId,
      oldStatus: existing.status,
      newStatus: input.status,
      notes: input.notes ?? null,
      createdById: input.userId,
    });
    return [row];
  });

  await logActivityAsync({
    clinicId: existing.clinicId,
    userId: input.userId,
    userRole: input.userRole ?? null,
    module: "referrals",
    actionType: `referral_${input.status}`,
    type: `referral_${input.status}`,
    message: `Referral ${input.status}: ${existing.destinationName}`,
    entityId: input.referralId,
    suppressWhatsAppDispatch: true,
  });

  void notifyStaffWorkflow({
    clinicId: existing.clinicId,
    roles: ["clinic_admin", "doctor", "receptionist"],
    type: "referral",
    title: `Referral ${input.status}`,
    message: `Referral ${input.status}: ${existing.destinationName}`,
    entityId: input.referralId,
    targetUrl: `/referrals?referralId=${input.referralId}`,
  }).catch(() => {});

  return updated;
}
