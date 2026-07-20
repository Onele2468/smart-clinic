import crypto from "node:crypto";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentGateway,
  PaymentGatewayConfig,
  VerifiedProviderEvent,
} from "../payment-provider.types";

const YOCO_CHECKOUT_URL = "https://payments.yoco.com/api/checkouts";
const YOCO_SUPPORTED_CURRENCIES = new Set(["ZAR"]);

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export class YocoProvider implements PaymentGateway {
  readonly provider = "yoco" as const;

  validateCurrency(currency: string): void {
    if (!YOCO_SUPPORTED_CURRENCIES.has(currency)) {
      throw new Error(`Yoco currently supports ZAR only. Configured currency was ${currency}.`);
    }
  }

  async createCheckout(config: PaymentGatewayConfig, input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    this.validateCurrency(input.currency);
    if (!config.credentials.secretKey) {
      throw new Error("Yoco secret key is not configured for this clinic");
    }

    const response = await fetch(YOCO_CHECKOUT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.credentials.secretKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        amount: toCents(input.amount),
        currency: input.currency,
        successUrl: input.successUrl ?? undefined,
        cancelUrl: input.cancelUrl ?? undefined,
        failureUrl: input.failureUrl ?? undefined,
        externalId: input.invoiceId,
        metadata: {
          clinicId: input.clinicId,
          invoiceId: input.invoiceId,
          patientId: input.patientId,
          invoiceCode: input.invoiceCode,
          ...input.metadata,
        },
      }),
    });

    const payload = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      throw new Error(`Yoco checkout creation failed: ${typeof payload.message === "string" ? payload.message : response.statusText}`);
    }

    return {
      provider: "yoco",
      providerCheckoutId: String(payload.id),
      providerTransactionId: payload.paymentId ? String(payload.paymentId) : null,
      checkoutUrl: String(payload.redirectUrl),
      providerReference: payload.externalId ? String(payload.externalId) : input.invoiceId,
      rawProviderPayload: payload,
    };
  }

  verifyWebhook(config: PaymentGatewayConfig, rawBody: Buffer, headers: Record<string, string | string[] | undefined>): VerifiedProviderEvent {
    if (!config.credentials.webhookSecret) {
      throw new Error("Yoco webhook secret is not configured for this clinic");
    }

    const signature = readHeader(headers, "webhook-signature");
    if (!signature) {
      throw new Error("Missing Yoco webhook signature");
    }

    const hexDigest = crypto.createHmac("sha256", config.credentials.webhookSecret).update(rawBody).digest("hex");
    const base64Digest = crypto.createHmac("sha256", config.credentials.webhookSecret).update(rawBody).digest("base64");
    const normalizedSignature = signature.replace(/^sha256=/, "");
    if (!safeCompare(normalizedSignature, hexDigest) && !safeCompare(normalizedSignature, base64Digest)) {
      throw new Error("Invalid Yoco webhook signature");
    }

    const parsed = JSON.parse(rawBody.toString("utf8"));
    const payload = parsed.payload ?? {};
    const eventType = String(parsed.type ?? "");
    const paymentMethodDetails = payload.paymentMethodDetails ?? {};
    const paymentMethod = typeof paymentMethodDetails.type === "string" ? paymentMethodDetails.type : "card";
    const checkoutId = payload.metadata?.checkoutId ?? payload.metadata?.checkout_id ?? payload.checkoutId ?? null;

    let status: VerifiedProviderEvent["status"] = "ignored";
    if (eventType === "payment.succeeded" || payload.status === "succeeded") status = "paid";
    else if (eventType.includes("refund")) status = "refunded";
    else if (eventType.includes("failed") || payload.status === "failed") status = "failed";
    else if (eventType.includes("expired") || payload.status === "expired") status = "expired";

    return {
      provider: "yoco",
      providerEventId: String(parsed.id ?? payload.id),
      eventType,
      providerCheckoutId: checkoutId ? String(checkoutId) : null,
      providerTransactionId: payload.id ? String(payload.id) : null,
      amount: typeof payload.amount === "number" ? payload.amount / 100 : null,
      currency: typeof payload.currency === "string" ? payload.currency : null,
      paymentMethod,
      paidAt: payload.createdDate ? new Date(payload.createdDate) : null,
      status,
      rawPayload: parsed,
    };
  }
}
