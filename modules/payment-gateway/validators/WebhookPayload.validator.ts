import {
  WebhookPayloadSchema,
  type WebhookPayloadDto,
} from "../dto/WebhookPayload.dto";
import { ValidationError } from "./CreatePaymentRequest.validator";

export function validateWebhookPayload(data: unknown): WebhookPayloadDto {
  const result = WebhookPayloadSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));

    throw new ValidationError("Invalid webhook payload", errors);
  }

  return result.data;
}
