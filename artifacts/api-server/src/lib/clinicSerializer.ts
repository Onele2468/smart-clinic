import type { Clinic } from "@workspace/db";

/** Credential fields — only readable/writable via `/whatsapp/settings` (clinic_admin). */
export const WHATSAPP_SECRET_KEYS = [
  "whatsappAccessToken",
  "whatsappPhoneNumberId",
  "whatsappBusinessAccountId",
] as const;

/** WhatsApp config must not be changed through generic clinic create/update routes. */
export const WHATSAPP_BLOCKED_UPDATE_KEYS = [
  ...WHATSAPP_SECRET_KEYS,
  "whatsappEnabled",
  "whatsappProvider",
  "whatsappMessagingMode",
  "whatsappOutboundTemplate",
  "whatsappTemplatesConfig",
  "whatsappReminderConfig",
  "operationalAlertsConfig",
] as const;

export type PublicClinic = Omit<Clinic, (typeof WHATSAPP_SECRET_KEYS)[number]>;

export function maskWhatsappToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 8) return "••••••••";
  return `${"•".repeat(Math.min(token.length - 4, 12))}${token.slice(-4)}`;
}

/**
 * Remove WhatsApp fields from clinic write payloads (defense in depth beside Zod schemas).
 */
export function stripWhatsappFieldsFromUpdate<T extends object>(data: T): T {
  const sanitized = { ...data } as Record<string, unknown>;
  for (const key of WHATSAPP_BLOCKED_UPDATE_KEYS) {
    delete sanitized[key];
  }
  return sanitized as T;
}

/**
 * Strip WhatsApp credentials from clinic rows returned by general read/update endpoints.
 */
export function toPublicClinic(clinic: Clinic): PublicClinic {
  const publicClinic = { ...clinic } as Record<string, unknown>;
  for (const key of WHATSAPP_SECRET_KEYS) {
    delete publicClinic[key];
  }
  return publicClinic as PublicClinic;
}

export interface WhatsAppSettingsResponse {
  whatsappEnabled: boolean;
  whatsappProvider: string;
  whatsappPhoneNumberId: string;
  whatsappBusinessAccountId: string;
  whatsappAccessTokenMasked: string | null;
  hasAccessToken: boolean;
  whatsappMessagingMode: string;
  whatsappOutboundTemplate: string | null;
}

/** Admin-only WhatsApp settings payload (masked token, no raw access token). */
export function toWhatsAppSettingsResponse(clinic: {
  whatsappEnabled: boolean;
  whatsappProvider: string | null;
  whatsappAccessToken: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  whatsappMessagingMode?: string | null;
  whatsappOutboundTemplate?: string | null;
}): WhatsAppSettingsResponse {
  return {
    whatsappEnabled: clinic.whatsappEnabled,
    whatsappProvider: clinic.whatsappProvider ?? "meta",
    whatsappPhoneNumberId: clinic.whatsappPhoneNumberId ?? "",
    whatsappBusinessAccountId: clinic.whatsappBusinessAccountId ?? "",
    whatsappAccessTokenMasked: maskWhatsappToken(clinic.whatsappAccessToken),
    hasAccessToken: !!clinic.whatsappAccessToken,
    whatsappMessagingMode: clinic.whatsappMessagingMode ?? "auto",
    whatsappOutboundTemplate: clinic.whatsappOutboundTemplate ?? null,
  };
}
