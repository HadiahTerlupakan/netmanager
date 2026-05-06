import { z } from "zod";

export const SendWhatsAppMessageSchema = z
  .object({
    phone: z
      .string()
      .min(10, "Nomor telepon minimal 10 digit")
      .max(20, "Nomor telepon maksimal 20 digit")
      .regex(/^[0-9+]+$/, "Nomor telepon hanya boleh angka dan +"),
    message: z.string().optional(),
    fileUrl: z.string().url("URL file tidak valid").optional(),
    accountId: z.string().optional(), // Optional: auto-select if not provided
  })
  .refine((data) => data.message || data.fileUrl, {
    message: "Minimal harus ada message atau fileUrl",
  });

export type SendWhatsAppMessageDTO = z.infer<typeof SendWhatsAppMessageSchema>;

export const BroadcastWhatsAppMessageSchema = z
  .object({
    phones: z
      .array(
        z
          .string()
          .min(10)
          .max(20)
          .regex(/^[0-9+]+$/),
      )
      .min(1, "Minimal 1 nomor telepon"),
    message: z.string().optional(),
    fileUrl: z.string().url().optional(),
    accountId: z.string().optional(),
    loadBalance: z.boolean().optional().default(false),
  })
  .refine((data) => data.message || data.fileUrl, {
    message: "Minimal harus ada message atau fileUrl",
  });

export type BroadcastWhatsAppMessageDTO = z.infer<
  typeof BroadcastWhatsAppMessageSchema
>;
