import { z } from "zod";

export const UpdateWhatsAppAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z
    .string()
    .min(10)
    .max(20)
    .regex(/^[0-9+]+$/)
    .optional(),
  provider: z.enum(["FONNTE", "WABLAS", "MPWA", "OFFICIAL"]).optional(),
  apiKey: z.string().min(1).optional(),
  domain: z.string().optional(),
  deviceId: z.string().optional(),
  accountType: z.enum(["CUSTOMER", "INTERNAL"]).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  dailyLimit: z.number().int().min(1).optional(),
});

export type UpdateWhatsAppAccountDTO = z.infer<
  typeof UpdateWhatsAppAccountSchema
>;
