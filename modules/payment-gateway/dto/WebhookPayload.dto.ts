import { z } from "zod";

export const WebhookPayloadSchema = z.object({
  provider: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  signature: z.string().optional(),
  rawBody: z.string().optional(),
  tenantId: z.string().optional(),
});

export type WebhookPayloadDto = z.infer<typeof WebhookPayloadSchema>;
