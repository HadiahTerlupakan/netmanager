import { describe, expect, it } from "vitest";

import {
  describeRestockClientError,
  getRestockFormProblems,
  readRestockErrorMessage,
  RESTOCK_NETWORK_ERROR_MESSAGE,
} from "@/app/admin/inventory/restock/utils";
import { ApiErrors } from "@/lib/api-response";
import {
  describeRestockValidationError,
  findRestockSettingsProblems,
  RESTOCK_JASA_CONFIRM_LIST_LABELS,
  restockJasaConfirmSchema,
} from "@/lib/validations/restock";
import {
  RESTOCK_MESSAGES,
  restockAlreadyDecidedMessage,
  restockCannotEditMessage,
  restockForbiddenMessage,
  RestockSettingReferenceError,
} from "@/modules/inventory/services/restock-messages";
import { resolveOverReceipts } from "@/modules/inventory/services/restock-over-receipt";

/**
 * Pesan restock dibaca petugas gudang, bukan programmer: tanpa kode status
 * mentah, tanpa nama izin teknis, dan selalu menyebut langkah berikutnya.
 */
describe("pesan restock untuk petugas", () => {
  it("menerjemahkan status ke kata biasa", () => {
    expect(restockCannotEditMessage("ORDERED")).toBe(
      "Pengajuan ini sedang dibelanjakan, jadi tidak bisa diubah lagi. Yang bisa diubah hanya pengajuan yang belum disetujui.",
    );
    expect(restockAlreadyDecidedMessage("REJECTED", "disetujui")).toContain(
      "Pengajuan ini sudah ditolak, jadi tidak bisa disetujui lagi.",
    );
  });

  it("menyebut kegiatan yang dilindungi izin, bukan nama izinnya", () => {
    const message = restockForbiddenMessage("restock:verify");
    expect(message).toBe(
      "Akun Anda tidak punya izin menerima barang dan jasa restock. Minta admin menambahkan izin itu ke peran Anda.",
    );
    expect(message).not.toContain("restock:verify");
  });

  it("pesan 404 tidak ditambahi akhiran oleh ApiErrors.notFound", async () => {
    const response = ApiErrors.notFound(RESTOCK_MESSAGES.requestNotFound);
    const body = await response.json();
    expect(JSON.stringify(body)).toContain(RESTOCK_MESSAGES.requestNotFound);
    expect(JSON.stringify(body)).not.toContain("lagi. tidak ditemukan");
  });

  it("barang dan gudang pengaturan yang hilang punya pesannya sendiri", () => {
    expect(new RestockSettingReferenceError("barang").message).toContain(
      "Barang ini tidak ditemukan",
    );
    expect(new RestockSettingReferenceError("gudang").message).toContain(
      "sudah dinonaktifkan",
    );
  });
});

describe("validasi restock melaporkan semua masalah", () => {
  it("menyebut jasa, bukan barang, pada konfirmasi jasa", () => {
    const parsed = restockJasaConfirmSchema.safeParse({
      items: [{ jasaItemId: "j-1", buktiSelesai: [] }],
    });
    expect(parsed.success).toBe(false);
    expect(
      describeRestockValidationError(
        parsed.error!,
        RESTOCK_JASA_CONFIRM_LIST_LABELS,
      ),
    ).toBe(
      "Jasa ke-1: Foto bukti jasa selesai belum diunggah. Unggah fotonya dulu.",
    );
  });

  it("pengaturan: semua kekurangan sekaligus, dengan angka yang dimasukkan", () => {
    expect(findRestockSettingsProblems({ barangId: "b-1" })).toBe(
      [
        "Gudangnya belum dipilih. Pilih gudangnya dulu.",
        "Stok minimum belum diisi atau masih 0. Isi angka 1 atau lebih.",
        "Stok maksimum belum diisi atau masih 0. Isi angka yang lebih besar dari stok minimum.",
      ].join("\n"),
    );
    expect(
      findRestockSettingsProblems({
        barangId: "b-1",
        gudangId: "g-1",
        minStok: 20,
        maxStok: 5,
      }),
    ).toBe(
      "Stok minimum (20) harus lebih kecil dari stok maksimum (5). Contoh: minimum 5, maksimum 20.",
    );
    expect(
      findRestockSettingsProblems({
        barangId: "b-1",
        gudangId: "g-1",
        minStok: 5,
        maxStok: 20,
      }),
    ).toBeNull();
  });
});

describe("kelebihan kiriman", () => {
  it("menyebut barang, jumlah datang, sisa pesanan, dan kelebihannya", () => {
    expect(() =>
      resolveOverReceipts(
        [
          {
            purchaseOrderItemId: "poi-1",
            originalBarangId: "b-1",
            barangName: "Kabel Drop",
            quantity: 12,
            remaining: 10,
          },
        ],
        {},
      ),
    ).toThrow(
      "Kabel Drop datang 12, padahal sisa pesanannya cuma 10. Kelebihannya 2. Tulis alasan kenapa barang datang lebih, supaya jumlah di pesanan ikut ditambah.",
    );
  });
});

describe("form pengajuan restock di layar", () => {
  it("mendaftar setiap kekurangan, dan menyebut barang dobel dengan namanya", () => {
    expect(
      getRestockFormProblems({
        formGudang: "",
        formNotes: " ",
        formItems: [
          { tipe: "BARANG", barangId: "b-1", quantity: 1 },
          { tipe: "JASA", jasaId: "", quantity: 0 },
          { tipe: "BARANG", barangId: "b-1", quantity: 2 },
        ],
        barangNamaById: new Map([["b-1", "ONT ZTE"]]),
      }),
    ).toEqual([
      "Gudang tujuan belum dipilih.",
      "Catatan belum diisi. Tulis untuk apa barang ini dibeli.",
      "Baris ke-2: jasanya belum dipilih.",
      "Baris ke-2: jumlahnya harus 1 atau lebih.",
      "ONT ZTE dipilih lebih dari sekali (baris 1, 3). Hapus salah satu barisnya, lalu jumlahkan di satu baris saja.",
    ]);
  });

  it("tidak menampilkan 'Unexpected token' saat server membalas bukan JSON", async () => {
    const message = await readRestockErrorMessage(
      new Response("<html>502 Bad Gateway</html>", { status: 502 }),
      "cadangan",
    );
    expect(message).toContain("Server sedang bermasalah");
  });

  it("memakai pesan server bila ada", async () => {
    const message = await readRestockErrorMessage(
      Response.json({ error: "Pengajuan ini sudah ditolak." }, { status: 400 }),
      "cadangan",
    );
    expect(message).toBe("Pengajuan ini sudah ditolak.");
  });

  it("mengganti 'Failed to fetch' dengan kalimat soal koneksi", () => {
    expect(describeRestockClientError(new TypeError("Failed to fetch"))).toBe(
      RESTOCK_NETWORK_ERROR_MESSAGE,
    );
  });
});
