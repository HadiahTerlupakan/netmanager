import { describe, expect, it } from "vitest";

import { adjustStockCalculation } from "@/modules/inventory/repositories/inventory-api-repository-helpers";
import { opnameBatchSchema } from "@/modules/inventory/validators/opnameValidator";

/**
 * Sambungan antara penghasil baris opname dan validator yang menerimanya.
 *
 * Di sinilah cacat 2026-10-12 hidup: masing-masing sisi benar menurut dirinya
 * sendiri, tetapi `GET /api/inventory/opname/calculate` menghasilkan rincian
 * kondisi yang melanggar aturan `POST /api/inventory/opname/batch`. Tidak ada
 * tes yang menyentuh keduanya sekaligus, jadi tidak ada yang gagal — yang
 * gagal adalah operator, dengan banner tanpa keterangan.
 *
 * Tes ini menjalankan keluaran penghasil itu langsung melalui validatornya,
 * persis seperti layar mengirimnya saat operator mencentang "Dihitung" tanpa
 * mengubah angka apa pun.
 */
describe("baris kalkulasi opname lolos validator batch", () => {
  /** Bentuk payload yang dikirim `useSubmitOpname` untuk satu barang. */
  function barisUntuk(
    stokSistem: number,
    rekap: { stokBaru: number; stokBekas: number; stokRusak: number },
  ) {
    const kondisi = adjustStockCalculation(stokSistem, rekap);
    return {
      barangId: "brg-1",
      // `mapCalculatedOpnameItem` memakai stok sistem sebagai stok fisik awal.
      stokFisik: stokSistem,
      kondisiBaik: kondisi.kondisiBaik,
      kondisiRusak: kondisi.kondisiRusak,
      kondisiExpire: kondisi.kondisiExpire,
      keterangan: "Stock Opname Otomatis",
    };
  }

  it("menerima baris dari gudang yang rekap mutasinya melampaui stok sistem", () => {
    // Bentuk persis yang dulu ditolak: bekas 5 + rusak 4 melawan stok 3.
    const hasil = opnameBatchSchema.safeParse({
      gudangId: "gd-1",
      items: [barisUntuk(3, { stokBaru: 0, stokBekas: 5, stokRusak: 4 })],
    });

    expect(hasil.success).toBe(true);
  });

  it("menerima seluruh kombinasi stok dan rekap yang masuk akal", () => {
    const items = [];
    for (let sistem = 0; sistem <= 8; sistem += 1) {
      for (let baru = 0; baru <= 4; baru += 1) {
        for (let bekas = 0; bekas <= 4; bekas += 1) {
          for (let rusak = 0; rusak <= 4; rusak += 1) {
            items.push({
              ...barisUntuk(sistem, {
                stokBaru: baru,
                stokBekas: bekas,
                stokRusak: rusak,
              }),
              barangId: `brg-${sistem}-${baru}-${bekas}-${rusak}`,
            });
          }
        }
      }
    }

    const hasil = opnameBatchSchema.safeParse({ gudangId: "gd-1", items });

    // Satu baris yang melanggar sudah cukup membuat seluruh batch ditolak —
    // dan satu batch yang ditolak berarti opname gudang itu mustahil disimpan.
    expect(
      hasil.success,
      hasil.success ? "" : JSON.stringify(hasil.error.issues.slice(0, 3)),
    ).toBe(true);
  });

  it("tetap menolak baris yang dirakit tangan dengan kondisi melebihi stok fisik", () => {
    // Penjaga validatornya sendiri harus tetap hidup; perbaikan di sisi
    // penghasil tidak boleh diam-diam melonggarkan aturan ini.
    const hasil = opnameBatchSchema.safeParse({
      gudangId: "gd-1",
      items: [
        {
          barangId: "brg-1",
          stokFisik: 3,
          kondisiBaik: 2,
          kondisiRusak: 2,
          kondisiExpire: 0,
        },
      ],
    });

    expect(hasil.success).toBe(false);
  });
});
