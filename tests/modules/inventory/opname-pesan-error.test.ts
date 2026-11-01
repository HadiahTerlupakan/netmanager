import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/inventory/services/InventoryOpnameService", () => ({
  getInventoryOpnameService: () => ({}),
}));

import { describeOpnameFailure } from "@/components/inventory/opname/opnameErrorMessage";
import {
  OPNAME_PESAN,
  pesanKondisiMelebihiStokFisik,
} from "@/modules/inventory/domain/opname-pesan";
import {
  InventoryOpnameRouteService,
  mapOpnameError,
} from "@/modules/inventory/services/InventoryOpnameRouteService";
import {
  opnameBatchSchema,
  opnameItemSchema,
} from "@/modules/inventory/validators/opnameValidator";

/**
 * Pesan error opname dibaca petugas gudang, bukan programmer. Tiap pesan harus
 * menyebut apa yang salah dan apa yang harus dilakukan, dengan kata sehari-hari.
 */
const USER = { id: "u-1" };

function pesanDari(body: unknown) {
  const hasil = opnameItemSchema.safeParse(body);
  if (hasil.success) throw new Error("diharapkan gagal");
  return hasil.error.issues.map((issue) => issue.message);
}

describe("pesan validator opname", () => {
  const dasar = { barangId: "b1", gudangId: "g1" };

  it("stok fisik minus: satu pesan, menyuruh isi 0", () => {
    expect(pesanDari({ ...dasar, stokFisik: -3 })).toEqual([
      "Stok fisik tidak boleh minus. Isi 0 kalau barangnya tidak ada.",
    ]);
  });

  it("angka berkoma: minta angka bulat", () => {
    expect(pesanDari({ ...dasar, stokFisik: 2.5 })).toEqual([
      "Stok fisik harus angka bulat, tanpa koma.",
    ]);
  });

  it("bukan angka: minta diisi angka", () => {
    expect(pesanDari({ ...dasar, stokFisik: "lima" })).toEqual([
      "Stok fisik harus diisi angka.",
    ]);
  });

  it("kondisi melebihi stok fisik: sebut angkanya", () => {
    expect(
      pesanDari({ ...dasar, stokFisik: 5, kondisiBaik: 4, kondisiRusak: 3 }),
    ).toEqual([
      "Jumlah Baik + Rusak + Expire (7) lebih banyak dari stok fisik (5). Kurangi salah satunya sampai totalnya tidak lebih dari 5.",
    ]);
  });

  it("batch kosong: suruh centang barang", () => {
    const hasil = opnameBatchSchema.safeParse({ gudangId: "g1", items: [] });
    expect(hasil.success).toBe(false);
    expect(hasil.error?.issues[0].message).toBe(
      "Belum ada barang yang dicentang. Centang barang yang sudah dihitung, lalu simpan.",
    );
  });
});

describe("InventoryOpnameRouteService — pesan error batch", () => {
  it("menyebut nomor barang dan melaporkan semua barang yang bermasalah", async () => {
    const service = new InventoryOpnameRouteService({} as never);

    const hasil = await service.createOpnameBatch({
      user: USER,
      body: {
        gudangId: "g1",
        items: [
          { barangId: "b1", stokFisik: 2 },
          { barangId: "b2", stokFisik: -1 },
          { barangId: "b3", stokFisik: 1, kondisiBaik: 2 },
        ],
      },
    });

    expect(hasil).toMatchObject({
      success: false,
      status: 400,
      error:
        "Barang ke-2: Stok fisik tidak boleh minus. Isi 0 kalau barangnya tidak ada.\n" +
        "Barang ke-3: Jumlah Baik + Rusak + Expire (2) lebih banyak dari stok fisik (1). Kurangi salah satunya sampai totalnya tidak lebih dari 1.",
      details: {
        "items.1": [
          "Stok fisik tidak boleh minus. Isi 0 kalau barangnya tidak ada.",
        ],
        "items.2": [
          "Jumlah Baik + Rusak + Expire (2) lebih banyak dari stok fisik (1). Kurangi salah satunya sampai totalnya tidak lebih dari 1.",
        ],
      },
    });
  });

  it.each([
    [
      "Anda tidak memiliki akses ke Gudang ini (Beda Site).",
      403,
      "Gudang ini milik site lain, jadi Anda tidak bisa mencatat opname di sini. Pilih gudang di site Anda, atau minta admin menambahkan site gudang ini ke akun Anda.",
    ],
    [
      "User tidak memiliki Site yang ditugaskan namun dibatasi aksesnya per Site.",
      403,
      "Akun Anda belum ditugaskan ke site mana pun, jadi belum bisa mencatat opname. Minta admin mengatur site di akun Anda.",
    ],
    [
      "Gudang tidak ditemukan.",
      400,
      "Gudang ini sudah dihapus atau dinonaktifkan. Pilih gudang lain, atau minta admin mengaktifkannya lagi.",
    ],
    [
      "Barang tidak ditemukan",
      404,
      "Ada barang yang tidak ditemukan, mungkin baru dihapus. Muat ulang halaman, lalu hitung dan simpan lagi.",
    ],
    [
      "Barang tidak berada dalam tenant yang sama dengan gudang tujuan",
      400,
      "Ada barang yang bukan milik gudang ini. Muat ulang halaman lalu coba lagi. Kalau masih muncul, laporkan ke admin.",
    ],
    [
      "connection terminated unexpectedly",
      500,
      "Opname belum tersimpan karena ada gangguan di server. Tidak ada angka yang berubah. Coba simpan sekali lagi; kalau tetap gagal, laporkan ke admin.",
    ],
  ])("menerjemahkan %s", async (pesanAsli, status, pesanPetugas) => {
    const service = new InventoryOpnameRouteService({
      createOpnameBatch: vi.fn().mockRejectedValue(new Error(pesanAsli)),
    } as never);

    const hasil = await service.createOpnameBatch({
      user: USER,
      body: { gudangId: "g1", items: [{ barangId: "b1", stokFisik: 1 }] },
    });

    expect(hasil).toMatchObject({
      success: false,
      status,
      error: pesanPetugas,
    });
  });
});

describe("describeOpnameFailure — pesan di layar", () => {
  const items = [
    { barangKode: "K-01", barangNama: "Kabel Drop" },
    { barangKode: "O-02", barangNama: "ONT ZTE" },
  ];

  it("mengganti nomor barang dengan nama barangnya", () => {
    const pesan = describeOpnameFailure(
      {
        message: "Barang ke-2: Stok fisik tidak boleh minus.",
        details: { "items.1": ["Stok fisik tidak boleh minus."] },
      },
      items,
    );

    expect(pesan).toBe("ONT ZTE (O-02): Stok fisik tidak boleh minus.");
  });

  it("memakai pesan server apa adanya bila tidak menyangkut barang tertentu", () => {
    const pesan = describeOpnameFailure(
      { message: "Gudang belum dipilih. Pilih gudang dulu." },
      items,
    );

    expect(pesan).toBe("Gudang belum dipilih. Pilih gudang dulu.");
  });
});

describe("mapOpnameError — ubah & hapus catatan opname", () => {
  it.each([
    [
      "Record stock opname tidak ditemukan",
      404,
      OPNAME_PESAN.catatanTidakDitemukan,
    ],
    [
      "Akses ditolak: record bukan milik tenant Anda",
      403,
      OPNAME_PESAN.catatanBukanMilikAnda,
    ],
  ])("menerjemahkan %s", (pesanAsli, status, pesanPetugas) => {
    expect(
      mapOpnameError(new Error(pesanAsli), OPNAME_PESAN.gagalHapus),
    ).toEqual({
      success: false,
      status,
      error: pesanPetugas,
    });
  });

  it("memakai pesan gagal yang sesuai aksinya untuk error tak dikenal", () => {
    expect(
      mapOpnameError(new Error("deadlock detected"), OPNAME_PESAN.gagalHapus),
    ).toEqual({
      success: false,
      status: 500,
      error: OPNAME_PESAN.gagalHapus,
    });
  });

  it("pesan 404 tetap utuh saat dibungkus ApiErrors.notFound", () => {
    // `ApiErrors.notFound` menambahkan " tidak ditemukan" bila frasa itu tidak ada.
    expect(OPNAME_PESAN.catatanTidakDitemukan).toMatch(/tidak ditemukan/);
  });
});

describe("parseOpnameUpdate", () => {
  it("menolak ubah opname dengan pesan per kolom", () => {
    const service = new InventoryOpnameRouteService({} as never);

    const hasil = service.parseOpnameUpdate({
      stokFisik: 4,
      kondisiBaik: 3,
      kondisiRusak: 2,
    });

    expect(hasil).toMatchObject({
      ok: false,
      failure: { status: 400, error: pesanKondisiMelebihiStokFisik(5, 4) },
    });
  });
});
