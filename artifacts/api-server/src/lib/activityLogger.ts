import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db";
import { logger } from "./logger";
import { dispatchClinicNotifications, dispatchClinicNotificationsAsync } from "../services/notifications/clinicNotification.dispatch";
import { getClinicNotificationMeta } from "../services/notifications/clinicNotification.registry";
import { dispatchWhatsAppNotification } from "../services/whatsapp/whatsapp.service";
import { isWhatsAppDispatchAction } from "../services/whatsapp/whatsapp.types";

export interface LogActivityParams {
  clinicId: string;
  userId?: string | null;
  userRole?: string | null;
  module?: string | null;
  actionType?: string | null;
  type: string;
  message: string;
  entityId?: string | null;
  suppressWhatsAppDispatch?: boolean;
}

export async function logActivityAsync(params: LogActivityParams): Promise<void> {
  const actionType = params.actionType ?? null;

  await db.insert(activityLogsTable).values({
    clinicId: params.clinicId,
    userId: params.userId ?? null,
    userRole: params.userRole ?? null,
    module: params.module ?? null,
    actionType,
    type: params.type,
    message: params.message,
    entityId: params.entityId ?? null,
  });

  if (actionType && getClinicNotificationMeta(actionType)) {
    await dispatchClinicNotificationsAsync({
      clinicId: params.clinicId,
      actionType,
      message: params.message,
    });
  }

  if (!params.suppressWhatsAppDispatch && actionType && isWhatsAppDispatchAction(actionType)) {
    logger.info(
      {
        clinicId: params.clinicId,
        actionType,
        entityId: params.entityId ?? null,
        module: params.module ?? null,
      },
      "[activity] Triggering WhatsApp dispatch",
    );
    await dispatchWhatsAppNotification({
      clinicId: params.clinicId,
      actionType,
      entityId: params.entityId,
      message: params.message,
    });
  }
}

/**
 * Fire-and-forget activity logger.
 * Failures are swallowed so they never impact the request response.
 * After a successful insert:
 * - dispatches in-app clinic notifications for registered action types
 * - dispatches WhatsApp for supported action types
 */
export function logActivity(params: LogActivityParams): void {
  const actionType = params.actionType ?? null;

  db.insert(activityLogsTable)
    .values({
      clinicId: params.clinicId,
      userId: params.userId ?? null,
      userRole: params.userRole ?? null,
      module: params.module ?? null,
      actionType,
      type: params.type,
      message: params.message,
      entityId: params.entityId ?? null,
    })
    .then(() => {
      if (actionType && getClinicNotificationMeta(actionType)) {
        dispatchClinicNotifications({
          clinicId: params.clinicId,
          actionType,
          message: params.message,
        });
      }

      if (!params.suppressWhatsAppDispatch && actionType && isWhatsAppDispatchAction(actionType)) {
        logger.info(
          {
            clinicId: params.clinicId,
            actionType,
            entityId: params.entityId ?? null,
            module: params.module ?? null,
          },
          "[activity] Triggering WhatsApp dispatch",
        );
        dispatchWhatsAppNotification({
          clinicId: params.clinicId,
          actionType,
          entityId: params.entityId,
          message: params.message,
        });
      } else if (actionType) {
        logger.debug(
          { clinicId: params.clinicId, actionType },
          "[activity] No WhatsApp trigger for action type",
        );
      } else {
        logger.debug(
          { clinicId: params.clinicId, type: params.type },
          "[activity] Logged without actionType — WhatsApp not eligible",
        );
      }
    })
    .catch((err) => {
      logger.error(
        {
          err,
          clinicId: params.clinicId,
          actionType,
          type: params.type,
          module: params.module,
        },
        "[activity] Failed to insert activity log — notifications skipped",
      );
    });
}
