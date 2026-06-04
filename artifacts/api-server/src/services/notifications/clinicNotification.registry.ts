import type { OperationalAlertAction } from "../whatsapp/operationalAlerts.types";

/** In-app notification metadata for a clinic activity action. */
export interface ClinicNotificationMeta {
  type: string;
  title: string;
}

/**
 * Registry of activity action types that fan out in-app notifications to clinic admins.
 * Single source of truth — routes must not hardcode notification inserts.
 */
export const CLINIC_NOTIFICATION_REGISTRY: Record<string, ClinicNotificationMeta> = {
  // Operational alerts (also drive WhatsApp via activityLogger)
  op_alert_patient_registered: { type: "patient_registered", title: "New Patient Registered" },
  op_alert_queue_threshold: { type: "queue_threshold", title: "Queue Threshold Exceeded" },
  op_alert_low_inventory: { type: "low_inventory", title: "Low Stock Alert" },
  op_alert_out_of_stock: { type: "out_of_stock", title: "Out of Stock Alert" },
  op_alert_lab_request: { type: "lab_request", title: "New Lab Request" },
  op_alert_unpaid_invoices: { type: "payment", title: "Unpaid Invoices Alert" },
  op_alert_staff_join_request: { type: "staff_join_request", title: "Staff Join Request" },
  op_alert_high_patient_volume: { type: "high_patient_volume", title: "High Patient Volume" },

  // Staff management
  join_approved: { type: "staff_approved", title: "Staff Request Approved" },
  join_rejected: { type: "staff_rejected", title: "Staff Request Rejected" },

  // Appointments
  appointment_booked: { type: "appointment", title: "Appointment Created" },
  appointment_cancelled: { type: "appointment", title: "Appointment Cancelled" },

  // Billing
invoice_created: {
  type: "billing",
  title: "Invoice Created",
},
invoice_paid: {
  type: "billing",
  title: "Invoice Paid",
},
payment_received: {
  type: "billing",
  title: "Payment Received",
},
payment_recorded: {
  type: "billing",
  title: "Payment Received",
},

  // Inventory / suppliers
  supplier_restock: { type: "supplier_delivery", title: "Supplier Stock Delivery" },
};

export function getClinicNotificationMeta(actionType: string | null | undefined): ClinicNotificationMeta | null {
  if (!actionType) return null;
  return CLINIC_NOTIFICATION_REGISTRY[actionType] ?? null;
}

export function isOperationalAlertNotificationAction(
  actionType: string,
): actionType is OperationalAlertAction {
  return actionType.startsWith("op_alert_");
}
