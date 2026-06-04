import { db } from "@workspace/db";
import { whatsappMessagesTable } from "@workspace/db";
import { and, eq, lte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import {
  classifyFailure,
  computeNextRetry,
  markWhatsappMessageFailed,
  markWhatsappMessageSent,
} from "./whatsapp.delivery";
import { getClinicWhatsAppConfig, deliverPatientWhatsAppMessage } from "./whatsapp.service";
import { resolveTemplateNameForAction } from "./whatsapp.templates.config";
import { notifyWhatsappDeliveryFailure } from "./whatsapp.monitoring";

const MAX_ATTEMPTS = 5;

export async function processWhatsappRetries(): Promise<void> {
  const now = new Date();
  const rows = await db
    .select()
    .from(whatsappMessagesTable)
    .where(
      and(
        eq(whatsappMessagesTable.deliveryStatus, "failed"),
        eq(whatsappMessagesTable.failureType, "transient"),
        lte(whatsappMessagesTable.nextRetryAt, now),
        sql`${whatsappMessagesTable.attemptCount} < ${MAX_ATTEMPTS}`,
      ),
    )
    .limit(25);

  for (const row of rows) {
    const config = await getClinicWhatsAppConfig(row.clinicId);
    if (!config?.enabled || !config.accessToken || !config.phoneNumberId) continue;

    const templateName = await resolveTemplateNameForAction(
      row.clinicId,
      row.actionType,
      config.outboundTemplate,
    );

    try {
      const delivered = await deliverPatientWhatsAppMessage({
        config,
        toPhone: row.recipientPhone,
        body: row.bodyPreview ?? "Smart Clinic notification",
        logContext: { clinicId: row.clinicId, actionType: row.actionType, retry: true },
        templateNameOverride: templateName,
      });

      await markWhatsappMessageSent(row.id, {
        metaMessageId: delivered.metaMessageId,
        templateName: delivered.templateName,
      });
      logger.info({ messageId: row.id, clinicId: row.clinicId }, "[whatsapp] Retry succeeded");
    } catch (err: unknown) {
      const attemptCount = row.attemptCount + 1;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const failureType = attemptCount >= MAX_ATTEMPTS ? "permanent" : "transient";
      await markWhatsappMessageFailed(row.id, {
        errorMessage,
        failureType,
        attemptCount,
        nextRetryAt: failureType === "transient" ? computeNextRetry(attemptCount) : null,
      });
      if (failureType === "permanent") {
        await notifyWhatsappDeliveryFailure(row.clinicId, row.actionType, errorMessage);
      }
    }
  }
}
