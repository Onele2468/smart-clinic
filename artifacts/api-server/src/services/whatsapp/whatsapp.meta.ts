import { logger } from "../../lib/logger";

export const META_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v25.0";

/** Meta error codes that indicate session text is not allowed — retry with template. */
export const META_TEMPLATE_RETRY_CODES = new Set([
  131047, // Re-engagement message
  131026, // Message undeliverable / 24h window
  131051, // Unsupported message type
  132001, // Template name does not exist (caller may try hello_world)
  63016,
  63032,
]);

export interface MetaSendResult {
  ok: boolean;
  status: number;
  messageId?: string;
  errorCode?: number;
  errorMessage?: string;
  raw: unknown;
}

export function parseMetaErrorBody(body: unknown): { code?: number; message?: string } {
  if (!body || typeof body !== "object") return {};
  const err = (body as { error?: { code?: number; message?: string } }).error;
  return { code: err?.code, message: err?.message };
}

export async function postMetaMessages(
  phoneNumberId: string,
  accessToken: string,
  payload: Record<string, unknown>,
  logContext: Record<string, unknown>,
): Promise<MetaSendResult> {
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;


  logger.info(
    {
      ...logContext,
      metaEndpoint: url,
      metaPayloadType: payload.type,
      metaTo: payload.to,
    },
    "[whatsapp] Meta API request",
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    raw = { parseError: true, statusText: response.statusText };
  }

  const { code, message } = parseMetaErrorBody(raw);
  const messageId =
    raw && typeof raw === "object"
      ? (raw as { messages?: { id?: string }[] }).messages?.[0]?.id
      : undefined;

  const result: MetaSendResult = {
    ok: response.ok,
    status: response.status,
    messageId,
    errorCode: code,
    errorMessage: message,
    raw,
  };

  if (result.ok) {
    logger.info(
      { ...logContext, metaStatus: response.status, metaMessageId: messageId },
      "[whatsapp] Meta API success",
    );
  } else {
    logger.error(
      {
        ...logContext,
        metaStatus: response.status,
        metaErrorCode: code,
        metaErrorMessage: message,
        metaResponse: raw,
      },
      "[whatsapp] Meta API error",
    );
  }

  return result;
}

export function shouldRetryWithTemplate(result: MetaSendResult): boolean {
  if (result.ok) return false;
  if (result.errorCode && META_TEMPLATE_RETRY_CODES.has(result.errorCode)) return true;
  const msg = (result.errorMessage ?? "").toLowerCase();
  return (
    msg.includes("template") ||
    msg.includes("24 hour") ||
    msg.includes("24-hour") ||
    msg.includes("re-engagement") ||
    msg.includes("not a whatsapp user")
  );
}
