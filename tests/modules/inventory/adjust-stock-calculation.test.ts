import { describe, expect, it } from "vitest";

import { adjustStockCalculation } from "@/modules/inventory/repositories/inventory-api-repository-helpers";

/**
 * Rincian kondisi awal sebuah baris stock opname.
 *
 * Baris ini dikirim apa adanya ke `POST /api/inventory/opname/batch` bila
 * operator mencentang "Dihitung" tanpa mengubah angkanya, dan endpoint itu
 * menolak dengan 400 bila baik + rusak + expire melebihi stok fisik. Maka
 * jumlah ketiganya wajib persis sama dengan stok sistem — kalau tidak, server
 * menyuguhkan baris yang kemudian ditolaknya sendiri.
 *
 * Kejadian nyata 2026-10-12 di gudang CARIU: operator tidak bisa menyimpan
 * opname sama sekali, dan layar hanya berkata "Terjadi kesalahan".
 */
describe("adjustStockCalculation", () => {
  const jumlah = (hasil: {
    kondisiBaik: number;
    kondisiRusak: number;
    kondisiExpire: number;
  }) => hasil.kondisiBaik + hasil.kondisiRusak + hasil.kondisiExpire;

  it("membiarkan rekap yang sudah pas apa adanya", () => {
    const hasil = adjustStockCalculation(10, {
      stokBaru: 6,
      stokBekas: 3,
      stokRusak: 1,
    });

    expect(hasil).toEqual({
      kondisiBaik: 6,
      kondisiRusak: 1,
      kondisiExpire: 3,
    });
    expect(jumlah(hasil)).toBe(10);
  });

  it("menambahkan kekurangan ke stok baik", () => {
    // Rekap mutasi hanya menjelaskan 4 dari 10; enam sisanya dianggap baik.
    const hasil = adjustStockCalculation(10, {
      stokBaru: 2,
      stokBekas: 1,
      stokRusak: 1,
    });

    expect(hasil.kondisiBaik).toBe(8);
    expect(jumlah(hasil)).toBe(10);
  });

  it("memangkas kelebihan dari stok baik lebih dulu", () => {
    const hasil = adjustStockCalculation(5, {
      stokBaru: 4,
      stokBekas: 2,
      stokRusak: 1,
    });

    expect(hasil).toEqual({
      kondisiBaik: 2,
      kondisiRusak: 1,
      kondisiExpire: 2,
    });
    expect(jumlah(hasil)).toBe(5);
  });

  it("tidak pernah melebihi stok sistem walau bekas dan rusak saja sudah lebih besar", () => {
    // Inilah bentuk yang dulu membuat opname mustahil disimpan: stok baik
    // sudah nol, tetapi bekas + rusak masih 9 melawan stok sistem 3.
    const hasil = adjustStockCalculation(3, {
      stokBaru: 0,
      stokBekas: 5,
      stokRusak: 4,
    });

    expect(jumlah(hasil)).toBe(3);
    expect(hasil.kondisiBaik).toBe(0);
    // Rusak dipertahankan paling akhir; ia dasar klaim dan penghapusan aset.
    expect(hasil.kondisiRusak).toBe(3);
    expect(hasil.kondisiExpire).toBe(0);
  });

  it("memangkas sebagian expire sebelum menyentuh rusak", () => {
    const hasil = adjustStockCalculation(6, {
      stokBaru: 1,
      stokBekas: 5,
      stokRusak: 3,
    });

    expect(jumlah(hasil)).toBe(6);
    expect(hasil.kondisiRusak).toBe(3);
    expect(hasil.kondisiExpire).toBe(3);
    expect(hasil.kondisiBaik).toBe(0);
  });

  it("mengembalikan nol semua saat stok sistem nol", () => {
    const hasil = adjustStockCalculation(0, {
      stokBaru: 2,
      stokBekas: 3,
      stokRusak: 4,
    });

    expect(hasil).toEqual({
      kondisiBaik: 0,
      kondisiRusak: 0,
      kondisiExpire: 0,
    });
  });

  it("tidak menghasilkan angka negatif saat stok sistem negatif", () => {
    // Stok negatif semestinya mustahil, tetapi data lama pernah memilikinya;
    // yang penting rinciannya tidak ikut menjadi negatif.
    const hasil = adjustStockCalculation(-5, {
      stokBaru: 1,
      stokBekas: 1,
      stokRusak: 1,
    });

    expect(jumlah(hasil)).toBe(0);
    expect(hasil.kondisiBaik).toBeGreaterThanOrEqual(0);
    expect(hasil.kondisiRusak).toBeGreaterThanOrEqual(0);
    expect(hasil.kondisiExpire).toBeGreaterThanOrEqual(0);
  });

  it("menjaga invarian pada seluruh kombinasi kecil", () => {
    for (let sistem = 0; sistem <= 8; sistem += 1) {
      for (let baru = 0; baru <= 4; baru += 1) {
        for (let bekas = 0; bekas <= 4; bekas += 1) {
          for (let rusak = 0; rusak <= 4; rusak += 1) {
            const hasil = adjustStockCalculation(sistem, {
              stokBaru: baru,
              stokBekas: bekas,
              stokRusak: rusak,
            });
            const total = jumlah(hasil);

            expect(
              total,
              `sistem=${sistem} baru=${baru} bekas=${bekas} rusak=${rusak}`,
            ).toBeLessThanOrEqual(sistem);
            expect(hasil.kondisiBaik).toBeGreaterThanOrEqual(0);
            expect(hasil.kondisiRusak).toBeGreaterThanOrEqual(0);
            expect(hasil.kondisiExpire).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});
