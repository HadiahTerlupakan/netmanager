import { z } from "zod";

export const CreatePaymentRequestSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  amount: z.number().positive("Amount must be positive"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email format"),
  customerPhone: z
    .string()
    .regex(/^(\+62|62|0)[0-9]{9,12}$/, "Invalid Indonesian phone number"),
  description: z.string().min(1, "Description is required"),
  expiryHours: z.number().positive().optional().default(24),
  paymentMethods: z.array(z.string()).optional(),
  tenantId: z.string().optional(),
});

export type CreatePaymentRequestDto = z.infer<
  typeof CreatePaymentRequestSchema
>;
