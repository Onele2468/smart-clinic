import { db } from "@workspace/db";
import { clinicMembersTable, notificationsTable, whatsappMessagesTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

/** Fan-out in-app alert to clinic admins when WhatsApp delivery permanently fails. */
export async function notifyWhatsappDeliveryFailure(
  clinicId: string,
  actionType: string,
  errorMessage: string,
): Promise<void> {
  try {
    const admins = await db
      .select({ userId: clinicMembersTable.userId })
      .from(clinicMembersTable)
      .where(
        and(
          eq(clinicMembersTable.clinicId, clinicId),
          eq(clinicMembersTable.role, "clinic_admin"),
          eq(clinicMembersTable.status, "active"),
        ),
      );

    if (admins.length === 0) return;

    const message = `WhatsApp delivery failed for ${actionType}: ${errorMessage.slice(0, 200)}`;
    await db.insert(notificationsTable).values(
      admins.map((admin) => ({
        clinicId,
        userId: admin.userId,
        type: "whatsapp_failure",
        title: "WhatsApp Delivery Failed",
        message,
        isRead: false,
      })),
    );

    logger.warn({ clinicId, actionType }, "[whatsapp] Admin notified of delivery failure");
  } catch (err) {
    logger.error({ err, clinicId, actionType }, "[whatsapp] Failed to notify admins of delivery failure");
  }
}

export async function getFailedWhatsappMessages(clinicId: string, limit = 50) {
  return db
    .select({
      id: whatsappMessagesTable.id,
      actionType: whatsappMessagesTable.actionType,
      entityId: whatsappMessagesTable.entityId,
      recipientPhone: whatsappMessagesTable.recipientPhone,
      deliveryStatus: whatsappMessagesTable.deliveryStatus,
      failureType: whatsappMessagesTable.failureType,
      errorCode: whatsappMessagesTable.errorCode,
      errorMessage: whatsappMessagesTable.errorMessage,
      attemptCount: whatsappMessagesTable.attemptCount,
      metaMessageId: whatsappMessagesTable.metaMessageId,
      createdAt: whatsappMessagesTable.createdAt,
      failedAt: whatsappMessagesTable.failedAt,
    })
    .from(whatsappMessagesTable)
    .where(
      and(
        eq(whatsappMessagesTable.clinicId, clinicId),
        sql`${whatsappMessagesTable.deliveryStatus} = 'failed'`,
      ),
    )
    .orderBy(desc(whatsappMessagesTable.failedAt))
    .limit(limit);
}

export async function getWhatsappDeliverySummary(clinicId: string) {
  const [row] = await db
    .select({
      sent: sql<number>`count(*) filter (where ${whatsappMessagesTable.deliveryStatus} = 'sent')`,
      delivered: sql<number>`count(*) filter (where ${whatsappMessagesTable.deliveryStatus} = 'delivered')`,
      read: sql<number>`count(*) filter (where ${whatsappMessagesTable.deliveryStatus} = 'read')`,
      failed: sql<number>`count(*) filter (where ${whatsappMessagesTable.deliveryStatus} = 'failed')`,
      pending: sql<number>`count(*) filter (where ${whatsappMessagesTable.deliveryStatus} = 'pending')`,
    })
    .from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.clinicId, clinicId));

  return {
    sent: Number(row?.sent ?? 0),
    delivered: Number(row?.delivered ?? 0),
    read: Number(row?.read ?? 0),
    failed: Number(row?.failed ?? 0),
    pending: Number(row?.pending ?? 0),
  };
}
