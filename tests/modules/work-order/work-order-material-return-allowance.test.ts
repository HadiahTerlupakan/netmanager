import { describe, expect, it, vi } from "vitest";

import { assertBatasPengembalian } from "@/modules/work-order/services/work-order-material-return-allowance";

/**
 * Endpoint pengembalian material dulu hanya memeriksa bahwa `jumlah` adalah
 * bilangan bulat positif — tanpa batas atas dan tanpa kaitan ke apa pun yang
 * pernah diambil. Setiap teknisi memegang `m_work_order:update`, jadi siapa pun
 * bisa menaikkan stok gudang sebanyak apa pun untuk barang apa pun di katalog.
 */

/**
 * `diambil` = jalur mobile (jsonb `usedMaterials`), `diambilAdmin` = jalur admin
 * (tabel `work_order_materials`). Keduanya dibaca karena tidak ada jalur yang
 * menulis ke dua-duanya.
 */
function buatKlien(opsi: {
  diambil?: { barangId: string; jumlah: number }[];
  diambilAdmin?: { barangId: string; jumlah: number }[];
  dikembalikan?: unknown;
}) {
  return {
    workOrderMaterial: {
      groupBy: vi.fn().mockResolvedValue(
        (opsi.diambilAdmin ?? []).map((d) => ({
          barangId: d.barangId,
          _sum: { quantity: d.jumlah },
        })),
      ),
    },
    workOrders: {
      findUnique: vi.fn().mockResolvedValue({
        usedMaterials: opsi.diambil ?? null,
        returnedMaterials: opsi.dikembalikan ?? null,
      }),
    },
  };
}

const WO_PEMASANGAN = {
  id: "wo-1",
  type: "INSTALLATION",
  workOrderNumber: "WO-0001",
};

const WO_PEMUTUSAN = { ...WO_PEMASANGAN, type: "DISCONNECTION" };

const BARANG = { barangId: "kabel", gudangId: "gudang-1" };

describe("batas pengembalian sisa material", () => {
  it("menolak pengembalian barang yang tidak pernah diambil", async () => {
    const klien = buatKlien({ diambil: [] });

    await expect(
      assertBatasPengembalian({
        klien: klien as never,
        workOrder: WO_PEMASANGAN,
        items: [{ ...BARANG, jumlah: 9999 }],
      }),
    ).rejects.toThrow(/tidak diambil pada WO-0001/);
  });

  // Jalur mobile mencatat pengambilan ke jsonb `usedMaterials`, jalur admin ke
  // tabel `work_order_materials`. Membaca satu saja membuat pengambilan dari
  // jalur lain tidak punya sisa sama sekali — persis yang terjadi saat QA:
  // teknisi mengambil 2 meter kabel lewat aplikasi lalu ditolak dengan alasan
  // "barang ini tidak diambil".
  it("menghitung pengambilan dari jalur mobile (jsonb usedMaterials)", async () => {
    const klien = buatKlien({ diambil: [{ barangId: "kabel", jumlah: 2 }] });

    await expect(
      assertBatasPengembalian({
        klien: klien as never,
        workOrder: WO_PEMASANGAN,
        items: [{ ...BARANG, jumlah: 2 }],
      }),
    ).resolves.toBeUndefined();
  });

  it("menjumlahkan pengambilan dari kedua jalur", async () => {
    const klien = buatKlien({
      diambil: [{ barangId: "kabel", jumlah: 2 }],
      diambilAdmin: [{ barangId: "kabel", jumlah: 3 }],
    });

    await expect(
      assertBatasPengembalian({
        klien: klien as never,
        workOrder: WO_PEMASANGAN,
        items: [{ ...BARANG, jumlah: 6 }],
      }),
    ).rejects.toThrow(/tinggal 5, diminta 6/);
  });

  it("menolak jumlah melebihi yang diambil", async () => {
    const klien = buatKlien({
      diambilAdmin: [{ barangId: "kabel", jumlah: 10 }],
    });

    await expect(
      assertBatasPengembalian({
        klien: klien as never,
        workOrder: WO_PEMASANGAN,
        items: [{ ...BARANG, jumlah: 11 }],
      }),
    ).rejects.toThrow(/tinggal 10, diminta 11/);
  });

  it("meloloskan jumlah yang masih dalam jatah", async () => {
    const klien = buatKlien({ diambil: [{ barangId: "kabel", jumlah: 10 }] });

    await expect(
      assertBatasPengembalian({
        klien: klien as never,
        workOrder: WO_PEMASANGAN,
        items: [{ ...BARANG, jumlah: 10 }],
      }),
    ).resolves.toBeUndefined();
  });

  // Tanpa ini, mengembalikan 10 lalu 10 lagi akan menaikkan stok dua kali
  // lipat dari yang pernah keluar.
  it("mengurangi jatah dengan yang sudah dikembalikan sebelumnya", async () => {
    const klien = buatKlien({
      diambil: [{ barangId: "kabel", jumlah: 10 }],
      dikembalikan: [{ barangId: "kabel", jumlah: 7, asal: "SISA_MATERIAL" }],
    });

    await expect(
      assertBatasPengembalian({
        klien: klien as never,
        workOrder: WO_PEMASANGAN,
        items: [{ ...BARANG, jumlah: 4 }],
      }),
    ).rejects.toThrow(/tinggal 3, diminta 4/);
  });

  // Tarikan pelanggan tidak berasal dari pengambilan, jadi ia tidak boleh ikut
  // memotong jatah sisa material.
  it("tarikan pelanggan tidak memotong jatah sisa material", async () => {
    const klien = buatKlien({
      diambil: [{ barangId: "kabel", jumlah: 10 }],
      dikembalikan: [
        { barangId: "kabel", jumlah: 10, asal: "TARIKAN_PELANGGAN" },
      ],
    });

    await expect(
      assertBatasPengembalian({
        klien: klien as never,
        workOrder: WO_PEMASANGAN,
        items: [{ ...BARANG, jumlah: 10 }],
      }),
    ).resolves.toBeUndefined();
  });

  // Satu permintaan bisa memuat barang yang sama dengan kondisi berbeda;
  // memeriksa per baris akan meloloskan 10 + 10 dari jatah 10.
  it("menjumlahkan beberapa baris barang yang sama", async () => {
    const klien = buatKlien({ diambil: [{ barangId: "kabel", jumlah: 10 }] });

    await expect(
      assertBatasPengembalian({
        klien: klien as never,
        workOrder: WO_PEMASANGAN,
        items: [
          { ...BARANG, jumlah: 6, kondisi: "BARU" },
          { ...BARANG, jumlah: 6, kondisi: "RUSAK" },
        ],
      }),
    ).rejects.toThrow(/tinggal 10, diminta 12/);
  });
});

describe("tarikan perangkat dari pelanggan", () => {
  it("ditolak pada work order yang bukan pemutusan atau relokasi", async () => {
    const klien = buatKlien({});

    await expect(
      assertBatasPengembalian({
        klien: klien as never,
        workOrder: WO_PEMASANGAN,
        items: [{ ...BARANG, jumlah: 1, asal: "TARIKAN_PELANGGAN" }],
      }),
    ).rejects.toThrow(/pemutusan atau relokasi/);
  });

  // Perangkat yang dicabut dari rumah pelanggan tidak pernah keluar dari
  // gudang, jadi tidak ada angka pengambilan untuk dibandingkan.
  it("diizinkan pada pemutusan walau tidak pernah diambil", async () => {
    const klien = buatKlien({ diambil: [] });

    await expect(
      assertBatasPengembalian({
        klien: klien as never,
        workOrder: WO_PEMUTUSAN,
        items: [{ ...BARANG, jumlah: 1, asal: "TARIKAN_PELANGGAN" }],
      }),
    ).resolves.toBeUndefined();
  });
});
