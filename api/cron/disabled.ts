import "../../artifacts/api-server/src/lib/load-env";
import { logger } from "../../artifacts/api-server/src/lib/logger";
import {
  processAppointmentReminders,
  processFollowUpReminders,
} from "../../artifacts/api-server/src/services/whatsapp/whatsapp.reminder.scheduler";
import { processWhatsappRetries } from "../../artifacts/api-server/src/services/whatsapp/whatsapp.retry.worker";

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponseLike = {
  status(statusCode: number): VercelResponseLike;
  json(body: unknown): void;
};

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization;
  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await processAppointmentReminders();
    await processFollowUpReminders();
    await processWhatsappRetries();
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[whatsapp] Vercel cron failed");
    res.status(500).json({ error: "WhatsApp cron failed" });
  }
}
