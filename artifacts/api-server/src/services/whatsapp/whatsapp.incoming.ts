import { logger } from "../../lib/logger";
import { getClinicWhatsAppConfigByPhoneNumberId } from "./whatsapp.service";
import { runWhatsAppConversationEngine } from "./whatsapp.conversation";

export async function processIncomingWhatsAppMessage(payload: unknown): Promise<void> {
  const entry = (payload as any)?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const phoneNumberId = value?.metadata?.phone_number_id;
  const message = value?.messages?.[0];

  if (!message) return;

  const from = message.from;
  const text = message.text?.body ?? "";
  const metaMessageId = message.id ?? null;

  const clinic = await getClinicWhatsAppConfigByPhoneNumberId(phoneNumberId);

  if (!clinic) {
    logger.warn({ phoneNumberId }, "[whatsapp] No clinic found");
    return;
  }

  logger.info(
    {
      clinicId: clinic.clinicId,
      clinicName: clinic.clinicName,
      phoneNumberId,
      from,
      text,
      metaMessageId,
    },
    "[whatsapp] Incoming patient message",
  );

  await runWhatsAppConversationEngine({
    config: clinic,
    fromPhone: from,
    messageText: text,
    metaMessageId,
  });
}
