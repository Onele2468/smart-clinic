import { db, notificationPreferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const NOTIFICATION_PREFERENCE_KEYS = [
  "appointmentBooked",
  "appointmentReminder",
  "appointmentCheckedIn",
  "nurseAssessmentComplete",
  "labRequested",
  "labResultReady",
  "prescriptionIssued",
  "medicationReady",
  "visitCompleted",
] as const;

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number];
export type NotificationPreferenceSettings = Record<NotificationPreferenceKey, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceSettings = {
  appointmentBooked: true,
  appointmentReminder: true,
  appointmentCheckedIn: true,
  nurseAssessmentComplete: true,
  labRequested: true,
  labResultReady: true,
  prescriptionIssued: true,
  medicationReady: true,
  visitCompleted: true,
};

const ACTION_TO_PREFERENCE: Record<string, NotificationPreferenceKey> = {
  appointment_booked: "appointmentBooked",
  appointment_reminder: "appointmentReminder",
  appointment_checked_in: "appointmentCheckedIn",
  nurse_assessment_completed: "nurseAssessmentComplete",
  nurse_assessment_complete: "nurseAssessmentComplete",
  lab_request_created: "labRequested",
  lab_requested: "labRequested",
  lab_result_submitted: "labResultReady",
  lab_result_ready: "labResultReady",
  prescription_created: "prescriptionIssued",
  prescription_issued: "prescriptionIssued",
  medication_ready: "medicationReady",
  dispense: "medicationReady",
  medication_dispensed: "medicationReady",
  visit_completed: "visitCompleted",
  queue_completed: "visitCompleted",
  consultation_completed: "visitCompleted",
};

function normalize(row: Partial<Record<NotificationPreferenceKey, boolean | null>> | undefined): NotificationPreferenceSettings {
  return {
    appointmentBooked: row?.appointmentBooked ?? DEFAULT_NOTIFICATION_PREFERENCES.appointmentBooked,
    appointmentReminder: row?.appointmentReminder ?? DEFAULT_NOTIFICATION_PREFERENCES.appointmentReminder,
    appointmentCheckedIn: row?.appointmentCheckedIn ?? DEFAULT_NOTIFICATION_PREFERENCES.appointmentCheckedIn,
    nurseAssessmentComplete: row?.nurseAssessmentComplete ?? DEFAULT_NOTIFICATION_PREFERENCES.nurseAssessmentComplete,
    labRequested: row?.labRequested ?? DEFAULT_NOTIFICATION_PREFERENCES.labRequested,
    labResultReady: row?.labResultReady ?? DEFAULT_NOTIFICATION_PREFERENCES.labResultReady,
    prescriptionIssued: row?.prescriptionIssued ?? DEFAULT_NOTIFICATION_PREFERENCES.prescriptionIssued,
    medicationReady: row?.medicationReady ?? DEFAULT_NOTIFICATION_PREFERENCES.medicationReady,
    visitCompleted: row?.visitCompleted ?? DEFAULT_NOTIFICATION_PREFERENCES.visitCompleted,
  };
}

export function preferenceKeyForAction(actionType: string | null | undefined): NotificationPreferenceKey | null {
  if (!actionType) return null;
  return ACTION_TO_PREFERENCE[actionType] ?? null;
}

export async function getNotificationPreferences(clinicId: string): Promise<NotificationPreferenceSettings> {
  const [row] = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.clinicId, clinicId))
    .limit(1);
  return normalize(row);
}

export async function updateNotificationPreferences(
  clinicId: string,
  data: Partial<NotificationPreferenceSettings>,
): Promise<NotificationPreferenceSettings> {
  const updateData: Partial<typeof notificationPreferencesTable.$inferInsert> = { updatedAt: new Date() };
  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }

  const [existing] = await db
    .select({ id: notificationPreferencesTable.id })
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.clinicId, clinicId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(notificationPreferencesTable)
      .set(updateData)
      .where(eq(notificationPreferencesTable.clinicId, clinicId))
      .returning();
    return normalize(updated);
  }

  const [created] = await db
    .insert(notificationPreferencesTable)
    .values({ clinicId, ...DEFAULT_NOTIFICATION_PREFERENCES, ...data })
    .returning();
  return normalize(created);
}

export async function isNotificationEnabled(
  clinicId: string,
  keyOrAction: NotificationPreferenceKey | string | null | undefined,
): Promise<boolean> {
  const key = NOTIFICATION_PREFERENCE_KEYS.includes(keyOrAction as NotificationPreferenceKey)
    ? (keyOrAction as NotificationPreferenceKey)
    : preferenceKeyForAction(keyOrAction);
  if (!key) return true;
  const preferences = await getNotificationPreferences(clinicId);
  return preferences[key];
}
