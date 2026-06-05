import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { clinicMembersTable, usersTable, clinicsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET ?? "smart-clinic-secret-key";

export function signToken(payload: { userId: string; email: string; role: string; userType: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string; email: string; role: string; userType: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string; userType: string };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = verifyToken(token);
    (req as Request & { user: typeof decoded }).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Middleware that ensures the authenticated user exists in the users table.
 * This is important for operations that require a valid foreign key reference
 * to the users table (e.g., creating a clinic).
 * Must be used after requireAuth.
 */
export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  userType: string;
}

export class UserSyncEmailConflictError extends Error {
  constructor(public email: string, public existingUserId: string) {
    super(`EMAIL_CONFLICT:${email}`);
    this.name = "UserSyncEmailConflictError";
  }
}

async function getDbSchemaDiagnostics(): Promise<{ searchPath: string; currentSchema: string }> {
  const result = await db.execute(sql`
    SELECT
      current_setting('search_path')::text AS search_path,
      current_schema()::text AS current_schema
  `);
  const row = (result as any)?.rows?.[0] ?? {};
  return {
    searchPath: String(row.search_path ?? ""),
    currentSchema: String(row.current_schema ?? ""),
  };
}

async function remapUserReferencesToAuthId(fromUserId: string, toUserId: string): Promise<void> {
  if (fromUserId === toUserId) return;

  const tempEmail = `migrating+${fromUserId}@invalid.health-nexus.local`;

  await db.transaction(async (tx) => {
    const [sourceUser] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, fromUserId));
    if (!sourceUser) {
      throw new Error(`SYNC_MIGRATION_SOURCE_MISSING:${fromUserId}`);
    }

    const [targetUser] = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, toUserId));
    if (targetUser) {
      throw new Error(`SYNC_MIGRATION_TARGET_EXISTS:${toUserId}`);
    }

    await tx
      .update(usersTable)
      .set({ email: tempEmail, updatedAt: new Date() })
      .where(eq(usersTable.id, fromUserId));

    await tx.insert(usersTable).values({
      id: toUserId,
      name: sourceUser.name,
      email: sourceUser.email,
      passwordHash: sourceUser.passwordHash,
      userType: sourceUser.userType,
      role: sourceUser.role,
      staffCode: sourceUser.staffCode,
      governmentIdType: sourceUser.governmentIdType,
      governmentIdNumber: sourceUser.governmentIdNumber,
      nationality: sourceUser.nationality,
      emailVerified: sourceUser.emailVerified,
      otpCode: sourceUser.otpCode,
      otpExpiresAt: sourceUser.otpExpiresAt,
      lastLoginAt: sourceUser.lastLoginAt,
      createdAt: sourceUser.createdAt,
      updatedAt: new Date(),
    });

    const fkUpdates = [
      sql`UPDATE activity_logs SET user_id = ${toUserId} WHERE user_id = ${fromUserId}`,
      sql`UPDATE appointments SET doctor_id = ${toUserId} WHERE doctor_id = ${fromUserId}`,
      sql`UPDATE appointments SET created_by_id = ${toUserId} WHERE created_by_id = ${fromUserId}`,
      sql`UPDATE clinic_members SET user_id = ${toUserId} WHERE user_id = ${fromUserId}`,
      sql`UPDATE clinics SET owner_user_id = ${toUserId} WHERE owner_user_id = ${fromUserId}`,
      sql`UPDATE consultation_notes SET doctor_id = ${toUserId} WHERE doctor_id = ${fromUserId}`,
      sql`UPDATE join_requests SET user_id = ${toUserId} WHERE user_id = ${fromUserId}`,
      sql`UPDATE notifications SET user_id = ${toUserId} WHERE user_id = ${fromUserId}`,
      sql`UPDATE nurse_assessments SET nurse_id = ${toUserId} WHERE nurse_id = ${fromUserId}`,
      sql`UPDATE prescriptions SET doctor_id = ${toUserId} WHERE doctor_id = ${fromUserId}`,
      sql`UPDATE prescriptions SET dispensed_by_id = ${toUserId} WHERE dispensed_by_id = ${fromUserId}`,
      sql`UPDATE queue_entries SET assigned_doctor_id = ${toUserId} WHERE assigned_doctor_id = ${fromUserId}`,
      sql`UPDATE queue_entries SET assigned_nurse_id = ${toUserId} WHERE assigned_nurse_id = ${fromUserId}`,
      sql`UPDATE lab_requests SET doctor_id = ${toUserId} WHERE doctor_id = ${fromUserId}`,
      sql`UPDATE lab_results SET technician_id = ${toUserId} WHERE technician_id = ${fromUserId}`,
      sql`UPDATE invoices SET doctor_id = ${toUserId} WHERE doctor_id = ${fromUserId}`,
      sql`UPDATE payments SET received_by_id = ${toUserId} WHERE received_by_id = ${fromUserId}`,
      sql`UPDATE stock_movements SET user_id = ${toUserId} WHERE user_id = ${fromUserId}`,
      sql`UPDATE password_reset_tokens SET user_id = ${toUserId} WHERE user_id = ${fromUserId}`,
      sql`UPDATE staff_availability SET user_id = ${toUserId} WHERE user_id = ${fromUserId}`,
      sql`UPDATE patients SET user_id = ${toUserId} WHERE user_id = ${fromUserId}`,
    ];

    for (const updateQuery of fkUpdates) {
      await tx.execute(updateQuery);
    }

    await tx.delete(usersTable).where(eq(usersTable.id, fromUserId));
  });
}

export async function ensureDatabaseUserExists(
  user: AuthUser,
): Promise<{ created: boolean; migratedFromUserId?: string }> {
  const diagnostics = await getDbSchemaDiagnostics();
  console.log(
    `[AUTH-SYNC] start ensureDatabaseUserExists authUserId=${user.userId} email=${user.email} currentSchema=${diagnostics.currentSchema} searchPath=${diagnostics.searchPath}`,
  );

  // Always check explicitly against public.users to avoid schema ambiguity.
  const existingByIdInPublic = await db.execute(sql`
    SELECT id
    FROM public.users
    WHERE id = ${user.userId}::uuid
    LIMIT 1
  `);
  if ((existingByIdInPublic as any)?.rows?.[0]?.id) {
    return { created: false };
  }

  const [existingUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, user.userId));

  if (existingUser) {
    return { created: false };
  }

  const [existingEmail] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, user.email));

  if (existingEmail) {
    console.warn(
      `[AUTH-SYNC] user id mismatch detected for email=${user.email} authUserId=${user.userId} dbUserId=${existingEmail.id}. Starting FK-safe migration.`,
    );
    await remapUserReferencesToAuthId(existingEmail.id, user.userId);
    console.warn(
      `[AUTH-SYNC] migration complete for email=${user.email}. dbUserId moved ${existingEmail.id} -> ${user.userId}`,
    );
    return { created: false, migratedFromUserId: existingEmail.id };
  }

  const generatedName = user.email.split("@")[0];
  console.log(`[AUTH-SYNC] attempting insert user id=${user.userId} email=${user.email}`);

  try {
    const [newUser] = await db
      .insert(usersTable)
      .values({
        id: user.userId,
        name: generatedName,
        email: user.email,
        passwordHash: "",
        userType: user.userType,
        role: user.role,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: usersTable.id });

    console.log(`[AUTH-SYNC] User auto-created successfully: userId=${newUser.id} email=${user.email}`);
    return { created: true };
  } catch (err: unknown) {
    const errorMsg = String((err as any)?.message ?? "");
    if (errorMsg.includes("unique constraint") || errorMsg.includes("duplicate key")) {
      // Race-safe idempotency: if another request inserted between check and insert, treat as success.
      const existingByIdAfterRace = await db.execute(sql`
        SELECT id
        FROM public.users
        WHERE id = ${user.userId}::uuid
        LIMIT 1
      `);
      if ((existingByIdAfterRace as any)?.rows?.[0]?.id) {
        console.log(`[AUTH-SYNC] race-safe sync hit for authUserId=${user.userId}`);
        return { created: false };
      }

      const [recheckUser] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, user.userId));
      if (recheckUser) {
        return { created: false };
      }

      const [recheckEmail] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, user.email));
      if (recheckEmail) {
        throw new UserSyncEmailConflictError(user.email, recheckEmail.id);
      }
    }

    throw err;
  }
}

export async function requireUserExists(
  req: Request & { user?: AuthUser },
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.userId));

  if (!user) {
    res.status(401).json({ error: "User record not found. Please register or log in again." });
    return;
  }

  next();
}

/**
 * Production-grade middleware that combines authentication + intelligent user synchronization.
 * 
 * Flow:
 * 1. Validates JWT token (requireAuth behavior)
 * 2. Checks if authenticated user exists in DB
 * 3. If missing: SAFELY auto-creates user from JWT payload (auto-sync)
 * 4. If creation fails: returns 500 with diagnostic info
 * 5. Logs all auto-sync events for debugging
 * 
 * This prevents foreign key constraint errors when authenticated users somehow
 * lack a corresponding local database record (e.g., from incomplete auth flows,
 * testing token injection, or race conditions).
 * 
 * Safe by design:
 * - Checks for existing user first (by id, then email) to prevent duplicates
 * - Uses JWT payload as authoritative source for user data
 * - Graceful fallback: creates user with generated name if needed
 * - All operations logged for audit trail
 */
export async function ensureUserSyncedAuth(
  req: Request & { user?: AuthUser; userAutoCreated?: boolean },
  res: Response,
  next: NextFunction
): Promise<void> {
  // Step 1: Validate token and extract JWT payload
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  let decoded: AuthUser;
  try {
    decoded = verifyToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  (req as Request & { user: AuthUser }).user = decoded;
  console.log(`[AUTH-SYNC] enter ensureUserSyncedAuth - authUserId=${decoded.userId} email=${decoded.email}`);

  try {
    const diagnostics = await getDbSchemaDiagnostics();
    console.log(
      `[AUTH-SYNC] diagnostics authUserId=${decoded.userId} currentSchema=${diagnostics.currentSchema} searchPath=${diagnostics.searchPath}`,
    );
    const result = await ensureDatabaseUserExists(decoded);
    if (result.created) {
      (req as any).userAutoCreated = true;
      console.log(`[AUTH-SYNC] insert complete authUserId=${decoded.userId}`);
    }
    if (result.migratedFromUserId) {
      console.log(
        `[AUTH-SYNC] user id reconciled for email=${decoded.email} oldDbUserId=${result.migratedFromUserId} authUserId=${decoded.userId}`,
      );
    }
    next();
  } catch (err: unknown) {
    const errorMsg = String((err as any)?.message ?? "");
    console.error(
      { err, userId: decoded.userId, email: decoded.email },
      `[AUTH-SYNC] FAILED to auto-sync user: ${errorMsg}`
    );

    if (err instanceof UserSyncEmailConflictError || errorMsg.includes("EMAIL_CONFLICT")) {
      res.status(409).json({
        error: "User email conflict during sync. Please contact support.",
        code: "EMAIL_CONFLICT",
      });
      return;
    }

    res.status(500).json({
      error: "Failed to synchronize user account. Please try again or contact support.",
      code: "USER_SYNC_FAILED",
      diagnostics: process.env.NODE_ENV === "development" ? errorMsg : undefined,
    });
  }
}

export async function requireClinicMember(
  req: Request & { user?: { userId: string; role: string; userType: string }; clinicMember?: { role: string; status: string } },
  res: Response,
  next: NextFunction
): Promise<void> {
  const rawClinicId = req.params["clinicId"];
  const clinicId = Array.isArray(rawClinicId) ? rawClinicId[0] : rawClinicId;
  if (!clinicId || !req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [member] = await db
    .select()
    .from(clinicMembersTable)
    .where(and(eq(clinicMembersTable.clinicId, clinicId), eq(clinicMembersTable.userId, req.user.userId)));
  if (!member || member.status !== "active") {
    res.status(403).json({ error: "Not a member of this clinic" });
    return;
  }
  // Patient accounts are blocked from staff-only clinic routes.
  if (req.user?.userType === "patient") {
    res.status(403).json({ error: "Access restricted to staff accounts only" });
    return;
  }
  req.clinicMember = member;
  next();
}

/**
 * Middleware that ensures the authenticated user is a patient (userType === 'patient').
 * Must be used after requireAuth. Returns 403 for staff users attempting to access
 * patient-only endpoints.
 */
export function requirePatientUser(
  req: Request & { user?: { userId: string; role: string; userType: string } },
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.userType !== "patient") {
    res.status(403).json({ error: "Access restricted to patient accounts only" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (
    req: Request & { clinicMember?: { role: string; status: string } },
    res: Response,
    next: NextFunction
  ): void => {
    const memberRole = req.clinicMember?.role;
    if (!memberRole || !roles.includes(memberRole)) {
      res.status(403).json({ error: `Access restricted. Required role(s): ${roles.join(", ")}` });
      return;
    }
    next();
  };
}

/**
 * Blocks access for government clinics to modules that are not part of their
 * workflow (billing, pharmacy, laboratory, inventory, suppliers).
 * Must be used after requireClinicMember (so clinicId param is present).
 */
export function requireClinicModule(module: string) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const rawClinicId = req.params["clinicId"];
    const clinicId = Array.isArray(rawClinicId) ? rawClinicId[0] : rawClinicId;
    if (!clinicId) { next(); return; }

    const [clinic] = await db
      .select({ clinicType: clinicsTable.clinicType })
      .from(clinicsTable)
      .where(eq(clinicsTable.id, clinicId));

    if (clinic?.clinicType === "government") {
      res.status(403).json({
        error: `The '${module}' module is not available for Government clinics.`,
        code: "MODULE_UNAVAILABLE",
      });
      return;
    }
    next();
  };
}

export function generateClinicCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `SC-${num}`;
}

export function generatePatientCode(count: number): string {
  const padded = String(count).padStart(5, "0");
  return `PT-${padded}`;
}

export async function generateStaffCode(role: string, clinicId: string): Promise<string> {
  const prefixMap: Record<string, string> = {
    doctor: "DR", nurse: "NR", receptionist: "RC", clinic_admin: "CA",
    pharmacist: "PH", lab_technician: "LB", cashier: "CS",
  };
  const prefix = prefixMap[role] ?? "ST";
  // Count existing staff with this role in this clinic
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(clinicMembersTable)
    .where(and(eq(clinicMembersTable.clinicId, clinicId), eq(clinicMembersTable.role, role)));
  const count = Number(result[0]?.count ?? 0) + 1;
  return `${prefix}-${String(count).padStart(3, "0")}`;
}

export function generateStaffCodeSync(role: string, count: number): string {
  const prefixMap: Record<string, string> = {
    doctor: "DR",
    nurse: "NR",
    receptionist: "RC",
    clinic_admin: "CA",
    pharmacist: "PH",
    lab_technician: "LB",
    cashier: "CS",
  };
  const prefix = prefixMap[role] ?? "ST";
  return `${prefix}-${String(count).padStart(3, "0")}`;
}

export function generateTicketNumber(type: string, count: number): string {
  const prefix = type === "emergency" ? "EM" : type === "nurse" ? "NR" : type === "doctor" ? "DR" : "RG";
  return `${prefix}-${String(count).padStart(3, "0")}`;
}

export function generatePrescriptionCode(count: number): string {
  return `PR-${String(count).padStart(5, "0")}`;
}
