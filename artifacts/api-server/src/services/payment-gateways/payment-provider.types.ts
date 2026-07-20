export const PAYMENT_PROVIDER_STATUSES = [
  "created",
  "checkout_generated",
  "awaiting_payment",
  "paid",
  "failed",
  "expired",
  "refunded",
] as const;

export type PaymentProviderStatus = typeof PAYMENT_PROVIDER_STATUSES[number];
export type PaymentProviderName = "yoco";
export type PaymentProviderMode = "test" | "live";
export type PaymentProviderConnectionStatus = "not_configured" | "configured" | "verified" | "error";
export type PaymentProviderWebhookStatus = "not_configured" | "configured" | "verified" | "error";

export interface PaymentGatewayCredentials {
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}

export interface PaymentGatewayConfig {
  clinicId: string;
  provider: PaymentProviderName;
  mode: PaymentProviderMode;
  currency: string;
  credentials: PaymentGatewayCredentials;
}

export interface CreateCheckoutInput {
  clinicId: string;
  invoiceId: string;
  patientId: string;
  invoiceCode: string;
  amount: number;
  currency: string;
  successUrl?: string | null;
  cancelUrl?: string | null;
  failureUrl?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCheckoutResult {
  provider: PaymentProviderName;
  providerCheckoutId: string;
  providerTransactionId?: string | null;
  checkoutUrl: string;
  providerReference?: string | null;
  rawProviderPayload: Record<string, unknown>;
}

export interface VerifiedProviderEvent {
  provider: PaymentProviderName;
  providerEventId: string;
  eventType: string;
  providerCheckoutId?: string | null;
  providerTransactionId?: string | null;
  amount?: number | null;
  currency?: string | null;
  paymentMethod?: string | null;
  paidAt?: Date | null;
  status: "paid" | "failed" | "expired" | "refunded" | "ignored";
  rawPayload: Record<string, unknown>;
}

export interface PaymentGateway {
  readonly provider: PaymentProviderName;
  validateCurrency(currency: string): void;
  createCheckout(config: PaymentGatewayConfig, input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyWebhook(config: PaymentGatewayConfig, rawBody: Buffer, headers: Record<string, string | string[] | undefined>): VerifiedProviderEvent;
}
