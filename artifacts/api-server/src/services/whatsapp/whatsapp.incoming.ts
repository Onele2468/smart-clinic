import { logger } from "../../lib/logger";

export async function processIncomingWhatsAppMessage(
  payload: unknown,
): Promise<void> {

  const entry = (payload as any)?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  const message = value?.messages?.[0];

  if (!message) {
    return;
  }

  const from = message.from;
  const text = message.text?.body ?? "";

  logger.info(
    {
      from,
      text,
    },
    "[whatsapp] Incoming patient message",
  );
}