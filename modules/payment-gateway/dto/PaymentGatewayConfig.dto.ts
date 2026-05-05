import { z } from "zod";
import { ProviderType } from "../domain/value-objects/ProviderType";

export const PaymentGatewayConfigSchema = z.object({
  id: z.string().optional(),
  provider: z.enum([
    ProviderType.XENDIT,
    ProviderType.MIDTRANS,
    ProviderType.DUITKU,
    ProviderType.BRI,
    ProviderType.BCA,
    ProviderType.TRIPAY,
    ProviderType.DANA,
    ProviderType.MOOTA,
  ]),
  apiKey: z.string().min(1, "API Key is required"),
  apiSecret: z.string().optional(),
  clientKey: z.string().optional(),
  merchantId: z.string().optional(),
  isProduction: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
  settings: z.record(z.string(), z.unknown()).optional(),
  tenantId: z.string().optional(),
});

export type PaymentGatewayConfigDto = z.infer<
  typeof PaymentGatewayConfigSchema
>;
