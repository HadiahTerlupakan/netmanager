import { z } from "zod";

const MIN_TRANSACTION_DEFAULT = 0;
const QUOTA_DEFAULT = 0;

/**
 * Schema for coupon creation payload.
 */
export const createCouponSchema = z
  .object({
    code: z.string().trim().min(1),
    description: z.string().trim().optional(),
    discountType: z.enum(["FIXED", "PERCENT"]),
    discountValue: z.coerce.number().nonnegative(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    minTransaction: z.coerce
      .number()
      .nonnegative()
      .default(MIN_TRANSACTION_DEFAULT),
    maxDiscount: z.coerce.number().nonnegative().optional(),
    quota: z.coerce.number().int().nonnegative().default(QUOTA_DEFAULT),
    isActive: z.boolean().default(true),
  })
  .refine((input) => input.endDate >= input.startDate, {
    message: "Tanggal berakhir harus setelah atau sama dengan tanggal mulai",
    path: ["endDate"],
  });

/**
 * Schema for coupon verification payload.
 */
export const verifyCouponSchema = z.object({
  code: z.string().trim().min(1),
  amount: z.coerce.number().nonnegative(),
  pelangganId: z.string().trim().optional(),
});
