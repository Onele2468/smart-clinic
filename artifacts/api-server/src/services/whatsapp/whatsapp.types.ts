/** Supported WhatsApp providers (Meta implemented; others reserved). */
export type WhatsAppProvider = "meta" | "twilio" | "360dialog";

/** Activity log action types that trigger patient WhatsApp messages. */
export type WhatsAppTriggerAction =
  | "appointment_booked"
  | "appointment_cancelled"
  | "lab_request_created"
  | "lab_result_submitted"
  | "prescription_created"
  | "dispense"
  | "invoice_created"
  | "payment_recorded"
  | "patient_added"
  | "nurse_assessment_completed"
  | "consultation_completed"
  | "appointment_checked_in"
  | "queue_check_in"
  | "appointment_reminder"
  | "follow_up_reminder";

export const WHATSAPP_TRIGGER_ACTIONS: ReadonlySet<WhatsAppTriggerAction> = new Set([
  "appointment_booked",
  "appointment_cancelled",
  "lab_request_created",
  "lab_result_submitted",
  "prescription_created",
  "dispense",
  "invoice_created",
  "payment_recorded",
  "patient_added",
  "nurse_assessment_completed",
  "consultation_completed",
  "appointment_checked_in",
  "queue_check_in",
  "appointment_reminder",
  "follow_up_reminder",
]);

export type WhatsAppMessagingMode = "text" | "template" | "auto";

export type { OperationalAlertAction } from "./operationalAlerts.types";
export {
  OPERATIONAL_ALERT_ACTIONS,
  OPERATIONAL_ALERT_CONFIG_KEY,
  type OperationalAlertsConfig,
  DEFAULT_OPERATIONAL_ALERTS_CONFIG,
  parseOperationalAlertsConfig,
} from "./operationalAlerts.types";

import type { OperationalAlertAction } from "./operationalAlerts.types";
import { OPERATIONAL_ALERT_ACTIONS } from "./operationalAlerts.types";

/** All action types that may trigger a WhatsApp message (patient or operational). */
export type WhatsAppDispatchAction = WhatsAppTriggerAction | OperationalAlertAction;

export function isWhatsAppDispatchAction(actionType: string): actionType is WhatsAppDispatchAction {
  return (
    WHATSAPP_TRIGGER_ACTIONS.has(actionType as WhatsAppTriggerAction) ||
    OPERATIONAL_ALERT_ACTIONS.has(actionType as OperationalAlertAction)
  );
}

export function isOperationalAlertAction(actionType: string): actionType is OperationalAlertAction {
  return OPERATIONAL_ALERT_ACTIONS.has(actionType as OperationalAlertAction);
}

export interface ClinicWhatsAppConfig {
  clinicId: string;
  enabled: boolean;
  provider: WhatsAppProvider;
  accessToken: string | null;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  messagingMode: WhatsAppMessagingMode;
  outboundTemplate: string | null;
}

export interface WhatsAppTemplateContext {
  patientName?: string;
  doctorName?: string;
  appointmentDate?: string;
  amount?: string;
}

export interface WhatsAppDispatchPayload {
  clinicId: string;
  actionType: WhatsAppDispatchAction;
  entityId?: string | null;
  message?: string;
  /** Deduplicates scheduled reminders (e.g. "24h", "7d"). */
  reminderKey?: string | null;
  patientId?: string | null;
}

export interface SendWhatsAppMessageParams {
  config: ClinicWhatsAppConfig;
  toPhone: string;
  body: string;
}
