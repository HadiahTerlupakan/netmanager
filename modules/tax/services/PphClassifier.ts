/** PPh category for Indonesian withholding classification */
export type PphClassification = "jasa" | "sewa_tanah" | "sewa" | null;

/**
 * Single source of truth untuk dropdown kategori PPh di seluruh aplikasi.
 *
 * Konsumen (procurement, expense, dll) wajib import dari sini — jangan
 * hardcode list/label sendiri. Saat ada penambahan kategori baru (mis.
 * PPh 26 untuk vendor luar negeri), cukup tambahkan di sini dan semua
 * dropdown otomatis ikut.
 */
export interface PphOption {
  value: NonNullable<PphClassification>;
  label: string;
  /** Tarif PPh yang diterapkan untuk kategori ini. */
  rateLabel: string;
}

export const PPH_OPTIONS: readonly PphOption[] = [
  { value: "jasa", label: "Jasa", rateLabel: "PPh 23 — 2%" },
  { value: "sewa", label: "Sewa", rateLabel: "PPh 23 — 2%" },
  {
    value: "sewa_tanah",
    label: "Sewa Tanah/Bangunan",
    rateLabel: "PPh 4(2) — 10%",
  },
] as const;

/**
 * Map value → label gabungan (label + rateLabel) untuk display.
 * Contoh: "jasa" → "Jasa (PPh 23)".
 */
export const PPH_LABEL: Record<
  NonNullable<PphClassification>,
  string
> = PPH_OPTIONS.reduce(
  (acc, opt) => {
    acc[opt.value] = `${opt.label} (${opt.rateLabel})`;
    return acc;
  },
  {} as Record<NonNullable<PphClassification>, string>,
);

/**
 * Helper safe untuk lookup label dari value yang berasal dari DB/API
 * (tipe `string | null`). Return null bila value bukan kategori valid.
 */
export function getPphLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value in PPH_LABEL) {
    return PPH_LABEL[value as NonNullable<PphClassification>];
  }
  return null;
}

const VALID_VENDOR_OVERRIDES: ReadonlySet<PphClassification> = new Set(
  PPH_OPTIONS.map((o) => o.value),
);

/**
 * Determines PPh classification from expense category, with optional supplier override.
 *
 * Resolution order:
 * 1. Vendor `defaultPphCategory` if explicitly set (jasa/sewa/sewa_tanah)
 * 2. Expense category type (sewa_tanah > sewa > jasa)
 * 3. Expense category name string-match (less reliable, last resort)
 *
 * Mapping:
 * - "sewa_tanah" → PPh 4(2) final (sewa tanah/bangunan)
 * - "sewa" → PPh 23 (sewa selain tanah/bangunan)
 * - "jasa" → PPh 23 (jasa)
 * - otherwise → no PPh
 */
export function classifyPph(input: {
  categoryType: string;
  categoryName: string;
  vendorDefaultPphCategory?: string | null;
}): PphClassification {
  if (
    input.vendorDefaultPphCategory &&
    VALID_VENDOR_OVERRIDES.has(
      input.vendorDefaultPphCategory as PphClassification,
    )
  ) {
    return input.vendorDefaultPphCategory as PphClassification;
  }

  const typeLower = input.categoryType.toLowerCase();
  const nameLower = input.categoryName.toLowerCase();

  if (
    typeLower === "sewa_tanah" ||
    nameLower.includes("sewa tanah") ||
    nameLower.includes("sewa bangunan")
  ) {
    return "sewa_tanah";
  }

  if (typeLower === "sewa" || nameLower.includes("sewa")) {
    return "sewa";
  }

  if (typeLower === "jasa" || nameLower.includes("jasa")) {
    return "jasa";
  }

  return null;
}
