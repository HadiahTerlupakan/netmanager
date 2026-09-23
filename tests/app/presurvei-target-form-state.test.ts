import { describe, expect, it } from "vitest";

import {
  isSimpanTargetTerbuka,
  keAngkaTarget,
  nilaiFormDariTarget,
  periksaFormTarget,
  PESAN_ANGKA_WAJIB,
  PESAN_SALES_WAJIB,
  type NilaiFormTarget,
} from "@/app/admin/presurvei/target/targetFormState";
import type { TargetDto } from "@/modules/presurvei/client";

/** Periode sengaja tidak kembar dengan angka target mana pun. */
const PERIODE = Object.freeze({ tahun: 2025, bulan: 11 });

const NILAI_SAH: NilaiFormTarget = Object.freeze({
  userId: "user-rina-000111",
  targetKunjungan: "40",
  targetProspek: "12",
  targetKonversi: "3",
});

describe("keAngkaTarget", () => {
  it("menerima nol sebagai angka sah, bukan kekosongan", () => {
    // Target 0 sah (`min(0)` di `tetapkanTargetSchema`). `Number(x) || null`
    // akan membuangnya diam-diam.
    expect(keAngkaTarget("0")).toBe(0);
  });

  it("tidak mengubah medan kosong menjadi nol", () => {
    // `Number("")` adalah 0: tanpa pemeriksaan eksplisit, medan yang lupa
    // diisi tersimpan sebagai target nol.
    expect(keAngkaTarget("")).toBeNull();
    expect(keAngkaTarget("   ")).toBeNull();
  });

  it("menolak teks yang bukan angka", () => {
    expect(keAngkaTarget("abc")).toBeNull();
  });

  it("merapikan spasi di sekitar angka", () => {
    expect(keAngkaTarget(" 15 ")).toBe(15);
  });
});

describe("nilaiFormDariTarget", () => {
  it("mengisi form ubah dari baris target, termasuk angka nol", () => {
    const target: TargetDto = Object.freeze({
      id: "target-1",
      userId: "user-budi-000222",
      periodeTahun: 2026,
      periodeBulan: 9,
      targetKunjungan: 25,
      targetProspek: 0,
      targetKonversi: 4,
      updatedAt: "2026-09-01T00:00:00.000Z",
    });

    expect(nilaiFormDariTarget(target)).toEqual({
      userId: "user-budi-000222",
      targetKunjungan: "25",
      targetProspek: "0",
      targetKonversi: "4",
    });
  });
});

describe("periksaFormTarget", () => {
  it("membentuk muatan POST dengan periode yang sedang ditampilkan", () => {
    expect(periksaFormTarget(NILAI_SAH, PERIODE)).toEqual({
      success: true,
      muatan: {
        userId: "user-rina-000111",
        periodeTahun: 2025,
        periodeBulan: 11,
        targetKunjungan: 40,
        targetProspek: 12,
        targetKonversi: 3,
      },
    });
  });

  it("meloloskan target nol", () => {
    const hasil = periksaFormTarget(
      { ...NILAI_SAH, targetKonversi: "0" },
      PERIODE,
    );

    expect(hasil).toEqual({
      success: true,
      muatan: expect.objectContaining({ targetKonversi: 0 }),
    });
  });

  it("menolak medan angka yang kosong dengan pesan di medannya", () => {
    const hasil = periksaFormTarget(
      { ...NILAI_SAH, targetProspek: "" },
      PERIODE,
    );

    expect(hasil).toEqual({
      success: false,
      kesalahan: { targetProspek: PESAN_ANGKA_WAJIB },
    });
  });

  it("menolak form tanpa sales", () => {
    const hasil = periksaFormTarget({ ...NILAI_SAH, userId: "  " }, PERIODE);

    expect(hasil).toEqual({
      success: false,
      kesalahan: { userId: PESAN_SALES_WAJIB },
    });
  });

  it("meneruskan penolakan schema ke medan yang bersangkutan", () => {
    // Pecahan lolos `keAngkaTarget` tapi ditolak `.int()` schema.
    const hasil = periksaFormTarget(
      { ...NILAI_SAH, targetKunjungan: "1.5" },
      PERIODE,
    );

    expect(hasil.success).toBe(false);
    expect(hasil.success === false && Object.keys(hasil.kesalahan)).toEqual([
      "targetKunjungan",
    ]);
  });

  it("menaruh penolakan periode di pesan level-form", () => {
    // Periode tidak punya medan di form ini (hanya teks read-only), jadi
    // pesannya harus punya tempat lain untuk tampil.
    const hasil = periksaFormTarget(NILAI_SAH, { tahun: 1999, bulan: 11 });

    expect(hasil.success === false && Object.keys(hasil.kesalahan)).toEqual([
      "_form",
    ]);
  });
});

describe("isSimpanTargetTerbuka", () => {
  it("menahan simpan di mode buat selama daftar sales memuat atau gagal", () => {
    // Daftar kosong karena GAGAL tidak boleh tampil sama dengan "tidak ada
    // sales" — pemakai perlu tahu kenapa tidak ada yang bisa dipilih.
    expect(
      isSimpanTargetTerbuka({ isUbah: false, statusDaftarSales: "memuat" }),
    ).toBe(false);
    expect(
      isSimpanTargetTerbuka({ isUbah: false, statusDaftarSales: "gagal" }),
    ).toBe(false);
    expect(
      isSimpanTargetTerbuka({ isUbah: false, statusDaftarSales: "siap" }),
    ).toBe(true);
  });

  it("membuka simpan di mode ubah apa pun keadaan daftar sales", () => {
    // Sales terkunci pada mode ubah; daftar tidak dibutuhkan untuk menyimpan,
    // dan sales nonaktif memang tidak ada di dalamnya.
    expect(
      isSimpanTargetTerbuka({ isUbah: true, statusDaftarSales: "gagal" }),
    ).toBe(true);
  });
});
