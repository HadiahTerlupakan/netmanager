import crypto from "crypto";
import { logger } from "@/lib/logger";
import type {
  ProviderConfig,
  TransactionStatus,
  WebhookResult,
} from "../provider-interface";

export function mapXenditStatus(
  status: string | undefined,
): TransactionStatus["status"] {
  switch (status) {
    case "PAID":
    case "SETTLED":
      return "PAID";
    case "EXPIRED":
      return "EXPIRED";
    case "PENDING":
      return "PENDING";
    default:
      return "FAILED";
  }
}

export function buildXenditWebhookResult(
  payload: Record<string, unknown>,
): WebhookResult {
  const status = mapXenditStatus(payload.status as string | undefined);

  return {
    orderId: payload.external_id as string,
    status,
    ...(payload.paid_at ? { paidAt: new Date(payload.paid_at as string) } : {}),
    paymentMethod: payload.payment_method as string,
    transactionId: payload.id as string,
    amount: payload.amount as number,
    raw: payload,
  };
}

export function resolveXenditCallbackToken(
  payload: Record<string, unknown>,
  signature?: string,
) {
  if (!signature) {
    return payload["x-callback-token"] as string | undefined;
  }

  return signature;
}

export function resolveXenditStoredCallbackToken(config?: ProviderConfig) {
  const storedToken =
    (config?.settings?.callbackToken as string | undefined) ||
    config?.apiSecret ||
    config?.apiKey;

  if (!storedToken) {
    logger.warn("Xendit: No callback token configured for verification");
    return undefined;
  }

  return storedToken;
}

export function hasXenditMatchingToken(
  callbackToken: string,
  storedToken: string,
) {
  const tokenBuffer = Buffer.from(callbackToken);
  const storedBuffer = Buffer.from(storedToken);

  if (tokenBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, storedBuffer);
}
