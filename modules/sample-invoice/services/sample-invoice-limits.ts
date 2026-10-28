import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type SampleInvoiceLimits = {
  maxCustomers: number;
  maxMonths: number;
  maxPdfs: number;
};

export const DEFAULT_SAMPLE_INVOICE_LIMITS: SampleInvoiceLimits = {
  maxCustomers: 500,
  maxMonths: 12,
  maxPdfs: 2000,
};

/**
 * Plafon teknis yang tidak bisa dinaikkan admin: set contoh dibangun dan
 * disimpan utuh dalam satu permintaan, jadi tanpa plafon satu generate bisa
 * menghabiskan memori pod. Batas yang diatur admin berada di bawahnya.
 */
export const HARD_SAMPLE_INVOICE_LIMITS: SampleInvoiceLimits = {
  maxCustomers: 10000,
  maxMonths: 36,
  maxPdfs: 100000,
};

const SETTINGS_KEY = "invoice_contoh.limits";
const LIMIT_FIELDS = Object.keys(
  DEFAULT_SAMPLE_INVOICE_LIMITS,
) as (keyof SampleInvoiceLimits)[];

const isLimit = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1;

function parseStored(value: string | null | undefined) {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Batas per tenant; nilai tersimpan yang rusak memakai nilai awal. */
export async function getSampleInvoiceLimits(
  tenantId: string,
): Promise<SampleInvoiceLimits> {
  const row = await prisma.settings.findFirst({
    where: { tenantId, key: SETTINGS_KEY },
  });
  const stored = parseStored(row?.value);
  return Object.fromEntries(
    LIMIT_FIELDS.map((field) => [
      field,
      isLimit(stored[field])
        ? Math.min(stored[field], HARD_SAMPLE_INVOICE_LIMITS[field])
        : DEFAULT_SAMPLE_INVOICE_LIMITS[field],
    ]),
  ) as SampleInvoiceLimits;
}

export async function saveSampleInvoiceLimits(
  tenantId: string,
  limits: SampleInvoiceLimits,
): Promise<SampleInvoiceLimits> {
  if (!LIMIT_FIELDS.every((field) => isLimit(limits[field]))) {
    throw new Error("Setiap batas harus bilangan bulat minimal 1");
  }
  const tooHigh = LIMIT_FIELDS.find(
    (field) => limits[field] > HARD_SAMPLE_INVOICE_LIMITS[field],
  );
  if (tooHigh) {
    const { maxCustomers, maxMonths, maxPdfs } = HARD_SAMPLE_INVOICE_LIMITS;
    throw new Error(
      `Batas maksimal: ${maxCustomers.toLocaleString("id-ID")} pelanggan, ${maxMonths} bulan, ${maxPdfs.toLocaleString("id-ID")} PDF`,
    );
  }
  const value = JSON.stringify(
    Object.fromEntries(LIMIT_FIELDS.map((field) => [field, limits[field]])),
  );
  await prisma.settings.upsert({
    where: { key_tenantId: { key: SETTINGS_KEY, tenantId } },
    update: { value, updatedAt: new Date() },
    create: {
      id: randomUUID(),
      key: SETTINGS_KEY,
      tenantId,
      value,
      description: "Batas generate invoice contoh",
      updatedAt: new Date(),
    },
  });
  return limits;
}
