import { logger } from "@/lib/logger";
import {
  PROVIDER_SIGNATURE_HEADERS,
  SIGNATURE_REQUIRED,
  type ProviderType,
} from "../domain/value-objects/ProviderType";

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export class WebhookVerificationService {
  /**
   * Verify webhook signature for a provider
   * @throws WebhookVerificationError if signature is invalid or missing when required
   */
  verifySignature(provider: ProviderType, signature: string | undefined): void {
    const isRequired = SIGNATURE_REQUIRED[provider];

    if (isRequired && !signature) {
      logger.warn(`[Webhook] Missing required signature for ${provider}`);
      throw new WebhookVerificationError(`Missing signature for ${provider}`);
    }
  }

  /**
   * Extract signature from headers based on provider
   */
  extractSignature(
    provider: ProviderType,
    headers: Headers,
  ): string | undefined {
    const signatureHeader = PROVIDER_SIGNATURE_HEADERS[provider];

    if (!signatureHeader) {
      return undefined;
    }

    return headers.get(signatureHeader) ?? undefined;
  }
}
