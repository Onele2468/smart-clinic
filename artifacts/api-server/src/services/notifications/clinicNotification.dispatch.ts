import { db } from "@workspace/db";
import { clinicMembersTable, notificationsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getClinicNotificationMeta } from "./clinicNotification.registry";

export interface DispatchClinicNotificationParams {
  clinicId: string;
  actionType: string;
  message: string;
}

/**
 * Fan-out in-app notifications to active clinic admins when a registered clinic event fires.
 * Invoked from activityLogger after a successful activity_logs insert.
 * Fail-safe: errors are swallowed so core workflows continue.
 */
export function dispatchClinicNotifications(params: DispatchClinicNotificationParams): void {
  const meta = getClinicNotificationMeta(params.actionType);
  if (!meta) return;

  void (async () => {
    try {
      const admins = await db
        .select({ userId: clinicMembersTable.userId })
        .from(clinicMembersTable)
        .where(
          and(
            eq(clinicMembersTable.clinicId, params.clinicId),
            eq(clinicMembersTable.role, "clinic_admin"),
            eq(clinicMembersTable.status, "active"),
          ),
        );

      if (admins.length === 0) return;

      await db.insert(notificationsTable).values(
        admins.map((admin) => ({
          clinicId: params.clinicId,
          userId: admin.userId,
          type: meta.type,
          title: meta.title,
          message: params.message,
          isRead: false,
        })),
      );
    } catch {
      // Never impact the caller
    }
  })();
}
