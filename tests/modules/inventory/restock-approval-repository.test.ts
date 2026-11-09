import { describe, expect, it, vi } from "vitest";

import type { SaveRestockApprovalCommand } from "@/modules/inventory/domain/ports/IRestockApprovalRepository";
import { RestockApprovalRepository } from "@/modules/inventory/repositories/RestockApprovalRepository";

function createDb(counts: { request?: number; line?: number } = {}) {
  const tx = {
    purchaseRequest: {
      updateMany: vi.fn().mockResolvedValue({ count: counts.request ?? 1 }),
    },
    purchaseRequestItem: {
      updateMany: vi.fn().mockResolvedValue({ count: counts.line ?? 1 }),
    },
    purchaseRequestJasaItem: {
      updateMany: vi.fn().mockResolvedValue({ count: counts.line ?? 1 }),
    },
  };
  const db = {
    $transaction: vi.fn(async (write: (client: typeof tx) => Promise<void>) =>
      write(tx),
    ),
    barang: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { db, tx };
}

const decidedAt = new Date("2026-11-08T10:00:00Z");

const approvalCommand: SaveRestockApprovalCommand = {
  purchaseRequestId: "pr-1",
  tenantId: "tenant-1",
  actorId: "user-1",
  decidedAt,
  catatan: null,
  plan: {
    barangLines: [
      {
        itemId: "item-1",
        nama: "Kabel",
        statusApproval: "APPROVED",
        catatanApproval: "Ganti",
        jumlahDisetujui: 6,
        quantityChange: { jumlah: 6, jumlahDiminta: 10, totalHarga: 600 },
        substitution: {
          barangId: "barang-9",
          barangNama: "Kabel B",
          barangIdDiminta: "barang-1",
        },
      },
    ],
    jasaLines: [
      {
        itemId: "jasa-1",
        nama: "Tarik",
        statusApproval: "REJECTED",
        catatanApproval: "Tidak perlu",
        jumlahDisetujui: 0,
        quantityChange: null,
      },
    ],
  },
};

describe("RestockApprovalRepository", () => {
  it("mengklaim pengajuan DRAFT lalu menulis keputusan setiap baris", async () => {
    const { db, tx } = createDb();
    const repository = new RestockApprovalRepository(db as never);

    await expect(repository.saveApproval(approvalCommand)).resolves.toBe(true);

    expect(tx.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "pr-1", tenantId: "tenant-1", status: "DRAFT" },
      data: {
        status: "APPROVED",
        catatanApproval: null,
        approvedAt: decidedAt,
        approvedBy: "user-1",
      },
    });
    expect(tx.purchaseRequestItem.updateMany).toHaveBeenCalledWith({
      where: { id: "item-1", purchaseRequestId: "pr-1" },
      data: {
        statusApproval: "APPROVED",
        catatanApproval: "Ganti",
        jumlah: 6,
        jumlahDiminta: 10,
        totalHarga: 600,
        barangId: "barang-9",
        barangIdDiminta: "barang-1",
      },
    });
    expect(tx.purchaseRequestJasaItem.updateMany).toHaveBeenCalledWith({
      where: { id: "jasa-1", purchaseRequestId: "pr-1" },
      data: { statusApproval: "REJECTED", catatanApproval: "Tidak perlu" },
    });
  });

  it("mengembalikan false tanpa menulis baris bila pengajuan sudah tidak DRAFT", async () => {
    const { db, tx } = createDb({ request: 0 });
    const repository = new RestockApprovalRepository(db as never);

    await expect(repository.saveApproval(approvalCommand)).resolves.toBe(false);
    expect(tx.purchaseRequestItem.updateMany).not.toHaveBeenCalled();
  });

  it("mengembalikan false bila baris yang diputuskan sudah tidak ada", async () => {
    const { db } = createDb({ line: 0 });
    const repository = new RestockApprovalRepository(db as never);

    await expect(repository.saveApproval(approvalCommand)).resolves.toBe(false);
  });

  it("menandai semua baris ditolak saat pengajuan ditolak", async () => {
    const { db, tx } = createDb();
    const repository = new RestockApprovalRepository(db as never);

    await expect(
      repository.saveRejection({
        purchaseRequestId: "pr-1",
        tenantId: "tenant-1",
        actorId: "user-1",
        decidedAt,
        catatan: "Anggaran habis",
      }),
    ).resolves.toBe(true);

    expect(tx.purchaseRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          catatanApproval: "Anggaran habis",
        }),
      }),
    );
    expect(tx.purchaseRequestItem.updateMany).toHaveBeenCalledWith({
      where: { purchaseRequestId: "pr-1" },
      data: { statusApproval: "REJECTED" },
    });
    expect(tx.purchaseRequestJasaItem.updateMany).toHaveBeenCalledWith({
      where: { purchaseRequestId: "pr-1" },
      data: { statusApproval: "REJECTED" },
    });
  });

  it("mencari barang pengganti hanya di tenant yang sama", async () => {
    const { db } = createDb();
    const repository = new RestockApprovalRepository(db as never);

    await repository.findBarangByIds(["barang-9"], "tenant-1");

    expect(db.barang.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["barang-9"] }, tenantId: "tenant-1" },
      select: { id: true, nama: true },
    });
  });

  it("melempar ulang galat yang bukan karena kalah balapan", async () => {
    const { db } = createDb();
    db.$transaction.mockRejectedValue(new Error("db down"));
    const repository = new RestockApprovalRepository(db as never);

    await expect(repository.saveApproval(approvalCommand)).rejects.toThrow(
      "db down",
    );
  });
});
