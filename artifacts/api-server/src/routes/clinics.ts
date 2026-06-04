import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clinicsTable, clinicMembersTable, usersTable, joinRequestsTable, notificationsTable } from "@workspace/db";
import { eq, and, inArray, ne, count as drizzleCount, sql } from "drizzle-orm";
import { CreateClinicBody, UpdateClinicBody, LookupClinicQueryParams } from "@workspace/api-zod";
import { requireAuth, ensureUserSyncedAuth, requireClinicMember, generateClinicCode, ensureDatabaseUserExists, UserSyncEmailConflictError } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";
import { logOperationalAlert } from "../services/whatsapp/operationalAlerts.triggers";
import { stripWhatsappFieldsFromUpdate, toPublicClinic } from "../lib/clinicSerializer";

const router: IRouter = Router();

const STAFF_ROLES = ["clinic_admin", "doctor", "nurse", "receptionist", "pharmacist", "lab_technician", "cashier"];
const VALID_STATUSES = ["active", "inactive", "suspended"] as const;

/**
 * POST /clinics — Create a new clinic
 * 
 * Uses ensureUserSyncedAuth to prevent foreign key constraint errors:
 * - Validates JWT token
 * - Ensures user exists in DB (auto-creates if missing due to incomplete auth flow)
 * - Logs all user auto-syncs for debugging
 * 
 * Response: 201 Created with clinic object and auto-generated code
 */
router.post("/clinics", ensureUserSyncedAuth as any, async (req, res): Promise<void> => {
  const user = (req as any).user;
  let userAutoCreated = (req as any).userAutoCreated ?? false;
  console.log(`[CLINIC] create start authUserId=${user.userId} email=${user.email}`);

  try {
    const syncResult = await ensureDatabaseUserExists(user);
    if (syncResult.created) {
      userAutoCreated = true;
      console.log(`[CLINIC] User auto-synced before clinic create: userId=${user.userId}`);
    }
    if (syncResult.migratedFromUserId) {
      console.log(`[CLINIC] User ID reconciled before clinic create: oldDbUserId=${syncResult.migratedFromUserId} authUserId=${user.userId}`);
    }
  } catch (err: unknown) {
    const errorMsg = String((err as any)?.message ?? "");
    console.error({ err, userId: user.userId }, "[CLINIC] Failed to ensure auth user exists before clinic create");
    if (err instanceof UserSyncEmailConflictError || errorMsg.includes("EMAIL_CONFLICT")) {
      res.status(409).json({ error: "User email conflict. Please contact support.", code: "EMAIL_CONFLICT" });
      return;
    }
    res.status(500).json({
      error: "Failed to synchronize user account before creating clinic. Please try again.",
      diagnostics: process.env.NODE_ENV === "development" ? errorMsg : undefined,
    });
    return;
  }

  const parsed = CreateClinicBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const fkPrecheck = await db.execute(sql`
      SELECT
        EXISTS(SELECT 1 FROM public.users WHERE id = ${user.userId}::uuid) AS exists_in_public_users,
        current_schema()::text AS current_schema,
        current_setting('search_path')::text AS search_path
    `);
    const pre = (fkPrecheck as any)?.rows?.[0] ?? {};
    console.log(
      `[CLINIC] pre-FK check authUserId=${user.userId} existsInPublicUsers=${Boolean(pre.exists_in_public_users)} currentSchema=${String(pre.current_schema ?? "")} searchPath=${String(pre.search_path ?? "")}`,
    );
    if (!pre.exists_in_public_users) {
      res.status(500).json({
        error: "Authenticated user is not synchronized to public.users.",
        code: "USER_NOT_SYNCED_PUBLIC",
      });
      return;
    }

    // Generate unique clinic code
    let code = generateClinicCode();
    let existing = await db.select().from(clinicsTable).where(eq(clinicsTable.code, code));
    while (existing.length > 0) {
      code = generateClinicCode();
      existing = await db.select().from(clinicsTable).where(eq(clinicsTable.code, code));
    }

    // Create clinic
    console.log(`[CLINIC] inserting clinic owner_user_id=${user.userId}`);
    const [clinic] = await db.insert(clinicsTable).values({
      ownerUserId: user.userId,
      ...stripWhatsappFieldsFromUpdate(parsed.data),
      code,
    }).returning();

    // Add clinic owner as clinic_admin
    await db.insert(clinicMembersTable).values({
      clinicId: clinic.id,
      userId: user.userId,
      role: "clinic_admin",
      status: "active",
    });

    // Log clinic creation (with note if user was auto-synced)
    console.log(`[CLINIC] Created clinic: id=${clinic.id} owner=${user.userId} code=${code}${userAutoCreated ? " (user was auto-synced)" : ""}`);

    res.status(201).json(toPublicClinic(clinic));
  } catch (err: unknown) {
    const errorMsg = String((err as any)?.message ?? "");
    console.error(
      { err, userId: user.userId },
      `[CLINIC] Failed to create clinic: ${errorMsg}`
    );

    // Check for FK constraint error (user doesn't exist - should not happen with ensureUserSyncedAuth)
    if (errorMsg.includes("foreign key") || errorMsg.includes("clinics_owner_user_id_fkey")) {
      res.status(500).json({
        error: "User account integrity error. Please log in again.",
        code: "USER_FK_CONSTRAINT",
      });
      return;
    }

    res.status(500).json({
      error: "Failed to create clinic. Please try again.",
      diagnostics: process.env.NODE_ENV === "development" ? errorMsg : undefined,
    });
  }
});

router.get("/clinics/lookup", async (req, res): Promise<void> => {
  const parsed = LookupClinicQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "code is required" });
    return;
  }
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.code, parsed.data.code));
  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }
  res.json(toPublicClinic(clinic));
});

// GET /clinics/mine — return the authenticated user's current clinic
// MUST be registered before /clinics/:clinicId to avoid "mine" being parsed as a UUID
router.get("/clinics/mine", requireAuth as any, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const [membership] = await db.select({ clinicId: clinicMembersTable.clinicId })
    .from(clinicMembersTable)
    .where(and(eq(clinicMembersTable.userId, user.userId), eq(clinicMembersTable.status, "active")));
  if (!membership) {
    res.status(404).json({ error: "Not in a clinic" });
    return;
  }
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, membership.clinicId));
  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }
  res.json(toPublicClinic(clinic));
});

router.get("/clinics/:clinicId", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }
  res.json(toPublicClinic(clinic));
});

router.patch("/clinics/:clinicId", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const parsed = UpdateClinicBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }
  const [updated] = await db
    .update(clinicsTable)
    .set(stripWhatsappFieldsFromUpdate(parsed.data))
    .where(eq(clinicsTable.id, clinicId))
    .returning();
  res.json(toPublicClinic(updated));
});

// Doctors for appointment booking (active only)
router.get("/clinics/:clinicId/doctors", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const doctors = await db
    .select({
      id: clinicMembersTable.userId,
      name: usersTable.name,
      role: clinicMembersTable.role,
    })
    .from(clinicMembersTable)
    .innerJoin(usersTable, eq(clinicMembersTable.userId, usersTable.id))
    .where(
      and(
        eq(clinicMembersTable.clinicId, clinicId),
        eq(clinicMembersTable.status, "active"),
        inArray(clinicMembersTable.role, ["doctor", "clinic_admin"])
      )
    );
  res.json(doctors);
});

// ── Join Requests ─────────────────────────────────────────────────────────────
/**
 * POST /clinics/:clinicId/join-requests — Submit join request
 * Uses ensureUserSyncedAuth for FK safety (user must exist in DB)
 */
router.post("/clinics/:clinicId/join-requests", ensureUserSyncedAuth as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const user = (req as any).user;
  console.log(`[JOIN-REQUEST] start clinicId=${clinicId} authUserId=${user.userId} email=${user.email}`);

  try {
    const syncResult = await ensureDatabaseUserExists(user);
    if (syncResult.created) {
      console.log(`[JOIN-REQUEST] User auto-synced before request: authUserId=${user.userId}`);
    }
    if (syncResult.migratedFromUserId) {
      console.log(`[JOIN-REQUEST] User ID reconciled before request: oldDbUserId=${syncResult.migratedFromUserId} authUserId=${user.userId}`);
    }
  } catch (err: unknown) {
    const errorMsg = String((err as any)?.message ?? "");
    console.error({ err, userId: user.userId, clinicId }, "[JOIN-REQUEST] Failed to ensure auth user exists before creating join request");
    if (err instanceof UserSyncEmailConflictError || errorMsg.includes("EMAIL_CONFLICT")) {
      res.status(409).json({ error: "User email conflict. Please contact support.", code: "EMAIL_CONFLICT" });
      return;
    }
    res.status(500).json({
      error: "Failed to synchronize user account before submitting join request. Please try again.",
      diagnostics: process.env.NODE_ENV === "development" ? errorMsg : undefined,
    });
    return;
  }

  const { requestedRole, message } = req.body;
  const joinableRoles = ["doctor", "nurse", "receptionist", "pharmacist", "lab_technician", "cashier"];
  
  if (!requestedRole) {
    res.status(400).json({ error: "requestedRole is required" });
    return;
  }
  if (!joinableRoles.includes(requestedRole)) {
    res.status(400).json({ error: "Invalid role for clinic membership" });
    return;
  }

  try {
    const [existing] = await db.select().from(joinRequestsTable).where(
      and(eq(joinRequestsTable.clinicId, clinicId), eq(joinRequestsTable.userId, user.userId), eq(joinRequestsTable.status, "pending"))
    );
    if (existing) {
      res.status(409).json({ error: "Join request already pending" });
      return;
    }

    const [request] = await db.insert(joinRequestsTable).values({
      clinicId, userId: user.userId, requestedRole, message: message ?? null, status: "pending"
    }).returning();

    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));

    logOperationalAlert({
      clinicId,
      userId: user.userId,
      module: "staff",
      actionType: "op_alert_staff_join_request",
      message: `New staff join request from ${dbUser?.name ?? "Unknown"} (${dbUser?.email ?? ""}) for role: ${requestedRole}.`,
      entityId: request.id,
    });

    res.status(201).json({ ...request, userName: dbUser?.name ?? "", userEmail: dbUser?.email ?? "" });
  } catch (err: unknown) {
    const errorMsg = String((err as any)?.message ?? "");
    console.error(
      { err, userId: user.userId, clinicId },
      `[JOIN-REQUEST] Failed to create join request: ${errorMsg}`
    );

    if (errorMsg.includes("foreign key") || errorMsg.includes("join_requests_user_id_fkey")) {
      res.status(500).json({
        error: "User account integrity error. Please log in again.",
        code: "USER_FK_CONSTRAINT",
      });
      return;
    }

    res.status(500).json({
      error: "Failed to submit join request. Please try again.",
      diagnostics: process.env.NODE_ENV === "development" ? errorMsg : undefined,
    });
  }
});

router.get("/clinics/:clinicId/join-requests", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const requests = await db
    .select({
      id: joinRequestsTable.id,
      userId: joinRequestsTable.userId,
      requestedRole: joinRequestsTable.requestedRole,
      status: joinRequestsTable.status,
      message: joinRequestsTable.message,
      userName: usersTable.name,
      userEmail: usersTable.email,
      createdAt: joinRequestsTable.createdAt,
    })
    .from(joinRequestsTable)
    .innerJoin(usersTable, eq(joinRequestsTable.userId, usersTable.id))
    .where(eq(joinRequestsTable.clinicId, clinicId))
    .orderBy(joinRequestsTable.createdAt);
  res.json(requests);
});

router.patch("/clinics/:clinicId/join-requests/:requestId", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  const actor = (req as any).clinicMember as { role: string };
  if (actor.role !== "clinic_admin") {
    res.status(403).json({ error: "Only clinic admins can manage join requests" });
    return;
  }
  const { status, assignedRole } = req.body;
  if (!status || !["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be approved or rejected" });
    return;
  }
  const [request] = await db.update(joinRequestsTable).set({ status }).where(
    and(eq(joinRequestsTable.id, requestId), eq(joinRequestsTable.clinicId, clinicId))
  ).returning();
  if (!request) {
    res.status(404).json({ error: "Join request not found" });
    return;
  }
  const actorUserId = (req as any).user?.userId as string | undefined;
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, request.userId));
  const staffLabel = dbUser?.name ?? dbUser?.email ?? "Staff member";

  if (status === "approved") {
    const finalRole = assignedRole ?? request.requestedRole;
    await db.insert(clinicMembersTable).values({
      clinicId,
      userId: request.userId,
      role: finalRole,
      status: "active",
    }).onConflictDoNothing();
    logActivity({
      clinicId,
      userId: actorUserId ?? null,
      userRole: actor.role,
      module: "staff",
      actionType: "join_approved",
      type: "member_joined",
      message: `Staff join request approved: ${staffLabel} joined as ${finalRole}.`,
      entityId: request.userId,
    });
  } else if (status === "rejected") {
    logActivity({
      clinicId,
      userId: actorUserId ?? null,
      userRole: actor.role,
      module: "staff",
      actionType: "join_rejected",
      type: "join_rejected",
      message: `Staff join request rejected: ${staffLabel}.`,
      entityId: request.userId,
    });
  }
  res.json({ ...request, userName: dbUser?.name ?? "", userEmail: dbUser?.email ?? "" });
});

// ── Members ───────────────────────────────────────────────────────────────────
router.get("/clinics/:clinicId/members", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const statusFilter = req.query.status as string | undefined;
  const roleFilter = req.query.role as string | undefined;

  const members = await db
    .select({
      id: clinicMembersTable.id,
      clinicId: clinicMembersTable.clinicId,
      userId: clinicMembersTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
      staffCode: usersTable.staffCode,
      role: clinicMembersTable.role,
      status: clinicMembersTable.status,
      joinedAt: clinicMembersTable.joinedAt,
      lastLoginAt: usersTable.lastLoginAt,
    })
    .from(clinicMembersTable)
    .innerJoin(usersTable, eq(clinicMembersTable.userId, usersTable.id))
    .where(
      and(
        eq(clinicMembersTable.clinicId, clinicId),
        inArray(clinicMembersTable.role, STAFF_ROLES)
      )
    )
    .orderBy(clinicMembersTable.role, usersTable.name);

  let result = members;
  if (statusFilter && VALID_STATUSES.includes(statusFilter as any)) {
    result = result.filter(m => m.status === statusFilter);
  }
  if (roleFilter && STAFF_ROLES.includes(roleFilter)) {
    result = result.filter(m => m.role === roleFilter);
  }

  res.json(result);
});

router.patch("/clinics/:clinicId/members/:userId", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const actor = (req as any).user as { userId: string };
  const actorMember = (req as any).clinicMember as { role: string };
  const { role, status, reason } = req.body;

  // Only admins can manage members
  if (actorMember.role !== "clinic_admin") {
    res.status(403).json({ error: "Only clinic admins can manage staff." });
    return;
  }

  // Cannot manage own membership via this endpoint
  if (targetUserId === actor.userId) {
    res.status(403).json({ error: "You cannot change your own membership status." });
    return;
  }

  // Fetch target member
  const [targetMember] = await db
    .select()
    .from(clinicMembersTable)
    .where(and(eq(clinicMembersTable.clinicId, clinicId), eq(clinicMembersTable.userId, targetUserId)));
  if (!targetMember) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  // Block deactivation/suspension of the last clinic_admin
  if ((status === "inactive" || status === "suspended") && targetMember.role === "clinic_admin") {
    const [adminCount] = await db
      .select({ count: drizzleCount() })
      .from(clinicMembersTable)
      .where(
        and(
          eq(clinicMembersTable.clinicId, clinicId),
          eq(clinicMembersTable.role, "clinic_admin"),
          eq(clinicMembersTable.status, "active"),
          ne(clinicMembersTable.userId, targetUserId)
        )
      );
    if (!adminCount || adminCount.count === 0) {
      res.status(409).json({ error: "Cannot deactivate the last clinic admin. Assign another admin first." });
      return;
    }
  }

  // Validate role
  if (role && !STAFF_ROLES.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${STAFF_ROLES.join(", ")}` });
    return;
  }

  // Validate status
  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }

  const update: Record<string, string> = {};
  if (role) update.role = role;
  if (status) update.status = status;

  const [updated] = await db
    .update(clinicMembersTable)
    .set(update)
    .where(and(eq(clinicMembersTable.clinicId, clinicId), eq(clinicMembersTable.userId, targetUserId)))
    .returning();

  // Fetch actor and target names for audit log
  const [actorUser] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, actor.userId));
  const [targetUser] = await db.select({ name: usersTable.name, email: usersTable.email, staffCode: usersTable.staffCode }).from(usersTable).where(eq(usersTable.id, targetUserId));

  // Audit log
  let logMessage = "";
  let logType = "member_updated";
  if (status === "inactive") {
    logMessage = `${actorUser?.name ?? "Admin"} deactivated ${targetUser?.name ?? "staff member"}${reason ? ` — Reason: ${reason}` : ""}`;
    logType = "member_deactivated";
  } else if (status === "suspended") {
    logMessage = `${actorUser?.name ?? "Admin"} suspended ${targetUser?.name ?? "staff member"}${reason ? ` — Reason: ${reason}` : ""}`;
    logType = "member_suspended";
  } else if (status === "active") {
    logMessage = `${actorUser?.name ?? "Admin"} activated ${targetUser?.name ?? "staff member"}`;
    logType = "member_activated";
  } else if (role) {
    logMessage = `${actorUser?.name ?? "Admin"} changed role of ${targetUser?.name ?? "staff member"} to ${role}`;
    logType = "role_changed";
  }
  if (logMessage) {
    logActivity({
      clinicId,
      userId: actor.userId,
      userRole: actorMember.role,
      module: "staff",
      actionType: logType,
      type: logType,
      message: logMessage,
      entityId: targetUserId,
    });
  }

  res.json({
    ...updated,
    userName: targetUser?.name ?? "",
    userEmail: targetUser?.email ?? "",
    staffCode: targetUser?.staffCode ?? null,
  });
});

// Soft-delete: remove from clinic access by setting status = inactive
router.delete("/clinics/:clinicId/members/:userId", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const actor = (req as any).user as { userId: string };
  const actorMember = (req as any).clinicMember as { role: string };

  if (actorMember.role !== "clinic_admin") {
    res.status(403).json({ error: "Only clinic admins can remove staff." });
    return;
  }
  if (targetUserId === actor.userId) {
    res.status(403).json({ error: "You cannot remove yourself from the clinic." });
    return;
  }

  const [targetMember] = await db
    .select()
    .from(clinicMembersTable)
    .where(and(eq(clinicMembersTable.clinicId, clinicId), eq(clinicMembersTable.userId, targetUserId)));
  if (!targetMember) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  // Guard: don't remove last admin
  if (targetMember.role === "clinic_admin") {
    const [adminCount] = await db
      .select({ count: drizzleCount() })
      .from(clinicMembersTable)
      .where(
        and(
          eq(clinicMembersTable.clinicId, clinicId),
          eq(clinicMembersTable.role, "clinic_admin"),
          eq(clinicMembersTable.status, "active"),
          ne(clinicMembersTable.userId, targetUserId)
        )
      );
    if (!adminCount || adminCount.count === 0) {
      res.status(409).json({ error: "Cannot remove the last clinic admin." });
      return;
    }
  }

  // Soft delete — preserve history
  await db
    .update(clinicMembersTable)
    .set({ status: "inactive" })
    .where(and(eq(clinicMembersTable.clinicId, clinicId), eq(clinicMembersTable.userId, targetUserId)));

  const [actorUser] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, actor.userId));
  const [targetUser] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, targetUserId));

  logActivity({
    clinicId,
    userId: actor.userId,
    userRole: actorMember.role,
    module: "staff",
    actionType: "member_removed",
    type: "member_removed",
    message: `${actorUser?.name ?? "Admin"} removed ${targetUser?.name ?? "staff member"} from clinic access`,
    entityId: targetUserId,
  });

  res.json({ success: true, message: "Staff member removed from clinic access. Historical records preserved." });
});

export default router;
