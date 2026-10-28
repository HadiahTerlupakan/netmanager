import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  taxConfig: vi.fn(),
  limits: vi.fn(),
}));

vi.mock(
  "@/modules/sample-invoice/repositories/SampleInvoiceBatchRepository",
  () => ({
    SampleInvoiceBatchRepository: class {
      async create(data: Record<string, unknown>) {
        const row = {
          ...data,
          id: `b${palsu.rows.size + 1}`,
          createdAt: new Date(),
        };
        palsu.rows.set(row.id as string, row);
        return row;
      }
      async findById(id: string) {
        return palsu.rows.get(id) ?? null;
      }
    },
  }),
);
vi.mock(
  "@/modules/sample-invoice/services/sample-invoice-limits",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getSampleInvoiceLimits: palsu.limits,
  }),
);
vi.mock("@/lib/prisma", () => ({
  prisma: { taxConfig: { findFirst: palsu.taxConfig } },
}));

import {
  buildSampleBatchZip,
  generateSampleBatch,
  getIssuerPrefill,
} from "@/modules/sample-invoice/services/SampleInvoiceService";
import { DEFAULT_SAMPLE_INVOICE_LIMITS } from "@/modules/sample-invoice/services/sample-invoice-limits";

const raw = {
  mitraId: "m1",
  mitraName: "Mitra Selawangi",
  issuer: { name: "PT Contoh", address: "Bogor", phone: "021" },
  packages: [{ name: "Home 10", speed: "10 Mbps", price: 150000 }],
  customerCount: 4,
  fromMonth: "2026-09",
  toMonth: "2026-10",
  center: { lat: -6.5, lng: 107.1 },
  radiusM: 2000,
  dueDay: 10,
  payDate: { mode: "random" },
  ppn: "inclusive",
  streets: Array.from({ length: 5 }, (_, i) => ({ name: `Jalan ${i}` })),
};
const actor = { id: "u1", name: "Admin" };
// 28 Okt 2026 pukul 20.00 WIB = 13.00 UTC.
const NOW = new Date("2026-10-28T13:00:00Z");

function pdfTexts(zip: Buffer) {
  return new AdmZip(zip)
    .getEntries()
    .sort((a, b) => a.entryName.localeCompare(b.entryName))
    .map((entry) =>
      [
        ...entry
          .getData()
          .toString("latin1")
          .matchAll(/\((.*?)\) Tj/g),
      ]
        .map((m) => m[1])
        .join("|"),
    );
}

describe("SampleInvoiceService", () => {
  beforeEach(() => {
    palsu.rows.clear();
    palsu.limits.mockResolvedValue(DEFAULT_SAMPLE_INVOICE_LIMITS);
  });

  it("stores the generated set with the generation time and without the street list", async () => {
    const result = await generateSampleBatch("t1", actor, raw, NOW);

    const row = palsu.rows.get(result.batchId)!;
    expect(row).toMatchObject({
      tenantId: "t1",
      mitraId: "m1",
      mitraName: "Mitra Selawangi",
      createdById: "u1",
      createdByName: "Admin",
      generatedAt: NOW,
      customerCount: 4,
      invoiceCount: 8,
      fromMonth: "2026-09",
      toMonth: "2026-10",
    });
    expect((row.input as Record<string, unknown>).streets).toBeUndefined();
    expect(typeof (row.input as Record<string, unknown>).seed).toBe("number");
    expect(result.parts.map((p) => p.key)).toEqual(["all"]);
  });

  it("rejects invalid input with the validator's message", async () => {
    await expect(
      generateSampleBatch("t1", actor, { ...raw, toMonth: "2026-11" }, NOW),
    ).rejects.toThrow(/bulan berjalan/);
  });

  it("uses the WIB date for today", async () => {
    // 28 Okt 2026 pukul 01.00 WIB masih 27 Okt di UTC.
    const early = new Date("2026-10-27T18:00:00Z");
    const result = await generateSampleBatch(
      "t1",
      actor,
      { ...raw, payDate: { mode: "fixed", day: 28 } },
      early,
    );
    expect(result.batchId).toBeTruthy();
  });

  // Unduh ulang berbulan-bulan kemudian harus mencetak isi yang sama.
  it("re-download gives the same invoice contents", async () => {
    const { batchId } = await generateSampleBatch("t1", actor, raw, NOW);

    const first = await buildSampleBatchZip(batchId, "all");
    const second = await buildSampleBatchZip(batchId, "all");

    expect(first?.fileName).toBe(
      "contoh-invoice-mitra-selawangi-202609-202610.zip",
    );
    expect(pdfTexts(first!.buffer)).toEqual(pdfTexts(second!.buffer));
    expect(pdfTexts(first!.buffer)).toHaveLength(8);
  });

  it("returns null for an unknown batch or part", async () => {
    const { batchId } = await generateSampleBatch("t1", actor, raw, NOW);
    expect(await buildSampleBatchZip("nope", "all")).toBeNull();
    expect(await buildSampleBatchZip(batchId, "2026-09")).toBeNull();
  });

  it("prefills the issuer from the tax settings, or leaves it empty", async () => {
    palsu.taxConfig.mockResolvedValueOnce({ companyName: "PT Radpro" });
    expect(await getIssuerPrefill("t1")).toEqual({
      name: "PT Radpro",
      address: "",
      phone: "",
    });
    palsu.taxConfig.mockResolvedValueOnce(null);
    expect(await getIssuerPrefill("t1")).toEqual({
      name: "",
      address: "",
      phone: "",
    });
  });

  // Modul ini terpisah dari billing, akuntansi, pajak, dan event bus.
  it("never imports billing, accounting, tax, regulatory or the event bus", () => {
    const root = join(process.cwd(), "modules/sample-invoice");
    const files = (function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    })(root);
    const forbidden =
      /from "@\/(modules\/(finance|accounting|tax|regulatory|pelanggan)|lib\/event-bus|lib\/prisma-billing)/;
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(forbidden);
    }
  });
});
