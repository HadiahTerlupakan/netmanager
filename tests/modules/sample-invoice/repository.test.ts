import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  deleteMany: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { sampleInvoiceBatch: palsu },
}));

import { SampleInvoiceBatchRepository } from "@/modules/sample-invoice/repositories/SampleInvoiceBatchRepository";

describe("SampleInvoiceBatchRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.findMany.mockResolvedValue([]);
    palsu.count.mockResolvedValue(0);
  });

  // Daftar riwayat tidak perlu memuat set contoh yang bisa berisi ribuan invoice.
  it("lists newest first without the stored set and input", async () => {
    await new SampleInvoiceBatchRepository().list({ page: 2, limit: 10 });

    const args = palsu.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(args.select.sampleSet).toBeUndefined();
    expect(args.select.input).toBeUndefined();
    expect(args.select.mitraName).toBe(true);
    expect(args.where).toEqual({});
  });

  it("filters by mitra", async () => {
    await new SampleInvoiceBatchRepository().list({
      mitraId: "m1",
      page: 1,
      limit: 20,
    });

    expect(palsu.findMany.mock.calls[0][0].where).toEqual({ mitraId: "m1" });
    expect(palsu.count).toHaveBeenCalledWith({ where: { mitraId: "m1" } });
  });

  // deleteMany membiarkan isolasi tenant menambahkan tenantId ke filter.
  it("deletes through a filter the tenant isolation can scope", async () => {
    await new SampleInvoiceBatchRepository().delete("b1");

    expect(palsu.deleteMany).toHaveBeenCalledWith({ where: { id: "b1" } });
  });
});
