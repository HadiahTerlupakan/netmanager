import { z } from "zod";

export const PaymentResponseSchema = z.object({
  success: z.boolean(),
  paymentUrl: z.string().url().optional(),
  qrCodeUrl: z.string().url().optional(),
  vaNumber: z.string().optional(),
  bankCode: z.string().optional(),
  expiresAt: z.date().optional(),
  transactionId: z.string().optional(),
  error: z.string().optional(),
});

export type PaymentResponseDto = z.infer<typeof PaymentResponseSchema>;
