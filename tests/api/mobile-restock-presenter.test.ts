import { describe, expect, it } from "vitest";

import { presentRestockRequestForMobile } from "@/app/api/mobile/inventory/pengajuan/presentRestockRequest";

/** Bentuk dari repository: tanggal masih `Date`, belum lewat JSON. */
function makeSource(overrides: Record<string, unknown> = {}) {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "APPROVED",
    tanggal: new Date("2026-11-01T03:00:00.000Z"),
    createdAt: new Date("2026-11-01T03:00:00.000Z"),
    requester: { name: "Budi" },
    gudangId: "gudang-a",
    gudang: { id: "gudang-a", nama: "Gudang Site A" },
    purchaseOrder: { id: "po-1", poNumber: "PO-RAHASIA", status: "DRAFT" },
    purchaseRecords: [] as unknown[],
    jasaItems: [] as unknown[],
    items: [makeItem()],
    ...overrides,
  };
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    barangId: "barang-1",
    jumlah: 10,
    orderedQuantity: 10,
    receivedQuantity: 0,
    cancelledQuantity: 0,
    purchaseOrderItemId: "poi-1",
    purchasedQuantity: 0,
    statusApproval: "APPROVED",
    barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    ...overrides,
  };
}

describe("presentRestockRequestForMobile", () => {
  it("menghitung tahap dan status dengan aturan admin, tanpa data pesanan", () => {
    const presented = presentRestockRequestForMobile(makeSource());

    expect(presented).toMatchObject({
      id: "pr-1",
      nomor: "PR-001",
      tanggal: "2026-11-01T03:00:00.000Z",
      gudang: "Gudang Site A",
      pemohon: "Budi",
      status: {
        kode: "NOT_PURCHASED",
        label: "Belum Dibeli",
        kalimat:
          "Menunggu laporan belanja dari link. Barang baru bisa dicatat datang setelah dilaporkan dibeli.",
      },
      tahap: {
        sekarang: 3,
        berhentiDi: null,
        total: 4,
        judul: [
          "Pengajuan",
          "Persetujuan",
          "Pembelian",
          "Verifikasi barang sampai",
        ],
      },
      barang: [
        {
          nama: "Kabel Fiber",
          satuan: "roll",
          diminta: 10,
          disetujui: 10,
          dibeli: 0,
          datang: 0,
          isDitolak: false,
        },
      ],
    });
    expect(JSON.stringify(presented)).not.toContain("PO-RAHASIA");
  });

  it("belum diputuskan: belum ada jumlah disetujui", () => {
    const presented = presentRestockRequestForMobile(
      makeSource({
        status: "SUBMITTED",
        purchaseOrder: null,
        items: [makeItem({ statusApproval: "PENDING" })],
      }),
    );

    expect(presented.status.label).toBe("Menunggu Persetujuan");
    expect(presented.tahap.sekarang).toBe(2);
    expect(presented.barang[0].disetujui).toBeNull();
  });

  it("barang ditolak ditandai, ditaruh paling bawah, dan tidak dihitung datang", () => {
    const presented = presentRestockRequestForMobile(
      makeSource({
        items: [
          makeItem({
            id: "item-ditolak",
            statusApproval: "REJECTED",
            catatanApproval: "Stok masih ada",
            barang: { nama: "Patch Cord", kode: "BRG-2", satuan: "pcs" },
          }),
          makeItem(),
        ],
      }),
    );

    expect(presented.barang.map((line) => line.nama)).toEqual([
      "Kabel Fiber",
      "Patch Cord",
    ]);
    expect(presented.barang[1]).toMatchObject({
      isDitolak: true,
      disetujui: null,
      dibeli: 0,
      catatanAtasan: "Stok masih ada",
    });
  });

  it("sudah dibeli semua: kalimat untuk site, bukan perintah ke admin", () => {
    const presented = presentRestockRequestForMobile(
      makeSource({
        purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "ORDERED" },
        items: [makeItem({ purchasedQuantity: 10 })],
      }),
    );

    expect(presented.status).toEqual({
      kode: "PURCHASED",
      label: "Menunggu Barang",
      kalimat: "Semua barang sudah dibeli. Tinggal menunggu barangnya datang.",
    });
    expect(presented.barang[0].dibeli).toBe(10);
  });

  it("pengajuan ditolak berhenti di tahap persetujuan", () => {
    const presented = presentRestockRequestForMobile(
      makeSource({
        status: "REJECTED",
        purchaseOrder: null,
        items: [makeItem({ statusApproval: "PENDING" })],
      }),
    );

    expect(presented.status.label).toBe("Ditolak");
    expect(presented.tahap.berhentiDi).toBe(2);
    expect(presented.barang[0].isDitolak).toBe(true);
  });
});
