/**
 * Email service via RESEND_API_KEY.
 * Falls back gracefully when not configured: OTP is logged to console for dev.
 */
import { Resend } from "resend";
import { logger } from "./logger";

const APP_NAME = "Smart Clinic";
const DEFAULT_FROM = `${APP_NAME} <onboarding@resend.dev>`;

function getCredentials(): { apiKey: string; fromEmail: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    fromEmail: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
  };
}

function otpEmailHtml(otp: string, userName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email — ${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#2563eb;padding:28px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${APP_NAME}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;">Verify your email address</h1>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Hi ${userName}, thanks for signing up! Enter the 6-digit code below to verify your email address and activate your account.
              </p>
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;">Your verification code</p>
                <div style="font-size:42px;font-weight:700;letter-spacing:14px;color:#2563eb;font-family:'Courier New',monospace;">${otp}</div>
                <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">This code expires in <strong>10 minutes</strong></p>
              </div>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you didn't create a ${APP_NAME} account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:18px 40px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function welcomeEmailHtml(userName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#2563eb;padding:28px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;">${APP_NAME}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#111827;">Welcome to ${APP_NAME}, ${userName}!</h1>
              <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
                Your email has been verified and your account is now fully active. You have complete access to all ${APP_NAME} features.
              </p>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you have any questions, please contact your clinic administrator.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:18px 40px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOtpEmail(to: string, userName: string, otp: string): Promise<boolean> {
  const creds = getCredentials();

  if (!creds) {
    // Dev / unconfigured mode — log OTP so development still works
    logger.warn({ email: to }, "RESEND_API_KEY not set — OTP email not sent");
    logger.info({ otp, email: to }, "DEV MODE: OTP code (email not sent)");
    return true;
  }

  try {
    const resend = new Resend(creds.apiKey);
    const { error } = await resend.emails.send({
      from: creds.fromEmail,
      to: [to],
      subject: `${otp} — your ${APP_NAME} verification code`,
      html: otpEmailHtml(otp, userName),
    });

    if (error) {
      logger.error({ error, email: to }, "Resend: failed to send OTP email");
      return false;
    }

    logger.info({ email: to }, "OTP email sent successfully");
    return true;
  } catch (err) {
    logger.error({ err, email: to }, "Resend: unexpected error sending OTP email");
    return false;
  }
}

export async function sendWelcomeEmail(to: string, userName: string): Promise<void> {
  const creds = getCredentials();
  if (!creds) return; // silently skip in dev mode

  try {
    const resend = new Resend(creds.apiKey);
    const { error } = await resend.emails.send({
      from: creds.fromEmail,
      to: [to],
      subject: `Welcome to ${APP_NAME}!`,
      html: welcomeEmailHtml(userName),
    });

    if (error) {
      logger.error({ error, email: to }, "Resend: failed to send welcome email");
      return;
    }

    logger.info({ email: to }, "Welcome email sent successfully");
  } catch (err) {
    logger.error({ err, email: to }, "Resend: unexpected error sending welcome email");
  }
}

function passwordResetEmailHtml(resetUrl: string, userName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password — ${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#2563eb;padding:28px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${APP_NAME}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;">Reset your password</h1>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Hi ${userName}, we received a request to reset your password. Click the button below to choose a new password. This link expires in <strong>30 minutes</strong>.
              </p>
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;padding:14px 32px;">Reset Password</a>
              </div>
              <p style="margin:0 0 12px;font-size:13px;color:#9ca3af;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 20px;font-size:12px;color:#6b7280;word-break:break-all;">${resetUrl}</p>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:18px 40px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(to: string, userName: string, resetUrl: string): Promise<boolean> {
  const creds = getCredentials();

  if (!creds) {
    logger.warn({ email: to }, "RESEND_API_KEY not set — password reset email not sent");
    logger.info({ resetUrl, email: to }, "DEV MODE: password reset URL (email not sent)");
    return true;
  }

  try {
    const resend = new Resend(creds.apiKey);
    const { error } = await resend.emails.send({
      from: creds.fromEmail,
      to: [to],
      subject: `Reset your ${APP_NAME} password`,
      html: passwordResetEmailHtml(resetUrl, userName),
    });

    if (error) {
      logger.error({ error, email: to }, "Resend: failed to send password reset email");
      return false;
    }

    logger.info({ email: to }, "Password reset email sent successfully");
    return true;
  } catch (err) {
    logger.error({ err, email: to }, "Resend: unexpected error sending password reset email");
    return false;
  }
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function otpExpiresAt(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 10);
  return d;
}
