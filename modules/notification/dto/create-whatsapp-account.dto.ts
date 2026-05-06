import { z } from "zod";

export const CreateWhatsAppAccountSchema = z.object({
  name: z.string().min(1, "Nama akun wajib diisi").max(100),
  phone: z
    .string()
    .min(10, "Nomor telepon minimal 10 digit")
    .max(20, "Nomor telepon maksimal 20 digit")
    .regex(/^[0-9+]+$/, "Nomor telepon hanya boleh angka dan +"),
  provider: z.enum(["FONNTE", "WABLAS", "MPWA", "OFFICIAL"], {
    message: "Provider tidak valid",
  }),
  apiKey: z.string().min(1, "API Key wajib diisi"),
  domain: z.string().optional(),
  deviceId: z.string().optional(),
  accountType: z
    .enum(["CUSTOMER", "INTERNAL"], {
      message: "Account type harus CUSTOMER atau INTERNAL",
    })
    .optional()
    .default("CUSTOMER"),
  isActive: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
  priority: z.number().int().min(0).max(100).optional().default(0),
  dailyLimit: z.number().int().min(1).optional(),
});

export type CreateWhatsAppAccountDTO = z.infer<
  typeof CreateWhatsAppAccountSchema
>;
