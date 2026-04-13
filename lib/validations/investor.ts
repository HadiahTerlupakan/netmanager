import * as z from "zod";
import { idSchema, optionalIdSchema } from "./common";

/**
 * Investor validation schema
 */
export const investorSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  password: z
    .string()
    .min(6, "Password minimal 6 karakter")
    .optional()
    .or(z.literal("")),
  namaLengkap: z.string().min(1, "Nama lengkap wajib diisi"),
  perusahaan: z.string().optional(),
  email: z.email({ error: "Format email tidak valid" }),
  noTelp: z.string().optional(),
  tenantId: optionalIdSchema,
});

/**
 * Investor payout status enum
 */
export const investorPayoutStatusEnum = z.enum([
  "PENDING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
]);

/**
 * Investor payout validation schema
 */
export const investorPayoutSchema = z.object({
  investorId: idSchema,
  amount: z.coerce.number().positive("Jumlah harus lebih dari 0"),
  date: z.coerce.date(),
  bankName: z.string().min(1, "Nama bank wajib diisi"),
  accountNumber: z.string().min(1, "Nomor rekening wajib diisi"),
  accountName: z.string().min(1, "Nama pemilik rekening wajib diisi"),
  reference: z.string().optional(),
  notes: z.string().optional(),
  status: investorPayoutStatusEnum.default("PENDING"),
});

/**
 * Investor update schema - all fields optional
 */
export const updateInvestorSchema = investorSchema
  .partial()
  .extend({
    id: idSchema,
  })
  .refine((data) => Object.keys(data).length > 1, {
    message: "Minimal satu field harus diisi untuk update",
  });

/**
 * Investor payout update schema
 */
export const updateInvestorPayoutSchema = investorPayoutSchema
  .partial()
  .extend({
    id: idSchema,
  });
