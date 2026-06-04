import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, clinicMembersTable, clinicsTable, passwordResetTokensTable } from "@workspace/db";
import { eq, sql, and, lt } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { z } from "zod";
import { signToken, requireAuth, generateStaffCodeSync } from "../lib/auth";
import { generateOtp, otpExpiresAt, sendOtpEmail, sendWelcomeEmail, sendPasswordResetEmail } from "../lib/email";
import { isPresentationMode, isDevelopmentOtpBypassEnabled } from "../lib/config";

const router: IRouter = Router();

// POST /auth/register — creates account, sends OTP, requires email verification
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { name, email, password, role, governmentIdType, governmentIdNumber, nationality } = parsed.data;

  try {
    // ── Duplicate email check ──────────────────────────────────────────────
    const [existing] = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email));
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    // ── Duplicate government ID check ──────────────────────────────────────
    if (governmentIdNumber) {
      const [dupId] = await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(sql`government_id_number = ${governmentIdNumber}`);
      if (dupId) {
        res.status(409).json({ error: "An account with this ID number is already registered" });
        return;
      }
    }

    // ── Generate staff code ────────────────────────────────────────────────
    const roleCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(usersTable)
      .where(sql`role = ${role} AND user_type = 'staff'`);
    const count = Number(roleCount[0]?.count ?? 0) + 1;
    const staffCode = generateStaffCodeSync(role, count);

    const passwordHash = await bcrypt.hash(password, 10);
    const presentationMode = isPresentationMode();
    const devOtpBypass = isDevelopmentOtpBypassEnabled();
    if (devOtpBypass) {
      req.log.info("[DEV-AUTH] OTP bypass active");
    }

    // ── Presentation mode: activate immediately, no OTP needed ─────────────
    if (presentationMode || devOtpBypass) {
      const [newUser] = await db.insert(usersTable).values({
        name,
        email,
        passwordHash,
        role,
        userType: "staff",
        staffCode,
        governmentIdType: governmentIdType ?? null,
        governmentIdNumber: governmentIdNumber ?? null,
        nationality: nationality ?? null,
        emailVerified: true,
      }).returning();

      const token = signToken({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        userType: newUser.userType,
      });
      res.status(201).json({
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          userType: newUser.userType,
          staffCode: newUser.staffCode,
          createdAt: newUser.createdAt,
        },
      });
      return;
    }

    // ── Production mode: generate OTP and require email verification ────────
    const otp = generateOtp();
    const expiresAt = otpExpiresAt();

    await db.insert(usersTable).values({
      name,
      email,
      passwordHash,
      role,
      userType: "staff",
      staffCode,
      governmentIdType: governmentIdType ?? null,
      governmentIdNumber: governmentIdNumber ?? null,
      nationality: nationality ?? null,
      emailVerified: false,
      otpCode: otp,
      otpExpiresAt: expiresAt,
    });

    // Send OTP email — failure is logged but does not fail the request;
    // the user can request a resend.
    await sendOtpEmail(email, name, otp);

    res.status(201).json({ requiresVerification: true, email });
  } catch (err: unknown) {
    // Drizzle wraps PG errors as _DrizzleQueryError; the real PG error is on .cause
    // Check both the top-level and the cause for the unique-constraint code (23505)
    const pgErr = (err as Record<string, unknown>)?.["cause"] as Record<string, unknown> | undefined;
    const pgCode = pgErr?.["code"] ?? (err as Record<string, unknown>)?.["code"];
    const errMsg = String((err as Record<string, unknown>)?.["message"] ?? "");

    if (pgCode === "23505" || errMsg.includes("unique constraint")) {
      if (errMsg.includes("email") || errMsg.includes("users_email_unique")) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      if (errMsg.includes("government_id_number")) {
        res.status(409).json({ error: "An account with this ID number is already registered" });
        return;
      }
      res.status(409).json({ error: "Registration conflict — please check your details and try again." });
      return;
    }
    req.log.error({ err }, "Registration failed");
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Email not verified
    if (!user.emailVerified) {
      if (isPresentationMode() || isDevelopmentOtpBypassEnabled()) {
        if (isDevelopmentOtpBypassEnabled()) {
          req.log.info("[DEV-AUTH] OTP bypass active");
        }
        // Presentation mode or development bypass: auto-verify and log in immediately
        await db.update(usersTable)
          .set({ emailVerified: true, otpCode: null, otpExpiresAt: null })
          .where(eq(usersTable.id, user.id));
      } else {
        // Production: send a fresh OTP and prompt verification
        const otp = generateOtp();
        const expiresAt = otpExpiresAt();
        await db.update(usersTable)
          .set({ otpCode: otp, otpExpiresAt: expiresAt })
          .where(eq(usersTable.id, user.id));
        await sendOtpEmail(email, user.name, otp);
        res.status(403).json({ requiresVerification: true, email });
        return;
      }
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      userType: user.userType,
    });

    // Track last login time (fire-and-forget)
    db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id)).catch(() => {});

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        userType: user.userType,
        staffCode: user.staffCode,
        createdAt: user.createdAt,
      },
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// POST /auth/verify-email — validate OTP and complete account activation
router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const { email, otp } = req.body as { email?: string; otp?: string };
  if (!email || !otp) {
    res.status(400).json({ error: "Email and verification code are required" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      res.status(400).json({ error: "Invalid verification request" });
      return;
    }

    if (user.emailVerified) {
      const token = signToken({ userId: user.id, email: user.email, role: user.role, userType: user.userType });
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, userType: user.userType, staffCode: user.staffCode, createdAt: user.createdAt },
      });
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
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, userType: user.userType, staffCode: user.staffCode, createdAt: user.createdAt },
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Email verification failed");
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

// POST /auth/resend-otp — resend verification code
router.post("/auth/resend-otp", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  try {
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
  } catch (err: unknown) {
    req.log.error({ err }, "Resend OTP failed");
    res.status(500).json({ error: "Could not resend verification code. Please try again." });
  }
});

// POST /auth/logout
router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ success: true, message: "Logged out" });
});

// GET /auth/me
router.get("/auth/me", requireAuth as any, async (req, res): Promise<void> => {
  try {
    const user = (req as any).user;
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));
    if (!dbUser) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      userType: dbUser.userType,
      staffCode: dbUser.staffCode,
      governmentIdType: dbUser.governmentIdType,
      createdAt: dbUser.createdAt,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "GET /auth/me failed");
    res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

// GET /auth/me/clinic
router.get("/auth/me/clinic", requireAuth as any, async (req, res): Promise<void> => {
  try {
    const user = (req as any).user;
    const [membership] = await db
      .select({
        clinicId: clinicMembersTable.clinicId,
        clinicName: clinicsTable.name,
        clinicCode: clinicsTable.code,
        clinicType: clinicsTable.clinicType,
        billingEnabled: clinicsTable.billingEnabled,
        role: clinicMembersTable.role,
        status: clinicMembersTable.status,
      })
      .from(clinicMembersTable)
      .innerJoin(clinicsTable, eq(clinicMembersTable.clinicId, clinicsTable.id))
      .where(eq(clinicMembersTable.userId, user.userId));
    if (!membership) {
      res.status(404).json({ error: "No clinic membership found" });
      return;
    }
    res.json(membership);
  } catch (err: unknown) {
    req.log.error({ err }, "GET /auth/me/clinic failed");
    res.status(500).json({ error: "Failed to fetch clinic membership." });
  }
});

// POST /auth/forgot-password — sends a reset link; always returns success to prevent enumeration
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const ForgotPasswordBody = z.object({ email: z.string().email("A valid email address is required") });
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "A valid email address is required" });
    return;
  }
  const { email } = parsed.data;

  try {
    // Clean up expired tokens
    await db.delete(passwordResetTokensTable).where(lt(passwordResetTokensTable.expiresAt, new Date()));

    const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(and(eq(usersTable.email, email.toLowerCase().trim()), eq(usersTable.userType, "staff")));

    if (user) {
      // Invalidate any existing reset tokens for this user
      await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, user.id));

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await db.insert(passwordResetTokensTable).values({
        userId: user.id,
        token,
        expiresAt,
      });

      const domains = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
      const baseUrl = domains ? `https://${domains}` : "http://localhost:5173";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    }

    // Always return success to prevent email enumeration
    res.json({ success: true, message: "If an account with that email exists, a reset link has been sent." });
  } catch (err: unknown) {
    req.log.error({ err }, "Forgot password failed");
    res.status(500).json({ error: "Could not process password reset request. Please try again." });
  }
});

// POST /auth/reset-password — validates token and updates password
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) {
    res.status(400).json({ error: "Token and new password are required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const [resetRecord] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.token, token));

    if (!resetRecord) {
      res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
      return;
    }

    if (resetRecord.usedAt) {
      res.status(400).json({ error: "This reset link has already been used. Please request a new one." });
      return;
    }

    if (new Date() > resetRecord.expiresAt) {
      await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.id, resetRecord.id));
      res.status(400).json({ error: "This reset link has expired. Please request a new one." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.update(usersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usersTable.id, resetRecord.userId));

    // Mark token as used
    await db.update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, resetRecord.id));

    res.json({ success: true, message: "Password updated successfully. You can now sign in with your new password." });
  } catch (err: unknown) {
    req.log.error({ err }, "Reset password failed");
    res.status(500).json({ error: "Could not reset password. Please try again." });
  }
});

export default router;
