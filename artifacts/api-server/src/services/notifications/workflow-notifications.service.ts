import { db, clinicMembersTable, notificationsTable, queueAuditLogsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { isNotificationEnabled, type NotificationPreferenceKey } from "./notification-preferences.service";

type StaffRole = "clinic_admin" | "doctor" | "nurse" | "receptionist" | "pharmacist" | "lab_technician" | "cashier";

export async function notifyStaffWorkflow(params: {
  clinicId: string;
  roles?: StaffRole[];
  userIds?: string[];
  preferenceKey?: NotificationPreferenceKey;
  type: string;
  title: string;
  message: string;
  entityId?: string | null;
  targetUrl?: string | null;
}): Promise<void> {
  if (params.preferenceKey && !(await isNotificationEnabled(params.clinicId, params.preferenceKey))) {
    return;
  }

  const recipients = new Set(params.userIds?.filter(Boolean) ?? []);
  if (params.roles?.length) {
    const rows = await db
      .select({ userId: clinicMembersTable.userId })
      .from(clinicMembersTable)
      .where(
        and(
          eq(clinicMembersTable.clinicId, params.clinicId),
          eq(clinicMembersTable.status, "active"),
          inArray(clinicMembersTable.role, params.roles),
        ),
      );
    for (const row of rows) recipients.add(row.userId);
  }

  if (recipients.size === 0) return;

  await db.insert(notificationsTable).values(
    [...recipients].map((userId) => ({
      clinicId: params.clinicId,
      userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entityId: params.entityId ?? null,
      targetUrl: params.targetUrl ?? null,
      isRead: false,
    })),
  );
}

export async function logQueueAudit(params: {
  clinicId: string;
  patientId: string;
  appointmentId?: string | null;
  staffId?: string | null;
  oldStatus?: string | null;
  newStatus?: string | null;
  notes: string;
}): Promise<void> {
  await db.insert(queueAuditLogsTable).values({
    clinicId: params.clinicId,
    patientId: params.patientId,
    appointmentId: params.appointmentId ?? null,
    staffId: params.staffId ?? null,
    oldStatus: params.oldStatus ?? null,
    newStatus: params.newStatus ?? null,
    notes: params.notes,
  });
}
