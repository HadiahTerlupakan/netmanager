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
        ? stored[field]
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
