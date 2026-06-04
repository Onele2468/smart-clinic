import { db } from "@workspace/db";
import { whatsappMessagesTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import type { MetaSendResult } from "./whatsapp.meta";

export type WhatsappDeliveryStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface CreateWhatsappMessageParams {
  clinicId: string;
  patientId?: string | null;
  actionType: string;
  entityId?: string | null;
  reminderKey?: string | null;
  recipientPhone: string;
  bodyPreview: string;
  templateName?: string | null;
}

export async function hasReminderBeenSent(params: {
  clinicId: string;
  actionType: string;
  entityId: string;
  reminderKey: string;
}): Promise<boolean> {
  const [row] = await db
    .select({ id: whatsappMessagesTable.id })
    .from(whatsappMessagesTable)
    .where(
      and(
        eq(whatsappMessagesTable.clinicId, params.clinicId),
        eq(whatsappMessagesTable.actionType, params.actionType),
        eq(whatsappMessagesTable.entityId, params.entityId),
        eq(whatsappMessagesTable.reminderKey, params.reminderKey),
        sql`${whatsappMessagesTable.deliveryStatus} IN ('sent', 'delivered', 'read')`,
      ),
    )
    .limit(1);
  return !!row;
}

export async function createWhatsappMessageRecord(
  params: CreateWhatsappMessageParams,
): Promise<string> {
  const [row] = await db
    .insert(whatsappMessagesTable)
    .values({
      clinicId: params.clinicId,
      patientId: params.patientId ?? null,
      actionType: params.actionType,
      entityId: params.entityId ?? null,
      reminderKey: params.reminderKey ?? null,
      recipientPhone: params.recipientPhone,
      bodyPreview: params.bodyPreview.slice(0, 500),
      templateName: params.templateName ?? null,
      deliveryStatus: "pending",
      attemptCount: 0,
    })
    .returning({ id: whatsappMessagesTable.id });
  return row!.id;
}

export async function markWhatsappMessageSent(
  messageRecordId: string,
  meta: { metaMessageId?: string; templateName?: string },
): Promise<void> {
  await db
    .update(whatsappMessagesTable)
    .set({
      deliveryStatus: "sent",
      metaMessageId: meta.metaMessageId ?? null,
      templateName: meta.templateName ?? null,
      sentAt: new Date(),
      errorCode: null,
      errorMessage: null,
      failureType: null,
      failedAt: null,
    })
    .where(eq(whatsappMessagesTable.id, messageRecordId));
}

export async function markWhatsappMessageFailed(
  messageRecordId: string,
  params: {
    errorCode?: number;
    errorMessage?: string;
    failureType: "transient" | "permanent";
    nextRetryAt?: Date | null;
    attemptCount: number;
  },
): Promise<void> {
  await db
    .update(whatsappMessagesTable)
    .set({
      deliveryStatus: "failed",
      errorCode: params.errorCode ?? null,
      errorMessage: params.errorMessage?.slice(0, 1000) ?? null,
      failureType: params.failureType,
      nextRetryAt: params.nextRetryAt ?? null,
      attemptCount: params.attemptCount,
      failedAt: new Date(),
    })
    .where(eq(whatsappMessagesTable.id, messageRecordId));
}

export async function updateDeliveryStatusByMetaId(
  metaMessageId: string,
  status: WhatsappDeliveryStatus,
): Promise<void> {
  const patch: Record<string, unknown> = { deliveryStatus: status };
  if (status === "delivered") patch.deliveredAt = new Date();
  if (status === "read") {
    patch.readAt = new Date();
    patch.deliveredAt = patch.deliveredAt ?? new Date();
  }
  if (status === "failed") patch.failedAt = new Date();

  const updated = await db
    .update(whatsappMessagesTable)
    .set(patch)
    .where(eq(whatsappMessagesTable.metaMessageId, metaMessageId))
    .returning({ id: whatsappMessagesTable.id, clinicId: whatsappMessagesTable.clinicId });

  if (updated.length > 0) {
    logger.info(
      { metaMessageId, status, clinicId: updated[0].clinicId },
      "[whatsapp] Delivery status updated from webhook",
    );
  }
}

export function classifyFailure(result: MetaSendResult): "transient" | "permanent" {
  const code = result.errorCode;
  if (!code) return "transient";
  if ([4, 17, 32, 80007, 130429, 131000, 131016].includes(code)) return "transient";
  if ([100, 190, 131008, 131009, 131030, 133010].includes(code)) return "permanent";
  return "transient";
}

export function computeNextRetry(attemptCount: number): Date {
  const minutes = Math.min(60, 2 ** attemptCount * 5);
  return new Date(Date.now() + minutes * 60 * 1000);
}
