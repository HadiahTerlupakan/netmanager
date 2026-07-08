import * as z from "zod";

export const upsertResellerPackagePriceSchema = z.object({
  hargaPaketId: z.string().trim().min(1),
  price: z.coerce.number().int().positive(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional().nullable(),
});

export type UpsertResellerPackagePriceSchema = z.infer<
  typeof upsertResellerPackagePriceSchema
>;
