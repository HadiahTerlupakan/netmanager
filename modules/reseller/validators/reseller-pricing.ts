import * as z from "zod";

import { normalizeBlankToNull, normalizeBlankToUndefined } from "./shared";

export const upsertResellerPackagePriceSchema = z
  .object({
    hargaPaketId: z.string().trim().min(1),
    price: z.coerce.number().int().positive(),
    startsAt: z.preprocess(
      normalizeBlankToUndefined,
      z.coerce.date().optional(),
    ),
    endsAt: z.preprocess(
      normalizeBlankToNull,
      z.coerce.date().nullable().optional(),
    ),
  })
  .refine(
    (value) => !value.endsAt || value.endsAt > (value.startsAt ?? new Date()),
    {
      message: "Tanggal berakhir harus setelah tanggal mulai",
      path: ["endsAt"],
    },
  );

export type UpsertResellerPackagePriceSchema = z.infer<
  typeof upsertResellerPackagePriceSchema
>;
