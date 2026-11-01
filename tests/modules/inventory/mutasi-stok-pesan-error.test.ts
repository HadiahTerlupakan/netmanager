import { beforeEach, describe, expect, it, vi } from "vitest";

const loggerError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn() },
}));

import { InventoryUserError } from "@/modules/inventory/domain/inventory-user-error";
import { InventoryOpnameApiRepository } from "@/modules/inventory/repositories/InventoryOpnameApiRepository";
import { updateMasuk } from "@/modules/inventory/repositories/inventory-repository-masuk-helpers";
import { assertPositiveIntegerQuantity } from "@/modules/inventory/repositories/inventory-stock-helpers";
import { removeInventoryStock } from "@/modules/inventory/repositories/inventory-stock-out-helpers";
import { toInventoryMutationFailure } from "@/modules/inventory/services/inventory-mutation-errors";
import { validateInventoryMutationCreateBody } from "@/modules/inventory/services/inventory-route-validation.helpers";
import { describeGudangAccessDenial } from "@/modules/inventory/utils/validation";

/**
 * Pesan barang masuk/keluar dibaca staf gudang: harus menyebut barang, gudang,
 * angka, dan langkah berikutnya — bukan "Stok tidak mencukupi (Tersedia: 3)".
 */

const KABEL = { nama: "Kabel Drop", satuan: "roll" };
const GUDANG = { nama: "Gudang Utama" };

function buildStockOutTx(stock: Record<string, unknown> | null) {
  return {
    barangGudang: {
      findUnique: vi.fn().mockResolvedValue(stock),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    barang: { findUnique: vi.fn().mockResolvedValue({ nama: KABEL.nama }) },
    gudang: { findUnique: vi.fn().mockResolvedValue({ nama: GUDANG.nama }) },
    barangKeluar: { create: vi.fn() },
    asset: { findMany: vi.fn(), updateMany: vi.fn() },
  };
}

function stockRow(overrides: Record<string, number>) {
  return {
    id: "bg-1",
    stok: 3,
    stokBaru: 3,
    stokBekas: 0,
    stokRusak: 0,
    barang: KABEL,
    gudang: GUDANG,
    ...overrides,
  };
}

async function messageOfStockOut(
  tx: ReturnType<typeof buildStockOutTx>,
  data: { jumlah: number; kondisi?: string },
) {
  const error = await removeInventoryStock({
    tx: tx as never,
    data: { barangId: "b1", gudangId: "g1", userId: "u1", ...data } as never,
  }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(InventoryUserError);
  return error as InventoryUserError;
}

describe("pesan barang keluar", () => {
  it("stok total kurang: sebut barang, gudang, sisa, dan batasnya", async () => {
    const error = await messageOfStockOut(buildStockOutTx(stockRow({})), {
      jumlah: 5,
    });

    expect(error.status).toBe(400);
    expect(error.message).toBe(
      "Stok Kabel Drop di Gudang Utama tinggal 3 roll, tapi Anda mau mengeluarkan 5 roll. Kurangi jumlahnya, paling banyak 3.",
    );
  });

  it("stok per kondisi kurang: sebut kondisinya dan sarankan kondisi lain", async () => {
    const tx = buildStockOutTx(
      stockRow({ stok: 10, stokBaru: 8, stokBekas: 2 }),
    );
    const error = await messageOfStockOut(tx, { jumlah: 4, kondisi: "BEKAS" });

    expect(error.message).toBe(
      "Stok Kabel Drop kondisi Bekas di Gudang Utama tinggal 2 roll, tapi Anda mau mengeluarkan 4 roll. Kurangi jumlahnya, atau pilih kondisi lain yang stoknya cukup.",
    );
  });

  it("barang belum pernah ada di gudang itu", async () => {
    const error = await messageOfStockOut(buildStockOutTx(null), { jumlah: 1 });

    expect(error.status).toBe(400);
    expect(error.message).toBe(
      "Kabel Drop tidak ada di Gudang Utama, jadi tidak bisa dikeluarkan dari sana. Pilih gudang yang memang menyimpan barang ini.",
    );
  });

  it("barangnya sendiri sudah dihapus: 404 dan suruh muat ulang", async () => {
    const tx = buildStockOutTx(null);
    tx.barang.findUnique.mockResolvedValue(null);
    const error = await messageOfStockOut(tx, { jumlah: 1 });

    expect(error.status).toBe(404);
    expect(error.message).toBe(
      "Barang yang dipilih tidak ditemukan, mungkin sudah dihapus. Muat ulang halaman, lalu pilih lagi.",
    );
  });

  it("stok berubah bersamaan dengan orang lain: 409 dan suruh muat ulang", async () => {
    const tx = buildStockOutTx(stockRow({}));
    tx.barangGudang.updateMany.mockResolvedValue({ count: 0 });
    const error = await messageOfStockOut(tx, { jumlah: 2 });

    expect(error.status).toBe(409);
    expect(error.message).toContain("baru saja berubah");
    expect(error.message).toContain("Muat ulang halaman");
  });

  it("menaikkan jumlah di catatan lama melebihi stok: sebut batas atasnya", async () => {
    const tx = {
      barangKeluar: {
        findUnique: vi.fn().mockResolvedValue({
          barangId: "b1",
          gudangId: "g1",
          jumlah: 4,
          kondisi: "BARU",
          barang: KABEL,
          gudang: GUDANG,
        }),
      },
      barangGudang: {
        findUnique: vi.fn().mockResolvedValue({ stok: 2, stokBaru: 2 }),
      },
    };
    const db = { $transaction: (run: (t: unknown) => unknown) => run(tx) };
    const repository = new InventoryOpnameApiRepository(db as never);

    const error = await repository
      .updateKeluarRecord({ id: "k1", jumlah: 9 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InventoryUserError);
    expect((error as Error).message).toBe(
      "Jumlah Kabel Drop tidak bisa dinaikkan sebanyak itu. Stok Kabel Drop kondisi Baru di Gudang Utama tinggal 2 roll. Isi jumlah paling banyak 6.",
    );
  });
});

describe("pesan barang masuk", () => {
  it("mengurangi jumlah di bawah yang sudah terpakai: sebut jumlah paling sedikit", async () => {
    const tx = {
      barangMasuk: {
        findUnique: vi.fn().mockResolvedValue({
          barangId: "b1",
          gudangId: "g1",
          jumlah: 10,
          kondisi: "BARU",
          barang: KABEL,
          gudang: GUDANG,
        }),
        update: vi.fn(),
      },
      barangGudang: {
        findUnique: vi.fn().mockResolvedValue({ stok: 3, stokBaru: 3 }),
        update: vi.fn(),
      },
    };
    const db = { $transaction: (run: (t: unknown) => unknown) => run(tx) };

    const error = await updateMasuk(
      db as never,
      {
        id: "m1",
        jumlah: 2,
      } as never,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InventoryUserError);
    expect((error as Error).message).toBe(
      "Jumlah Kabel Drop tidak bisa dikurangi sebanyak itu. Sebagian barang dari catatan ini sudah dipakai atau dikeluarkan, stok Kabel Drop di Gudang Utama tinggal 3 roll. Isi jumlah paling sedikit 7.",
    );
  });
});

describe("isian form barang masuk/keluar", () => {
  it("melaporkan semua yang salah sekaligus, satu per baris", () => {
    const result = validateInventoryMutationCreateBody({
      jumlah: "2,5",
      kondisi: "cacat",
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error: [
        "Barang belum dipilih. Pilih barangnya dulu.",
        "Gudang belum dipilih. Pilih gudangnya dulu.",
        "Jumlah harus angka bulat, tanpa koma atau titik. Contoh: 1, 2, atau 10.",
        "Kondisi barang tidak dikenal. Pilih salah satu: Baru, Bekas, atau Rusak.",
      ].join("\n"),
    });
  });

  it.each([
    [undefined, "Jumlah belum diisi. Isi berapa banyak barangnya, contoh: 5."],
    [
      1.5,
      "Jumlah harus angka bulat, tanpa koma atau titik. Contoh: 1, 2, atau 10.",
    ],
    ["lima", "Jumlah harus diisi angka, contoh: 5."],
    [-2, "Jumlah harus lebih dari 0."],
  ])("jumlah %s", (jumlah, pesan) => {
    const result = validateInventoryMutationCreateBody({
      barangId: "b1",
      gudangId: "g1",
      jumlah,
    });
    expect(result?.error).toBe(pesan);
  });

  it("jumlah berkoma ditolak sebagai kesalahan staf, bukan error server", () => {
    expect(() => assertPositiveIntegerQuantity(2.5)).toThrow(
      InventoryUserError,
    );
  });
});

describe("toInventoryMutationFailure", () => {
  beforeEach(() => loggerError.mockClear());

  it("meneruskan pesan InventoryUserError beserta statusnya", () => {
    expect(
      toInventoryMutationFailure(
        new InventoryUserError("Pesan staf", 409),
        "Barang keluar",
      ),
    ).toEqual({ success: false, status: 409, error: "Pesan staf" });
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("barang/gudang hilang di tengah jalan (foreign key) jadi 400 yang jelas", () => {
    const result = toInventoryMutationFailure(
      Object.assign(new Error("Foreign key constraint failed"), {
        code: "P2003",
      }),
      "Barang masuk",
    );
    expect(result.status).toBe(400);
    expect(result.error).toContain("sudah tidak ada");
  });

  it("error tak dikenal: catat di log, staf dapat pesan aman tanpa detail teknis", () => {
    const result = toInventoryMutationFailure(
      new Error("connection terminated unexpectedly"),
      "Barang keluar",
    );

    expect(result).toEqual({
      success: false,
      status: 500,
      error:
        "Barang keluar belum tersimpan karena ada gangguan di server. Stok tidak berubah. Coba simpan sekali lagi; kalau tetap gagal, laporkan ke admin.",
    });
    expect(loggerError).toHaveBeenCalledOnce();
  });
});

describe("describeGudangAccessDenial", () => {
  it.each([
    [
      "Anda tidak memiliki akses ke Gudang ini (Beda Site).",
      "Gudang ini milik site lain, jadi Anda tidak bisa memakainya. Pilih gudang di site Anda, atau minta admin menambahkan site gudang ini ke akun Anda.",
    ],
    [
      "User tidak memiliki Site yang ditugaskan namun dibatasi aksesnya per Site.",
      "Akun Anda belum diberi site, jadi belum bisa memakai gudang mana pun. Minta admin mengatur site di akun Anda.",
    ],
    [
      "Gudang tidak ditemukan.",
      "Gudang yang dipilih tidak ditemukan, mungkin sudah dihapus. Muat ulang halaman, lalu pilih gudang lagi.",
    ],
    [
      undefined,
      "Anda tidak punya izin memakai gudang ini. Minta admin memeriksa hak akses akun Anda.",
    ],
  ])("%s", (asli, pesan) => {
    expect(describeGudangAccessDenial(asli)).toBe(pesan);
  });
});

describe("route service masuk/keluar meneruskan pesan, tidak melempar", () => {
  const ACCESS = {
    id: "k1",
    userId: "u1",
    permissions: [] as string[],
    isSuperAdmin: true,
  };

  it("barang keluar: stok kurang sampai ke staf sebagai 400 berpesan jelas", async () => {
    const { InventoryKeluarRouteService } =
      await import("@/modules/inventory/services/InventoryKeluarRouteService");
    const pesan = "Stok Kabel Drop di Gudang Utama tinggal 3 roll, ...";
    const service = new InventoryKeluarRouteService(
      {
        removeStock: vi.fn().mockRejectedValue(new InventoryUserError(pesan)),
      } as never,
      {} as never,
    );

    const result = await service.createKeluar({
      userId: "u1",
      body: { barangId: "b1", gudangId: "g1", jumlah: 5 },
    });

    expect(result).toEqual({ success: false, status: 400, error: pesan });
  });

  it("ubah barang keluar yang sudah dihapus: 404 dengan pesan, bukan error mentah", async () => {
    const { InventoryKeluarRouteService } =
      await import("@/modules/inventory/services/InventoryKeluarRouteService");
    const service = new InventoryKeluarRouteService(
      {} as never,
      {
        getKeluarRecordWithSite: vi.fn().mockResolvedValue(null),
        resolveRestrictedSiteId: vi.fn(),
      } as never,
    );

    const result = await service.updateKeluar({
      ...ACCESS,
      body: { jumlah: 1 },
    });

    expect(result).toEqual({
      success: false,
      status: 404,
      error:
        "Catatan barang keluar ini tidak ditemukan, mungkin sudah dihapus orang lain. Muat ulang halaman.",
    });
  });

  it("ubah barang masuk dengan kondisi asal-asalan: 400, bukan error database", async () => {
    const { InventoryMasukRouteService } =
      await import("@/modules/inventory/services/InventoryMasukRouteService");
    const stockMovementService = {
      getMasukRecord: vi.fn().mockResolvedValue({
        id: "m1",
        jumlah: 2,
        barang: { nama: "Kabel Drop" },
        gudang: { nama: "Gudang Utama", sites: [] },
      }),
      updateMasuk: vi.fn(),
    };
    const service = new InventoryMasukRouteService(
      {} as never,
      { resolveRestrictedSiteId: vi.fn() } as never,
      stockMovementService as never,
    );

    const result = await service.updateMasuk({
      ...ACCESS,
      id: "m1",
      body: { jumlah: 3, kondisi: "cacat" },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error:
        "Kondisi barang tidak dikenal. Pilih salah satu: Baru, Bekas, atau Rusak.",
    });
    expect(stockMovementService.updateMasuk).not.toHaveBeenCalled();
  });
});
