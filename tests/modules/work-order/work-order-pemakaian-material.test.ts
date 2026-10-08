import { describe, expect, it, vi } from "vitest";

import { catatPemakaianMaterial } from "@/modules/work-order/services/work-order-pemakaian-material";

/**
 * `usedMaterials` — meski namanya begitu — berisi barang yang DIAMBIL dari
 * gudang. Sebelum ada `consumedMaterials`, tidak ada satu pun tempat yang
 * mencatat berapa yang akhirnya terpasang: ambil 10 meter kabel, pasang 7, dan
 * selisih 3 meter itu lenyap dari pembukuan.
 */

function buatTransaksi(opsi: {
  diambil?: { barangId: string; jumlah: number }[];
  dipakai?: { barangId: string; jumlah: number }[];
  dikembalikan?: unknown;
  barang?: { id: string; nama: string; satuan: string }[];
}) {
  const executeRaw = vi.fn().mockResolvedValue(1);
  return {
    executeRaw,
    transaction: {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRaw: executeRaw,
      workOrders: {
        findUnique: vi.fn().mockResolvedValue({
          usedMaterials: opsi.diambil ?? null,
          consumedMaterials: opsi.dipakai ?? null,
          returnedMaterials: opsi.dikembalikan ?? null,
        }),
      },
      workOrderMaterial: { groupBy: vi.fn().mockResolvedValue([]) },
      barang: {
        findMany: vi
          .fn()
          .mockResolvedValue(
            opsi.barang ?? [{ id: "kabel", nama: "Kabel", satuan: "meter" }],
          ),
      },
    },
  };
}

const DASAR = { workOrderId: "wo-1", tenantId: "tenant-1" };

describe("catat pemakaian material", () => {
  it("mencatat pemakaian yang masih dalam genggaman", async () => {
    const { transaction, executeRaw } = buatTransaksi({
      diambil: [{ barangId: "kabel", jumlah: 10 }],
    });

    const hasil = await catatPemakaianMaterial({
      transaction: transaction as never,
      ...DASAR,
      items: [{ barangId: "kabel", jumlah: 7 }],
    });

    expect(hasil).toEqual([
      { barangId: "kabel", jumlah: 7, nama: "Kabel", satuan: "meter" },
    ]);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  // Memasang lebih banyak daripada yang dibawa berarti angkanya salah ketik
  // atau barangnya dari tempat lain — keduanya tidak boleh diam-diam diterima.
  it("menolak pemakaian melebihi yang dipegang", async () => {
    const { transaction } = buatTransaksi({
      diambil: [{ barangId: "kabel", jumlah: 10 }],
    });

    await expect(
      catatPemakaianMaterial({
        transaction: transaction as never,
        ...DASAR,
        items: [{ barangId: "kabel", jumlah: 11 }],
      }),
    ).rejects.toThrow(/tinggal 10, dicatat terpasang 11/);
  });

  it("yang sudah dikembalikan tidak lagi bisa dicatat terpasang", async () => {
    const { transaction } = buatTransaksi({
      diambil: [{ barangId: "kabel", jumlah: 10 }],
      dikembalikan: [{ barangId: "kabel", jumlah: 4, asal: "SISA_MATERIAL" }],
    });

    await expect(
      catatPemakaianMaterial({
        transaction: transaction as never,
        ...DASAR,
        items: [{ barangId: "kabel", jumlah: 7 }],
      }),
    ).rejects.toThrow(/tinggal 6, dicatat terpasang 7/);
  });

  // Tarikan pelanggan tidak pernah berasal dari pengambilan, jadi ia tidak
  // mengurangi apa yang dipegang teknisi.
  it("tarikan pelanggan tidak mengurangi genggaman", async () => {
    const { transaction } = buatTransaksi({
      diambil: [{ barangId: "kabel", jumlah: 10 }],
      dikembalikan: [
        { barangId: "kabel", jumlah: 10, asal: "TARIKAN_PELANGGAN" },
      ],
    });

    await expect(
      catatPemakaianMaterial({
        transaction: transaction as never,
        ...DASAR,
        items: [{ barangId: "kabel", jumlah: 10 }],
      }),
    ).resolves.toHaveLength(1);
  });

  it("pencatatan berulang menumpuk, bukan menimpa", async () => {
    const { transaction } = buatTransaksi({
      diambil: [{ barangId: "kabel", jumlah: 10 }],
      dipakai: [{ barangId: "kabel", jumlah: 8 }],
    });

    await expect(
      catatPemakaianMaterial({
        transaction: transaction as never,
        ...DASAR,
        items: [{ barangId: "kabel", jumlah: 3 }],
      }),
    ).rejects.toThrow(/tinggal 2, dicatat terpasang 3/);
  });

  it("daftar kosong tidak menulis apa pun", async () => {
    const { transaction, executeRaw } = buatTransaksi({});

    await expect(
      catatPemakaianMaterial({
        transaction: transaction as never,
        ...DASAR,
        items: [{ barangId: "kabel", jumlah: 0 }],
      }),
    ).resolves.toEqual([]);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  // Barang yang tidak pernah diambil untuk WO ini tidak mungkin terpasang
  // darinya; pesannya harus menyebut sebab yang benar.
  it("menolak barang yang tidak pernah dibawa", async () => {
    const { transaction } = buatTransaksi({ diambil: [] });

    await expect(
      catatPemakaianMaterial({
        transaction: transaction as never,
        ...DASAR,
        items: [{ barangId: "kabel", jumlah: 1 }],
      }),
    ).rejects.toThrow(/tidak ada di tangan Anda/);
  });
});
