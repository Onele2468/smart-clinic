import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";
import { logger } from "../lib/logger";
import { updateDeliveryStatusByMetaId } from "../services/whatsapp/whatsapp.delivery";
import { processIncomingWhatsAppMessage } from "../services/whatsapp/whatsapp.incoming";

const router: IRouter = Router();

function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    logger.warn("[whatsapp] WHATSAPP_APP_SECRET not set — skipping webhook signature verification");
    return true;
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

// GET /api/webhooks/whatsapp — Meta verification challenge
router.get("/", (req: Request, res: Response): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && typeof challenge === "string") {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).json({ error: "Verification failed" });
});

// POST /api/webhooks/whatsapp — delivery status updates
router.post(
  "/",
  async (req: Request, res: Response): Promise<void> => {
    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody)) {
      res.status(400).json({ error: "Expected raw body" });
      return;
    }

    if (!verifyMetaSignature(rawBody, req.header("x-hub-signature-256"))) {
      res.status(403).json({ error: "Invalid signature" });
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    const entry = (payload as { entry?: unknown[] })?.entry?.[0] as
    | {
        changes?: { value?: { statuses?: unknown[];
            messages?: unknown[];
          };
        }[];
      }
    | undefined;
    const statuses = entry?.changes?.[0]?.value?.statuses ?? [];
    const messages = entry?.changes?.[0]?.value?.messages ?? [];

    for (const status of statuses as { id?: string; status?: string }[]) {
      const metaId = status.id;
      const st = status.status;
      if (!metaId || !st) continue;

      if (st === "sent") await updateDeliveryStatusByMetaId(metaId, "sent");
      else if (st === "delivered") await updateDeliveryStatusByMetaId(metaId, "delivered");
      else if (st === "read") await updateDeliveryStatusByMetaId(metaId, "read");
      else if (st === "failed") await updateDeliveryStatusByMetaId(metaId, "failed");
    }
    if (messages.length > 0) {
    await processIncomingWhatsAppMessage(payload);
   }
    res.status(200).send("EVENT_RECEIVED");
  },
);

export default router;
