import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), {
    message: "Tanggal tidak valid",
  });

export const asOfDateSchema = z.object({
  asOfDate: isoDate,
});

export const dateRangeSchema = z
  .object({
    from: isoDate,
    to: isoDate,
  })
  .refine((v) => new Date(v.from).getTime() <= new Date(v.to).getTime(), {
    message: "from harus <= to",
    path: ["to"],
  });

export const ledgerQuerySchema = z
  .object({
    coaId: z.string().min(1),
    from: isoDate,
    to: isoDate,
  })
  .refine((v) => new Date(v.from).getTime() <= new Date(v.to).getTime(), {
    message: "from harus <= to",
    path: ["to"],
  });

export type AsOfDateQuery = z.infer<typeof asOfDateSchema>;
export type DateRangeQuery = z.infer<typeof dateRangeSchema>;
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;
