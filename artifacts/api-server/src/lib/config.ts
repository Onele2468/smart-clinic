/**
 * Runtime configuration flags.
 * Set PRESENTATION_MODE=true in environment variables to bypass email.
 * verification during demos and presentations. All other security (JWT,
 * passwords, roles, rate limiting, multi-tenancy) remains fully enforced.
 */

export function isPresentationMode(): boolean {
  return process.env.PRESENTATION_MODE === "true";
}

export function isDevelopmentOtpBypassEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}
