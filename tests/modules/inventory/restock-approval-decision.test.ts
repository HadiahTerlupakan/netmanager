import { describe, expect, it } from "vitest";

import {
  RESTOCK_APPROVAL_MESSAGES,
  resolveRestockApprovalDecision,
  type RestockApprovalBarangDecision,
  type RestockApprovalDecisionInput,
  type RestockApprovalJasaDecision,
} from "@/modules/inventory/domain/restock-approval-decision";

const barangLines = [
  {
    id: "item-1",
    barangId: "barang-1",
    barangNama: "Kabel Fiber",
    jumlah: 10,
    hargaPerUnit: 5000,
  },
  {
    id: "item-2",
    barangId: "barang-2",
    barangNama: "Konektor SC",
    jumlah: 4,
    hargaPerUnit: 2000,
  },
];

const jasaLines = [
  { id: "jasa-1", jasaNama: "Tarik Kabel", jumlah: 2, hargaPerUnit: 100000 },
];

function approveAll(): RestockApprovalBarangDecision[] {
  return barangLines.map((line) => ({
    itemId: line.id,
    keputusan: "APPROVED",
    jumlah: line.jumlah,
  }));
}

function approveJasa(): RestockApprovalJasaDecision[] {
  return [{ itemId: "jasa-1", keputusan: "APPROVED", jumlah: 2 }];
}

function resolve(overrides: Partial<RestockApprovalDecisionInput> = {}) {
  return resolveRestockApprovalDecision({
    barangLines,
    jasaLines,
    barangDecisions: approveAll(),
    jasaDecisions: approveJasa(),
    substituteBarangs: [],
    ...overrides,
  });
}

function expectFailure(
  result: ReturnType<typeof resolve>,
  code: "INVALID" | "CONFLICT",
): string {
  if (result.success === true) throw new Error("Keputusan seharusnya ditolak");
  expect(result.code).toBe(code);
  return result.error;
}

describe("resolveRestockApprovalDecision", () => {
  it("menyetujui semua baris apa adanya tanpa perubahan jumlah atau barang", () => {
    const result = resolve();

    expect(result.success).toBe(true);
    if (result.success === false) return;
    expect(result.data.barangLines).toEqual([
      expect.objectContaining({
        itemId: "item-1",
        statusApproval: "APPROVED",
        catatanApproval: null,
        jumlahDisetujui: 10,
        quantityChange: null,
        substitution: null,
      }),
      expect.objectContaining({ itemId: "item-2", quantityChange: null }),
    ]);
    expect(result.data.jasaLines[0]).toMatchObject({
      statusApproval: "APPROVED",
      quantityChange: null,
    });
  });

  it("menolak sebagian baris dengan catatan dan membiarkan jumlahnya", () => {
    const result = resolve({
      barangDecisions: [
        { itemId: "item-1", keputusan: "APPROVED", jumlah: 10 },
        { itemId: "item-2", keputusan: "REJECTED", catatan: "  Stok cukup  " },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success === false) return;
    expect(result.data.barangLines[1]).toMatchObject({
      statusApproval: "REJECTED",
      catatanApproval: "Stok cukup",
      jumlahDisetujui: 0,
      quantityChange: null,
      substitution: null,
    });
  });

  it("meminta alasan untuk baris yang ditolak", () => {
    const error = expectFailure(
      resolve({
        barangDecisions: [
          { itemId: "item-1", keputusan: "APPROVED", jumlah: 10 },
          { itemId: "item-2", keputusan: "REJECTED", catatan: "   " },
        ],
      }),
      "INVALID",
    );

    expect(error).toBe("Konektor SC: tulis alasan baris ini ditolak.");
  });

  it.each([
    ["turun", 6],
    ["naik", 12],
  ])(
    "mencatat jumlah diminta dan total baru saat jumlah %s",
    (_arah, jumlah) => {
      const result = resolve({
        barangDecisions: [
          {
            itemId: "item-1",
            keputusan: "APPROVED",
            jumlah,
            catatan: "Sesuai kebutuhan ODP",
          },
          { itemId: "item-2", keputusan: "APPROVED", jumlah: 4 },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success === false) return;
      expect(result.data.barangLines[0].quantityChange).toEqual({
        jumlah,
        jumlahDiminta: 10,
        totalHarga: jumlah * 5000,
      });
    },
  );

  it("meminta catatan bila jumlah diubah tanpa alasan, termasuk jasa", () => {
    const error = expectFailure(
      resolve({
        barangDecisions: [
          { itemId: "item-1", keputusan: "APPROVED", jumlah: 6 },
          { itemId: "item-2", keputusan: "APPROVED", jumlah: 4 },
        ],
        jasaDecisions: [{ itemId: "jasa-1", keputusan: "APPROVED", jumlah: 1 }],
      }),
      "INVALID",
    );

    expect(error.split("\n")).toEqual([
      "Kabel Fiber: tulis catatan kenapa jumlahnya diubah dari 10 menjadi 6.",
      "Tarik Kabel: tulis catatan kenapa jumlahnya diubah dari 2 menjadi 1.",
    ]);
  });

  it("mengganti barang dengan barang lain di tenant yang sama", () => {
    const result = resolve({
      barangDecisions: [
        {
          itemId: "item-1",
          keputusan: "APPROVED",
          jumlah: 10,
          barangIdPengganti: "barang-9",
          catatan: "Merek lama tidak dijual lagi",
        },
        { itemId: "item-2", keputusan: "APPROVED", jumlah: 4 },
      ],
      substituteBarangs: [{ id: "barang-9", nama: "Kabel Fiber Merek B" }],
    });

    expect(result.success).toBe(true);
    if (result.success === false) return;
    expect(result.data.barangLines[0].substitution).toEqual({
      barangId: "barang-9",
      barangNama: "Kabel Fiber Merek B",
      barangIdDiminta: "barang-1",
    });
  });

  it("meminta catatan saat barang diganti tanpa alasan", () => {
    const error = expectFailure(
      resolve({
        barangDecisions: [
          {
            itemId: "item-1",
            keputusan: "APPROVED",
            jumlah: 10,
            barangIdPengganti: "barang-9",
          },
          { itemId: "item-2", keputusan: "APPROVED", jumlah: 4 },
        ],
        substituteBarangs: [{ id: "barang-9", nama: "Kabel Fiber Merek B" }],
      }),
      "INVALID",
    );

    expect(error).toBe("Kabel Fiber: tulis catatan kenapa barangnya diganti.");
  });

  it("menolak pengganti yang sudah ada di baris lain", () => {
    const error = expectFailure(
      resolve({
        barangDecisions: [
          {
            itemId: "item-1",
            keputusan: "APPROVED",
            jumlah: 10,
            barangIdPengganti: "barang-2",
            catatan: "Ganti",
          },
          { itemId: "item-2", keputusan: "APPROVED", jumlah: 4 },
        ],
        substituteBarangs: [{ id: "barang-2", nama: "Konektor SC" }],
      }),
      "INVALID",
    );

    expect(error).toContain("Kabel Fiber: Konektor SC sudah ada di baris lain");
  });

  it("menolak dua baris yang diganti ke barang yang sama", () => {
    const error = expectFailure(
      resolve({
        barangDecisions: [
          {
            itemId: "item-1",
            keputusan: "APPROVED",
            jumlah: 10,
            barangIdPengganti: "barang-9",
            catatan: "Ganti",
          },
          {
            itemId: "item-2",
            keputusan: "APPROVED",
            jumlah: 4,
            barangIdPengganti: "barang-9",
            catatan: "Ganti",
          },
        ],
        substituteBarangs: [{ id: "barang-9", nama: "Barang B" }],
      }),
      "INVALID",
    );

    expect(error.split("\n")).toHaveLength(2);
  });

  it("membolehkan pengganti yang sama dengan barang di baris yang ditolak", () => {
    const result = resolve({
      barangDecisions: [
        {
          itemId: "item-1",
          keputusan: "APPROVED",
          jumlah: 10,
          barangIdPengganti: "barang-2",
          catatan: "Pakai konektor saja",
        },
        { itemId: "item-2", keputusan: "REJECTED", catatan: "Digabung" },
      ],
      substituteBarangs: [{ id: "barang-2", nama: "Konektor SC" }],
    });

    expect(result.success).toBe(true);
  });

  it("menolak pengganti yang sama dengan barang yang diminta", () => {
    const error = expectFailure(
      resolve({
        barangDecisions: [
          {
            itemId: "item-1",
            keputusan: "APPROVED",
            jumlah: 10,
            barangIdPengganti: "barang-1",
            catatan: "Ganti",
          },
          { itemId: "item-2", keputusan: "APPROVED", jumlah: 4 },
        ],
      }),
      "INVALID",
    );

    expect(error).toContain("Kabel Fiber: barang pengganti sama dengan");
  });

  it("menolak pengganti dari tenant lain (tidak ditemukan pada pencarian tenant)", () => {
    const error = expectFailure(
      resolve({
        barangDecisions: [
          {
            itemId: "item-1",
            keputusan: "APPROVED",
            jumlah: 10,
            barangIdPengganti: "barang-tenant-lain",
            catatan: "Ganti",
          },
          { itemId: "item-2", keputusan: "APPROVED", jumlah: 4 },
        ],
        substituteBarangs: [],
      }),
      "INVALID",
    );

    expect(error).toContain("Kabel Fiber: barang pengganti tidak ditemukan");
  });

  it("menolak keputusan bila semua baris ditolak", () => {
    const error = expectFailure(
      resolve({
        barangDecisions: barangLines.map((line) => ({
          itemId: line.id,
          keputusan: "REJECTED" as const,
          catatan: "Tidak perlu",
        })),
        jasaDecisions: [
          { itemId: "jasa-1", keputusan: "REJECTED", catatan: "Tidak perlu" },
        ],
      }),
      "CONFLICT",
    );

    expect(error).toBe(RESTOCK_APPROVAL_MESSAGES.allRejected);
  });

  it.each([
    ["baris hilang", [{ itemId: "item-1", keputusan: "APPROVED", jumlah: 10 }]],
    [
      "baris asing",
      [
        { itemId: "item-1", keputusan: "APPROVED", jumlah: 10 },
        { itemId: "item-x", keputusan: "APPROVED", jumlah: 4 },
      ],
    ],
    [
      "baris ganda",
      [
        { itemId: "item-1", keputusan: "APPROVED", jumlah: 10 },
        { itemId: "item-1", keputusan: "APPROVED", jumlah: 10 },
      ],
    ],
  ] as const)(
    "menganggap isi pengajuan berubah bila %s",
    (_kasus, barangDecisions) => {
      const error = expectFailure(
        resolve({ barangDecisions: [...barangDecisions] }),
        "CONFLICT",
      );
      expect(error).toBe(RESTOCK_APPROVAL_MESSAGES.linesChanged);
    },
  );

  it("menganggap isi berubah bila jasa tidak ikut diputuskan", () => {
    const error = expectFailure(resolve({ jasaDecisions: [] }), "CONFLICT");
    expect(error).toBe(RESTOCK_APPROVAL_MESSAGES.linesChanged);
  });

  it("mengabaikan pengganti pada baris yang ditolak", () => {
    const result = resolve({
      barangDecisions: [
        { itemId: "item-1", keputusan: "APPROVED", jumlah: 10 },
        {
          itemId: "item-2",
          keputusan: "REJECTED",
          barangIdPengganti: "barang-9",
          catatan: "Tidak perlu",
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success === false) return;
    expect(result.data.barangLines[1].substitution).toBeNull();
  });
});
