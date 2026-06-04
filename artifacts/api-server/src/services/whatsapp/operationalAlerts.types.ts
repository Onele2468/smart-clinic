/** Per-alert toggle; threshold-bearing alerts include `threshold`. */
export interface OperationalAlertToggle {
  enabled: boolean;
  threshold?: number;
}

/** Clinic-scoped operational alert configuration stored on `clinics.operational_alerts_config`. */
export interface OperationalAlertsConfig {
  enabled: boolean;
  recipientPhone: string | null;
  patientRegistered: OperationalAlertToggle;
  queueThreshold: OperationalAlertToggle;
  lowInventory: OperationalAlertToggle;
  labRequestCreated: OperationalAlertToggle;
  unpaidInvoices: OperationalAlertToggle;
  staffJoinRequest: OperationalAlertToggle;
  highPatientVolume: OperationalAlertToggle;
}

export const DEFAULT_OPERATIONAL_ALERTS_CONFIG: OperationalAlertsConfig = {
  enabled: false,
  recipientPhone: null,
  patientRegistered: { enabled: true },
  queueThreshold: { enabled: true, threshold: 10 },
  lowInventory: { enabled: true },
  labRequestCreated: { enabled: true },
  unpaidInvoices: { enabled: true, threshold: 5 },
  staffJoinRequest: { enabled: true },
  highPatientVolume: { enabled: true, threshold: 50 },
};

/** Activity log action types for clinic operational WhatsApp alerts. */
export type OperationalAlertAction =
  | "op_alert_patient_registered"
  | "op_alert_queue_threshold"
  | "op_alert_low_inventory"
  | "op_alert_out_of_stock"
  | "op_alert_lab_request"
  | "op_alert_unpaid_invoices"
  | "op_alert_staff_join_request"
  | "op_alert_high_patient_volume";

export const OPERATIONAL_ALERT_ACTIONS: ReadonlySet<OperationalAlertAction> = new Set([
  "op_alert_patient_registered",
  "op_alert_queue_threshold",
  "op_alert_low_inventory",
  "op_alert_out_of_stock",
  "op_alert_lab_request",
  "op_alert_unpaid_invoices",
  "op_alert_staff_join_request",
  "op_alert_high_patient_volume",
]);

/** Maps operational alert action to its config key. */
export const OPERATIONAL_ALERT_CONFIG_KEY: Record<
  OperationalAlertAction,
  keyof Omit<OperationalAlertsConfig, "enabled" | "recipientPhone">
> = {
  op_alert_patient_registered: "patientRegistered",
  op_alert_queue_threshold: "queueThreshold",
  op_alert_low_inventory: "lowInventory",
  op_alert_out_of_stock: "lowInventory",
  op_alert_lab_request: "labRequestCreated",
  op_alert_unpaid_invoices: "unpaidInvoices",
  op_alert_staff_join_request: "staffJoinRequest",
  op_alert_high_patient_volume: "highPatientVolume",
};

export function parseOperationalAlertsConfig(raw: unknown): OperationalAlertsConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_OPERATIONAL_ALERTS_CONFIG };
  }
  const src = raw as Partial<OperationalAlertsConfig>;
  const mergeToggle = (
    defaults: OperationalAlertToggle,
    incoming?: Partial<OperationalAlertToggle>,
  ): OperationalAlertToggle => ({
    enabled: incoming?.enabled ?? defaults.enabled,
    threshold: incoming?.threshold ?? defaults.threshold,
  });

  return {
    enabled: src.enabled ?? DEFAULT_OPERATIONAL_ALERTS_CONFIG.enabled,
    recipientPhone: src.recipientPhone ?? DEFAULT_OPERATIONAL_ALERTS_CONFIG.recipientPhone,
    patientRegistered: mergeToggle(
      DEFAULT_OPERATIONAL_ALERTS_CONFIG.patientRegistered,
      src.patientRegistered,
    ),
    queueThreshold: mergeToggle(
      DEFAULT_OPERATIONAL_ALERTS_CONFIG.queueThreshold,
      src.queueThreshold,
    ),
    lowInventory: mergeToggle(
      DEFAULT_OPERATIONAL_ALERTS_CONFIG.lowInventory,
      src.lowInventory,
    ),
    labRequestCreated: mergeToggle(
      DEFAULT_OPERATIONAL_ALERTS_CONFIG.labRequestCreated,
      src.labRequestCreated,
    ),
    unpaidInvoices: mergeToggle(
      DEFAULT_OPERATIONAL_ALERTS_CONFIG.unpaidInvoices,
      src.unpaidInvoices,
    ),
    staffJoinRequest: mergeToggle(
      DEFAULT_OPERATIONAL_ALERTS_CONFIG.staffJoinRequest,
      src.staffJoinRequest,
    ),
    highPatientVolume: mergeToggle(
      DEFAULT_OPERATIONAL_ALERTS_CONFIG.highPatientVolume,
      src.highPatientVolume,
    ),
  };
}
