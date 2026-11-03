import * as z from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const paginationShape = {
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT),
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const END_OF_DAY_SUFFIX = "T23:59:59.999Z";

const periodRangeShape = {
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
};

/**
 * Akhir periode berupa tanggal saja ("2026-10-31") berarti sampai akhir hari
 * itu; tanpa ini komisi yang terbit di hari terakhir lewat dari settlement.
 */
function extendDateOnlyPeriodEnd(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const { periodEnd } = input as { periodEnd?: unknown };
  if (typeof periodEnd !== "string" || !DATE_ONLY_PATTERN.test(periodEnd)) {
    return input;
  }
  return { ...input, periodEnd: `${periodEnd}${END_OF_DAY_SUFFIX}` };
}

/** Periode terbalik ditolak 400, bukan diteruskan sebagai rentang kosong. */
function isPeriodOrdered(period: { periodStart: Date; periodEnd: Date }) {
  return period.periodStart.getTime() <= period.periodEnd.getTime();
}

const PERIOD_ORDER_ISSUE = {
  message: "Akhir periode tidak boleh sebelum awal periode",
  path: ["periodEnd"],
};

export const listResellerCommissionSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  ...paginationShape,
});

export const listResellerSettlementSchema = z.object(paginationShape);

export const createResellerSettlementSchema = z.preprocess(
  extendDateOnlyPeriodEnd,
  z
    .object({
      ...periodRangeShape,
      notes: z.string().trim().optional().nullable(),
    })
    .refine(isPeriodOrdered, PERIOD_ORDER_ISSUE),
);

export const resellerCommissionSummarySchema = z.preprocess(
  extendDateOnlyPeriodEnd,
  z.object(periodRangeShape).refine(isPeriodOrdered, PERIOD_ORDER_ISSUE),
);

export type ListResellerCommissionSchema = z.infer<
  typeof listResellerCommissionSchema
>;
export type ListResellerSettlementSchema = z.infer<
  typeof listResellerSettlementSchema
>;
export type CreateResellerSettlementSchema = z.infer<
  typeof createResellerSettlementSchema
>;
export type ResellerCommissionSummarySchema = z.infer<
  typeof resellerCommissionSummarySchema
>;

/** Cara bayar komisi ke reseller; selaras enum PaymentMethod modul finance. */
export const SETTLEMENT_PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "CASH",
  "E_WALLET",
  "OTHER",
] as const;

const MAX_PAYMENT_REFERENCE_LENGTH = 100;

/**
 * Tandai settlement dibayar. `accountId` adalah rekening Kas & Bank sumber
 * dana; jurnalnya mengkredit COA rekening itu.
 */
export const payResellerSettlementSchema = z.object({
  paidAt: z.coerce.date({ error: "Tanggal bayar wajib diisi" }),
  paymentMethod: z.enum(SETTLEMENT_PAYMENT_METHODS, {
    error: "Metode pembayaran tidak valid",
  }),
  paymentReference: z
    .string()
    .trim()
    .max(MAX_PAYMENT_REFERENCE_LENGTH, "Referensi maksimal 100 karakter")
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  accountId: z.string().trim().min(1, "Rekening pembayaran wajib dipilih"),
});

export type PayResellerSettlementSchema = z.infer<
  typeof payResellerSettlementSchema
>;

/** Periode laporan bulanan `YYYY-MM` (bulan 01–12). */
export const resellerReportQuerySchema = z.object({
  period: z
    .string({ error: "Periode wajib diisi" })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Periode harus berformat YYYY-MM"),
  format: z.enum(["json", "csv"]).default("json"),
});

export type ResellerReportQuerySchema = z.infer<
  typeof resellerReportQuerySchema
>;
