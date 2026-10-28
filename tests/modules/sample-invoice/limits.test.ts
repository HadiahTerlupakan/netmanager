import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({ findFirst: vi.fn(), upsert: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { settings: palsu } }));

import {
  DEFAULT_SAMPLE_INVOICE_LIMITS,
  HARD_SAMPLE_INVOICE_LIMITS,
  getSampleInvoiceLimits,
  saveSampleInvoiceLimits,
} from "@/modules/sample-invoice/services/sample-invoice-limits";

describe("batas generate invoice contoh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the defaults when nothing is stored", async () => {
    palsu.findFirst.mockResolvedValue(null);

    expect(await getSampleInvoiceLimits("t1")).toEqual({
      maxCustomers: 500,
      maxMonths: 12,
      maxPdfs: 2000,
    });
    expect(palsu.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "t1", key: "invoice_contoh.limits" },
    });
  });

  it("falls back per field when the stored value is partial or broken", async () => {
    palsu.findFirst.mockResolvedValue({
      value: JSON.stringify({ maxCustomers: 900, maxMonths: "x", maxPdfs: -1 }),
    });
    expect(await getSampleInvoiceLimits("t1")).toEqual({
      ...DEFAULT_SAMPLE_INVOICE_LIMITS,
      maxCustomers: 900,
    });

    palsu.findFirst.mockResolvedValue({ value: "{not json" });
    expect(await getSampleInvoiceLimits("t1")).toEqual(
      DEFAULT_SAMPLE_INVOICE_LIMITS,
    );
  });

  it("rejects limits below 1 or not whole numbers", async () => {
    await expect(
      saveSampleInvoiceLimits("t1", {
        maxCustomers: 0,
        maxMonths: 12,
        maxPdfs: 2000,
      }),
    ).rejects.toThrow(/bilangan bulat/);
    await expect(
      saveSampleInvoiceLimits("t1", {
        maxCustomers: 10,
        maxMonths: 1.5,
        maxPdfs: 2000,
      }),
    ).rejects.toThrow(/bilangan bulat/);
    expect(palsu.upsert).not.toHaveBeenCalled();
  });

  it("upserts per tenant and key", async () => {
    const limits = { maxCustomers: 1000, maxMonths: 24, maxPdfs: 10000 };

    expect(await saveSampleInvoiceLimits("t1", limits)).toEqual(limits);
    const args = palsu.upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      key_tenantId: { key: "invoice_contoh.limits", tenantId: "t1" },
    });
    expect(JSON.parse(args.update.value)).toEqual(limits);
    expect(args.create).toMatchObject({
      key: "invoice_contoh.limits",
      tenantId: "t1",
    });
  });

  // Set contoh dibangun dan disimpan utuh dalam satu permintaan; tanpa plafon,
  // admin yang mengubah batas bisa membuat satu generate menghabiskan memori.
  it("refuses limits above the technical ceiling", async () => {
    await expect(
      saveSampleInvoiceLimits("t1", {
        ...DEFAULT_SAMPLE_INVOICE_LIMITS,
        maxPdfs: HARD_SAMPLE_INVOICE_LIMITS.maxPdfs + 1,
      }),
    ).rejects.toThrow(/maksimal/);
    expect(palsu.upsert).not.toHaveBeenCalled();
  });

  it("caps stored limits at the technical ceiling", async () => {
    palsu.findFirst.mockResolvedValue({
      value: JSON.stringify({
        maxCustomers: 10 ** 9,
        maxMonths: 12,
        maxPdfs: 2000,
      }),
    });

    expect((await getSampleInvoiceLimits("t1")).maxCustomers).toBe(
      HARD_SAMPLE_INVOICE_LIMITS.maxCustomers,
    );
  });
});
