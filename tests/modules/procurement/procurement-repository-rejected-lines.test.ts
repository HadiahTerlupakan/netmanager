import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProcurementRepository } from "@/modules/procurement/repositories/ProcurementRepository";
import { prismaMock } from "@/tests/setup";

describe("ProcurementRepository — baris yang ditolak penyetuju", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tidak membawa baris barang dan jasa yang ditolak ke pembuatan PO", async () => {
    prismaMock.purchaseRequest.findMany.mockResolvedValue([]);

    await new ProcurementRepository().findApprovedPRs(["pr-1"]);

    const [query] = prismaMock.purchaseRequest.findMany.mock.calls[0];
    expect(query.include.items.where).toEqual({
      statusApproval: { not: "REJECTED" },
    });
    expect(query.include.jasaItems.where).toEqual({
      statusApproval: { not: "REJECTED" },
    });
  });

  function summaryRecord(status: string) {
    return {
      id: "pr-1",
      nomorRequest: "PR-1",
      status,
      prioritas: "NORMAL",
      tanggal: new Date("2026-11-08T00:00:00Z"),
      approvedAt: null as Date | null,
      purchaseOrderId: null as string | null,
      tenantId: "tenant-1",
      requester: { name: "Budi" },
      gudang: { nama: "Gudang A" },
      items: [
        { jumlah: 4, totalHarga: 400, statusApproval: "APPROVED" },
        { jumlah: 6, totalHarga: 600, statusApproval: "REJECTED" },
      ],
    };
  }

  async function listSummaryFor(status: string) {
    prismaMock.purchaseRequest.findMany.mockResolvedValue([
      summaryRecord(status),
    ] as never);
    prismaMock.purchaseRequest.count.mockResolvedValue(1);
    const result = await new ProcurementRepository().listPurchaseRequests({
      tenantId: "tenant-1",
      page: 1,
      limit: 10,
    });
    return result.data[0];
  }

  it("menghitung total ringkasan pengajuan tanpa baris yang ditolak", async () => {
    const summary = await listSummaryFor("APPROVED");

    expect(summary).toMatchObject({ totalItems: 4, totalNilai: 400 });
  });

  it("tetap menampilkan nilai yang diajukan pada pengajuan yang ditolak utuh", async () => {
    const summary = await listSummaryFor("REJECTED");

    expect(summary).toMatchObject({ totalItems: 10, totalNilai: 1000 });
  });
});
