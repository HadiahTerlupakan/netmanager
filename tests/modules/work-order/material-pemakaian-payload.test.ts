import { describe, expect, it } from "vitest";

import { parseMaterialPemakaian } from "@/modules/work-order/utils/material-pemakaian-payload";

/**
 * Aplikasi men-`JSON.stringify` daftar material sebelum mengirim, lalu
 * mengirimnya sebagai body JSON pada jalur online dan sebagai field multipart
 * pada jalur berfoto. Jalur JSON dulu tidak menormalkan nilainya, sehingga
 * layanan menerima sebuah string: `items?.length` bernilai benar, `.filter`
 * melempar, dan penjaga "penyelesaian tidak boleh gagal" menelan kesalahannya —
 * work order selesai dengan 200 tanpa satu pun pemakaian tercatat.
 */

const DAFTAR = [{ barangId: "kabel", jumlah: 7 }];

describe("parse material pemakaian", () => {
  it("menerima string JSON seperti yang dikirim aplikasi", () => {
    expect(parseMaterialPemakaian(JSON.stringify(DAFTAR))).toEqual(DAFTAR);
  });

  it("menerima array yang sudah berbentuk benar", () => {
    expect(parseMaterialPemakaian(DAFTAR)).toEqual(DAFTAR);
  });

  it("membuang baris yang bentuknya tidak dikenali", () => {
    const campuran = [
      { barangId: "kabel", jumlah: 7 },
      { barangId: "ont" },
      { jumlah: 3 },
      { barangId: "konektor", jumlah: "dua" },
      null,
      "bukan objek",
    ];

    expect(parseMaterialPemakaian(campuran)).toEqual(DAFTAR);
  });

  // NaN dan Infinity lolos `typeof === "number"`; keduanya tidak bisa
  // dibandingkan dengan batas jumlah mana pun.
  it("membuang angka yang tidak terhingga", () => {
    expect(
      parseMaterialPemakaian([
        { barangId: "kabel", jumlah: Number.NaN },
        { barangId: "ont", jumlah: Number.POSITIVE_INFINITY },
      ]),
    ).toEqual([]);
  });

  it("nilai kosong atau bukan daftar diabaikan", () => {
    expect(parseMaterialPemakaian(undefined)).toBeUndefined();
    expect(parseMaterialPemakaian(null)).toBeUndefined();
    expect(parseMaterialPemakaian("")).toBeUndefined();
    expect(parseMaterialPemakaian("   ")).toBeUndefined();
    expect(parseMaterialPemakaian("{bukan json")).toBeUndefined();
    expect(parseMaterialPemakaian('{"barangId":"kabel"}')).toBeUndefined();
    expect(parseMaterialPemakaian(42)).toBeUndefined();
  });

  it("daftar kosong tetap daftar kosong, bukan tidak terdefinisi", () => {
    expect(parseMaterialPemakaian("[]")).toEqual([]);
  });
});
