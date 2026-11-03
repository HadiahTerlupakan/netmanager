import * as z from "zod";

/**
 * Persen komisi disimpan di kolom `rate` Decimal(5,2): lebih dari 0 sampai
 * 100, hingga 2 angka desimal (mis. 2.5 = 2,5%). Nominal tetap dalam rupiah
 * bulat per invoice lunas.
 */
export const MIN_COMMISSION_PERCENT = 0.01;
export const MAX_COMMISSION_PERCENT = 100;
export const COMMISSION_PERCENT_DECIMALS = 2;
export const MIN_FIXED_COMMISSION = 1;
export const MAX_FIXED_COMMISSION = 100_000_000;

const PERCENT_SCALE = 10 ** COMMISSION_PERCENT_DECIMALS;
/** Toleransi galat biner float saat memeriksa jumlah desimal. */
const DECIMAL_TOLERANCE = 1e-9;

/** Benar bila persen punya paling banyak 2 angka desimal. */
export function hasValidPercentPrecision(percent: number): boolean {
  const scaled = percent * PERCENT_SCALE;
  return Math.abs(scaled - Math.round(scaled)) < DECIMAL_TOLERANCE;
}

const percentSchema = z
  .number({ error: "Persen komisi wajib diisi" })
  .gt(0, "Persen komisi harus lebih dari 0")
  .max(MAX_COMMISSION_PERCENT, "Persen komisi maksimal 100")
  .refine(hasValidPercentPrecision, "Persen komisi maksimal 2 angka desimal");

const fixedAmountSchema = z
  .number({ error: "Nominal komisi wajib diisi" })
  .int("Nominal komisi harus rupiah bulat")
  .min(MIN_FIXED_COMMISSION, "Nominal komisi minimal Rp1")
  .max(MAX_FIXED_COMMISSION, "Nominal komisi terlalu besar");

const optionalPackageIdSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const optionalEndsAtSchema = z.coerce.date().nullable().optional();

const RULE_PERIOD_ISSUE = {
  message: "Tanggal berakhir tidak boleh sebelum tanggal mulai",
  path: ["endsAt"],
};

function isRulePeriodOrdered(rule: {
  startsAt?: Date | undefined;
  endsAt?: Date | null | undefined;
}): boolean {
  if (!rule.startsAt || !rule.endsAt) return true;
  return rule.startsAt.getTime() <= rule.endsAt.getTime();
}

const percentageRuleSchema = z.object({
  type: z.literal("PERCENTAGE"),
  rate: percentSchema,
});

const fixedRuleSchema = z.object({
  type: z.literal("FIXED"),
  fixedAmount: fixedAmountSchema,
});

/**
 * Aturan baru: tepat satu dari persen (`rate`) atau nominal (`fixedAmount`),
 * sesuai `type`. Tanpa `hargaPaketId` berarti berlaku untuk semua paket;
 * aturan per paket didahulukan saat akrual.
 */
export const createResellerCommissionRuleSchema = z
  .discriminatedUnion("type", [percentageRuleSchema, fixedRuleSchema])
  .and(
    z.object({
      hargaPaketId: optionalPackageIdSchema,
      startsAt: z.coerce.date().optional(),
      endsAt: optionalEndsAtSchema,
    }),
  )
  .refine(isRulePeriodOrdered, RULE_PERIOD_ISSUE);

/**
 * Ubah aturan. Jenis dan nilainya dikirim berpasangan (`type` + `rate` atau
 * `fixedAmount`); paketnya tidak bisa diganti — buat aturan baru.
 */
export const updateResellerCommissionRuleSchema = z
  .object({
    type: z.enum(["PERCENTAGE", "FIXED"]).optional(),
    rate: percentSchema.optional(),
    fixedAmount: fixedAmountSchema.optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: optionalEndsAtSchema,
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine(isRulePeriodOrdered, RULE_PERIOD_ISSUE)
  .refine(
    (rule) => !(rule.rate !== undefined && rule.fixedAmount !== undefined),
    {
      message: "Isi persen atau nominal, bukan keduanya",
      path: ["fixedAmount"],
    },
  )
  .refine(
    (rule) =>
      rule.type === undefined ||
      (rule.type === "PERCENTAGE" ? rule.rate : rule.fixedAmount) !== undefined,
    {
      message: "Nilai komisi wajib diisi saat mengganti jenis komisi",
      path: ["type"],
    },
  );

export type CreateResellerCommissionRuleInput = z.infer<
  typeof createResellerCommissionRuleSchema
>;
export type UpdateResellerCommissionRuleInput = z.infer<
  typeof updateResellerCommissionRuleSchema
>;
