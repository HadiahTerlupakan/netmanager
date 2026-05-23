/** PPh category for Indonesian withholding classification */
export type PphClassification = "jasa" | "sewa_tanah" | "sewa" | null;

const VALID_VENDOR_OVERRIDES: ReadonlySet<PphClassification> = new Set([
  "jasa",
  "sewa_tanah",
  "sewa",
]);

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
