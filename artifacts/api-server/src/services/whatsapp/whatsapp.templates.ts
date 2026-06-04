import type { WhatsAppTemplateContext, WhatsAppTriggerAction } from "./whatsapp.types";
import type { OperationalAlertAction } from "./operationalAlerts.types";

const PATIENT_DEFAULTS: Record<WhatsAppTriggerAction, string> = {
  appointment_booked:
    "Hello {patientName}. Your appointment with Dr {doctorName} has been booked for {date}.",
  appointment_cancelled:
    "Your appointment has been cancelled. Please contact the clinic.",
  lab_request_created: "Your laboratory test has been requested.",
  lab_result_submitted: "Your laboratory results are ready.",
  prescription_created: "Your prescription has been issued.",
  dispense: "Your medication is ready for collection.",
  invoice_created: "An invoice of {amount} has been generated.",
  payment_recorded: "Payment received. Thank you.",
  patient_added: "Welcome to Smart Clinic.",
  nurse_assessment_completed:
    "Hello {patientName}. Your nurse triage assessment at the clinic is complete. Please proceed as directed by staff.",
  consultation_completed:
    "Hello {patientName}. Your doctor consultation is complete. Please follow any instructions given by your doctor.",
  appointment_checked_in:
    "Hello {patientName}. You have been checked in for your appointment. Please wait to be called.",
  queue_check_in:
    "Hello {patientName}. You have been checked in at the clinic. Your queue ticket is being processed.",
  appointment_reminder:
    "Reminder: Hello {patientName}, you have an appointment with Dr {doctorName} on {date}.",
  follow_up_reminder:
    "Hello {patientName}. This is a follow-up reminder from your clinic. Please book a follow-up visit if you have not already.",
};

const OPERATIONAL_DEFAULTS: Record<OperationalAlertAction, string> = {
  op_alert_patient_registered: "Operational alert: A new patient has been registered at your clinic.",
  op_alert_queue_threshold: "Operational alert: The patient queue has exceeded the configured threshold.",
  op_alert_low_inventory: "Operational alert: An inventory item is below minimum stock level.",
  op_alert_out_of_stock: "Operational alert: An inventory item is out of stock.",
  op_alert_lab_request: "Operational alert: A new laboratory request has been created.",
  op_alert_unpaid_invoices: "Operational alert: Unpaid invoices have exceeded the configured threshold.",
  op_alert_staff_join_request: "Operational alert: A new staff join request is pending review.",
  op_alert_high_patient_volume: "Operational alert: Today's patient volume has exceeded the configured threshold.",
};

function fill(template: string, ctx: WhatsAppTemplateContext): string {
  return template
    .replace(/\{patientName\}/g, ctx.patientName ?? "Patient")
    .replace(/\{doctorName\}/g, ctx.doctorName ?? "your doctor")
    .replace(/\{date\}/g, ctx.appointmentDate ?? "the scheduled time")
    .replace(/\{amount\}/g, ctx.amount ?? "the clinic");
}

export function buildWhatsAppMessage(
  actionType: WhatsAppTriggerAction,
  ctx: WhatsAppTemplateContext,
): string {
  return fill(PATIENT_DEFAULTS[actionType], ctx);
}

export function buildOperationalAlertMessage(
  actionType: OperationalAlertAction,
  activityMessage?: string,
): string {
  const prefix = OPERATIONAL_DEFAULTS[actionType];
  if (activityMessage?.trim()) {
    return `${prefix}\n\n${activityMessage.trim()}`;
  }
  return prefix;
}
