import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  describeClientError,
  readApiErrorMessage,
} from "@/components/inventory/master-data/masterDataErrorMessage";
import { BarangKodeDipakaiError } from "@/modules/inventory/services/inventory-barang.service-helpers";
import { InventoryBarangRouteService } from "@/modules/inventory/services/InventoryBarangRouteService";
import { InventoryGudangRouteService } from "@/modules/inventory/services/InventoryGudangRouteService";
import { JasaService } from "@/modules/inventory/services/JasaService";
import {
  AssetRuleError,
  translateAssetError,
} from "@/modules/inventory/services/AssetService";
import {
  describeZodIssues,
  getPrismaErrorCode,
} from "@/modules/inventory/services/inventory-master-data-errors";
import { createAssetSchema } from "@/modules/inventory/validators/assetValidator";

/**
 * Pesan error master data dibaca staf gudang. Tiap pesan harus menyebut apa
 * yang salah, di mana, dan apa yang harus dilakukan — tanpa istilah teknis —
 * dan kesalahan staf tidak boleh jatuh ke status 500.
 */
function prismaError(code: string) {
  return Object.assign(new Error(`Invalid invocation ... ${code}`), { code });
}

const barang = {
  id: "barang-1",
  kode: "BRG-1",
  nama: "Kabel Drop",
  satuan: "meter",
  barangGudang: [] as Array<{ stok: number }>,
};

/** Super admin tidak dibatasi site, jadi tidak ada query lingkup yang perlu dipalsukan. */
const PENGGUNA_TANPA_BATAS = {
  userId: "user-1",
  permissions: [] as string[],
  isSuperAdmin: true,
};

describe("InventoryBarangRouteService — pesan error", () => {
  it("create: semua kolom wajib yang kosong dilaporkan sekaligus", async () => {
    const service = new InventoryBarangRouteService(
      {} as never,
      { createBarang: vi.fn() } as never,
    );

    const result = await service.createBarang({ userId: "u", body: {} });

    expect(result).toMatchObject({
      success: false,
      status: 400,
      error:
        "Nama barang belum diisi. Tulis nama barangnya, contoh: Kabel Drop 1 Core.\n" +
        "Satuan barang belum diisi. Tulis satuannya, contoh: pcs, meter, roll.",
    });
  });

  it("create: kode yang sudah dipakai → 409 dengan kodenya, bukan 500", async () => {
    const service = new InventoryBarangRouteService(
      {} as never,
      {
        createBarang: vi
          .fn()
          .mockRejectedValue(new BarangKodeDipakaiError("KBL-01")),
      } as never,
    );

    const result = await service.createBarang({
      userId: "u",
      body: { nama: "Kabel", satuan: "meter", kode: "KBL-01" },
    });

    expect(result).toEqual({
      success: false,
      status: 409,
      error:
        'Kode barang "KBL-01" sudah dipakai barang lain. Pakai kode lain, atau kosongkan kolom kode supaya dibuat otomatis.',
    });
  });

  it("create: error database tak dikenal tidak dibocorkan ke staf", async () => {
    const service = new InventoryBarangRouteService(
      {} as never,
      {
        createBarang: vi
          .fn()
          .mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432")),
      } as never,
    );

    const result = await service.createBarang({
      userId: "u",
      body: { nama: "Kabel", satuan: "meter" },
    });

    expect(result).toEqual({
      success: false,
      status: 500,
      error:
        "Barang belum tersimpan karena ada gangguan di server. Coba sekali lagi. Kalau tetap gagal, laporkan ke admin.",
    });
  });

  it("update: satuan tidak bisa diganti saat stok masih ada → 400 dengan langkahnya", async () => {
    const service = new InventoryBarangRouteService({
      findBarangById: vi.fn().mockResolvedValue(barang),
      findBarangByKode: vi.fn().mockResolvedValue(null),
      updateBarang: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Satuan barang tidak boleh diubah saat stok masih tersedia",
          ),
        ),
    } as never);

    const result = await service.updateBarang({
      id: "barang-1",
      pengguna: PENGGUNA_TANPA_BATAS,
      body: { kode: "BRG-1", nama: "Kabel Drop", satuan: "roll" },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      error:
        "Satuan barang tidak bisa diganti karena barang ini masih punya stok. Keluarkan atau pindahkan stoknya dulu sampai habis, baru ganti satuannya.",
    });
  });

  it("delete: barang yang sudah dipakai transaksi menyebut nama barangnya", async () => {
    const service = new InventoryBarangRouteService({
      findBarangById: vi.fn().mockResolvedValue(barang),
      deleteBarang: vi.fn().mockRejectedValue(prismaError("P2003")),
    } as never);

    const result = await service.deleteBarang({
      id: "barang-1",
      pengguna: PENGGUNA_TANPA_BATAS,
    });

    expect(result).toMatchObject({ success: false, status: 409 });
    expect(result.success === false && result.error).toContain(
      'Barang "Kabel Drop" tidak bisa dihapus',
    );
  });

  it("pesan 404 selalu memuat 'tidak ditemukan' agar tidak digandakan ApiErrors.notFound", async () => {
    const service = new InventoryBarangRouteService({
      findBarangById: vi.fn().mockResolvedValue(null),
    } as never);

    const result = await service.deleteBarang({
      id: "hilang",
      pengguna: PENGGUNA_TANPA_BATAS,
    });

    expect(result.success === false && result.error).toBe(
      "Barang tidak ditemukan. Mungkin sudah dihapus. Muat ulang halaman, lalu coba lagi.",
    );
  });
});

describe("InventoryGudangRouteService — pesan error", () => {
  function createService(overrides: Record<string, unknown> = {}) {
    const repository = {
      findGudangById: vi.fn().mockResolvedValue({
        id: "g1",
        kode: "GD1",
        nama: "Gudang Utama",
        isActive: true,
      }),
      findGudangByKode: vi.fn().mockResolvedValue(null),
      hasStockInGudang: vi.fn().mockResolvedValue(false),
      deleteGudang: vi.fn(),
      ...overrides,
    };
    return new InventoryGudangRouteService(
      repository as never,
      {
        resolveLingkupSite: vi.fn().mockResolvedValue({ dibatasi: false }),
        canAccessGudang: vi.fn().mockResolvedValue(true),
      } as never,
    );
  }

  it("delete: gudang yang punya riwayat transaksi disarankan dinonaktifkan", async () => {
    const service = createService({
      deleteGudang: vi.fn().mockRejectedValue(prismaError("P2003")),
    });

    const result = await service.deleteGudang({
      id: "g1",
      pengguna: PENGGUNA_TANPA_BATAS,
    });

    expect(result).toMatchObject({ success: false, status: 409 });
    expect(result.success === false && result.error).toBe(
      'Gudang "Gudang Utama" tidak bisa dihapus karena sudah punya catatan, misalnya barang masuk, barang keluar, atau pindah barang. Catatan itu harus tetap ada. Kalau gudang ini tidak dipakai lagi, nonaktifkan saja lewat tombol Edit.',
    );
  });

  it("update: kode dan nama kosong dilaporkan sekaligus", async () => {
    const service = createService();

    const result = await service.updateGudang({
      id: "g1",
      pengguna: PENGGUNA_TANPA_BATAS,
      body: { kode: " ", nama: "" },
    });

    expect(result.success === false && result.error).toBe(
      "Kode gudang belum diisi. Tulis kode gudangnya.\n" +
        "Nama gudang belum diisi. Tulis nama gudangnya, contoh: Gudang Utama.",
    );
  });
});

describe("JasaService — pesan error", () => {
  it("kode berhuruf kecil yang sudah ada dalam huruf besar ditolak 409, bukan crash database", async () => {
    const repository = {
      findByKode: vi.fn(async (kode: string) =>
        kode === "JSA-01" ? { id: "j0", nama: "Tarik Kabel" } : null,
      ),
      create: vi.fn(),
    };
    const service = new JasaService(repository as never);

    const result = await service.create({
      userId: "u",
      body: { nama: "Pasang Tiang", kode: "jsa-01" },
    });

    expect(repository.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      status: 409,
      error:
        'Kode jasa "JSA-01" sudah dipakai jasa "Tarik Kabel". Pakai kode lain, atau kosongkan kolom kode supaya dibuat otomatis.',
    });
  });

  it("supplier yang sudah dihapus dijelaskan, bukan 500", async () => {
    const service = new JasaService({
      findByKode: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockRejectedValue(prismaError("P2003")),
    } as never);

    const result = await service.create({
      userId: "u",
      body: { nama: "Pasang Tiang", supplierId: "s-hapus" },
    });

    expect(result).toMatchObject({ success: false, status: 400 });
    expect(result.success === false && result.error).toContain(
      "Supplier yang dipilih tidak ditemukan",
    );
  });
});

describe("aset — pesan error", () => {
  const asetValid = {
    barangId: "b1",
    kodeAsset: "AST-1",
    purchaseDate: "2026-10-01",
    purchasePrice: 1_000_000,
    usefulLife: 36,
  };

  it("nilai sisa lebih besar dari harga beli ditolak dengan angkanya", () => {
    const parsed = createAssetSchema.safeParse({
      ...asetValid,
      residualValue: 2_000_000,
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error && describeZodIssues(parsed.error).error).toBe(
      "Nilai sisa (Rp 2.000.000) lebih besar dari harga beli (Rp 1.000.000). Nilai sisa harus sama atau lebih kecil dari harga beli.",
    );
  });

  it("form kosong: semua masalah dilaporkan sekaligus, per kolom", () => {
    const parsed = createAssetSchema.safeParse({
      barangId: "",
      kodeAsset: "",
      purchaseDate: "bukan tanggal",
      purchasePrice: Number.NaN,
      usefulLife: 0,
    });
    expect(parsed.success).toBe(false);
    const failure = describeZodIssues(parsed.error!);
    expect(failure.error.split("\n")).toEqual([
      "Barang belum dipilih. Pilih barangnya dulu.",
      "Kode aset belum diisi. Tulis kode asetnya.",
      "Tanggal beli tidak terbaca. Pilih tanggalnya dari kalender.",
      "Harga beli harus diisi angka. Contoh: 2500000.",
      "Umur pakai minimal 1 bulan.",
    ]);
    expect(Object.keys(failure.details ?? {})).toEqual([
      "barangId",
      "kodeAsset",
      "purchaseDate",
      "purchasePrice",
      "usefulLife",
    ]);
  });

  it("kode aset bentrok → 409; aturan aset memakai status dan pesannya sendiri", () => {
    const fallback = { message: "x", logContext: "x" };
    expect(translateAssetError(prismaError("P2002"), fallback)).toEqual({
      success: false,
      status: 409,
      error: "Kode aset itu sudah dipakai aset lain. Pakai kode lain.",
    });
    expect(
      translateAssetError(
        new AssetRuleError("Aturan dilanggar.", 404),
        fallback,
      ),
    ).toEqual({
      success: false,
      status: 404,
      error: "Aturan dilanggar.",
    });
  });
});

describe("helper error master data", () => {
  it("mengenali kode Prisma dari properti code maupun teks pesan", () => {
    expect(getPrismaErrorCode({ code: "P2002" })).toBe("P2002");
    expect(getPrismaErrorCode(new Error("Foreign key failed (P2003)"))).toBe(
      "P2003",
    );
    expect(getPrismaErrorCode(new Error("biasa"))).toBeUndefined();
  });

  it("layar memakai pesan server, dan tidak menampilkan teks browser saat server membalas HTML", async () => {
    const jsonResponse = new Response(
      JSON.stringify({ error: "Pesan jelas dari server." }),
      {
        status: 409,
      },
    );
    const htmlResponse = new Response("<html>Internal Server Error</html>", {
      status: 500,
    });

    await expect(readApiErrorMessage(jsonResponse, "cadangan")).resolves.toBe(
      "Pesan jelas dari server.",
    );
    await expect(readApiErrorMessage(htmlResponse, "cadangan")).resolves.toBe(
      "cadangan",
    );
  });

  it("gangguan jaringan diganti kalimat biasa", () => {
    expect(
      describeClientError(new TypeError("Failed to fetch"), "cadangan"),
    ).toBe(
      "Tidak bisa terhubung ke server. Periksa internet Anda, lalu coba lagi.",
    );
  });
});
