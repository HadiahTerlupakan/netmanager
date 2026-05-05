import { logger } from "@/lib/logger";
import {
  isValidProviderType,
  type ProviderType,
} from "../domain/value-objects/ProviderType";
import { parseWebhookPayload } from "./webhook-utils";

export class WebhookPayloadParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookPayloadParseError";
  }
}

export class WebhookPayloadParser {
  /**
   * Parse and validate webhook payload
   * @throws WebhookPayloadParseError if payload is invalid
   */
  parse(
    rawBody: string,
    providerType: string,
  ): {
    provider: ProviderType;
    payload: Record<string, unknown>;
  } {
    const provider = providerType.toUpperCase();

    if (!isValidProviderType(provider)) {
      logger.warn(`[WebhookPayloadParser] Unknown provider: ${provider}`);
      throw new WebhookPayloadParseError(
        `Unknown payment provider: ${provider}`,
      );
    }

    const payload = parseWebhookPayload(rawBody, provider);
    if (!payload) {
      logger.warn(`[WebhookPayloadParser] Invalid payload for ${provider}`);
      throw new WebhookPayloadParseError(
        `Invalid request body for ${provider}`,
      );
    }

    return { provider, payload };
  }
}
