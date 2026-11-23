import { describe, expect, it } from "vitest";

import {
  STOK_KOSONG,
  applyConditionDelta,
  computeStockEffect,
  readStoredStockEffect,
  reverseOpnameStockEffect,
  toStoredStockEffect,
  type StokPerKondisi,
} from "@/modules/inventory/domain/opname-stock-condition";

function stok(
  stokBaru: number,
  stokBekas: number,
  stokRusak: number,
  total = stokBaru + stokBekas + stokRusak,
): StokPerKondisi {
  return { stok: total, stokBaru, stokBekas, stokRusak };
}

describe("applyConditionDelta", () => {
  it("menambah kolom kondisi dan total untuk selisih positif", () => {
    expect(applyConditionDelta(stok(5, 2, 1), "BARU", 3)).toEqual(
      stok(8, 2, 1),
    );
    expect(applyConditionDelta(stok(5, 2, 1), "BEKAS", 3)).toEqual(
      stok(5, 5, 1),
    );
    expect(applyConditionDelta(stok(5, 2, 1), "RUSAK", 3)).toEqual(
      stok(5, 2, 4),
    );
  });

  it("delta 0 tidak mengubah apa pun", () => {
    expect(applyConditionDelta(stok(5, 2, 1), "RUSAK", 0)).toEqual(
      stok(5, 2, 1),
    );
  });

  it("memotong kolom kondisinya sendiri lebih dulu", () => {
    expect(applyConditionDelta(stok(5, 2, 4), "RUSAK", -3)).toEqual(
      stok(5, 2, 1),
    );
    expect(applyConditionDelta(stok(5, 2, 4), "BEKAS", -2)).toEqual(
      stok(5, 0, 4),
    );
  });

  it("mengambil sisa dari BARU, lalu BEKAS, lalu RUSAK, melewati kolom utama", () => {
    // RUSAK hanya 1: sisa 4 dari BARU (3) lalu BEKAS (1).
    expect(applyConditionDelta(stok(3, 2, 1), "RUSAK", -5)).toEqual(
      stok(0, 1, 0),
    );
    // BEKAS hanya 1: sisa diambil dari BARU dulu, baru RUSAK.
    expect(applyConditionDelta(stok(2, 1, 4), "BEKAS", -4)).toEqual(
      stok(0, 0, 3),
    );
    // BARU kosong: cadangan BEKAS lalu RUSAK.
    expect(applyConditionDelta(stok(0, 2, 4), "BARU", -3)).toEqual(
      stok(0, 0, 3),
    );
  });

  it("tidak pernah membuat kolom atau total minus", () => {
    expect(applyConditionDelta(stok(1, 1, 1), "BARU", -10)).toEqual(
      stok(0, 0, 0),
    );
  });

  it("menghitung total dari stok lama walau kolom kondisi tidak sinkron", () => {
    // Total 10 tetapi kolom kondisi hanya berisi 4 (data lama).
    expect(applyConditionDelta(stok(2, 1, 1, 10), "BARU", -3)).toEqual(
      stok(0, 0, 1, 7),
    );
    expect(applyConditionDelta(stok(2, 1, 1, 10), "BEKAS", 5)).toEqual(
      stok(2, 6, 1, 15),
    );
  });

  it("memperlakukan kolom yang terlanjur minus sebagai kosong saat dipotong", () => {
    expect(applyConditionDelta(stok(-2, 3, 0, 1), "BARU", -1)).toEqual(
      stok(0, 2, 0, 0),
    );
  });

  it("hanya mengembalikan empat kolom stok walau masukan membawa field lain", () => {
    const baris = { ...stok(5, 0, 0), id: "bg-1", tenantId: "tenant-1" };
    expect(applyConditionDelta(baris, "BARU", 1)).toEqual(stok(6, 0, 0));
  });

  it("tidak mengubah objek masukan", () => {
    const awal = stok(5, 2, 1);
    applyConditionDelta(awal, "BARU", -3);
    expect(awal).toEqual(stok(5, 2, 1));
    expect(STOK_KOSONG).toEqual(stok(0, 0, 0));
  });
});

describe("reverseOpnameStockEffect", () => {
  function terapkanLaluBalik(
    awal: StokPerKondisi,
    kondisi: "BARU" | "BEKAS" | "RUSAK",
    delta: number,
  ) {
    const sesudah = applyConditionDelta(awal, kondisi, delta);
    const efek = computeStockEffect(awal, sesudah);
    return reverseOpnameStockEffect(sesudah, { selisih: delta, efek });
  }

  it("menerapkan lalu membalik mengembalikan stok semula", () => {
    expect(terapkanLaluBalik(stok(4, 2, 1), "BEKAS", -2)).toEqual(
      stok(4, 2, 1),
    );
    expect(terapkanLaluBalik(stok(4, 2, 1), "RUSAK", 3)).toEqual(stok(4, 2, 1));
  });

  // Regresi: potongan yang meluber ke kolom cadangan dulu dikembalikan
  // seluruhnya ke kolom kondisi mutasi, sehingga muncul unit rusak fiktif.
  it("membalik potongan yang meluber ke kolom cadangan secara persis", () => {
    // baru 10, rusak 0; opname alasan rusak -3 memotong stokBaru
    expect(terapkanLaluBalik(stok(10, 0, 0), "RUSAK", -3)).toEqual(
      stok(10, 0, 0),
    );
  });

  // Regresi: opname lama selalu mengubah stokBaru sebesar selisih, berapa pun
  // kondisi mutasinya; tanpa efek tersimpan dibalik dengan cara yang sama.
  it("opname lama tanpa efek tersimpan dibalik di kolom BARU", () => {
    expect(
      reverseOpnameStockEffect(stok(5, 1, 0), { selisih: 4, efek: null }),
    ).toEqual(stok(1, 1, 0));
    expect(
      reverseOpnameStockEffect(stok(5, 1, 0), { selisih: -4, efek: null }),
    ).toEqual(stok(9, 1, 0));
  });

  it("efek nol tidak mengubah stok", () => {
    expect(
      reverseOpnameStockEffect(stok(5, 1, 0), {
        selisih: 0,
        efek: { stokBaru: 0, stokBekas: 0, stokRusak: 0 },
      }),
    ).toEqual(stok(5, 1, 0));
  });

  it("pengembalian dilakukan sebelum pemotongan", () => {
    // efek: rusak +2 dari baru -2 (mis. edit); kini baru 0, rusak 2
    expect(
      reverseOpnameStockEffect(stok(0, 0, 2), {
        selisih: 0,
        efek: { stokBaru: -2, stokBekas: 0, stokRusak: 2 },
      }),
    ).toEqual(stok(2, 0, 0));
  });
});

describe("efek tersimpan", () => {
  it("bolak-balik antara efek dan kolom catatan opname", () => {
    const efek = { stokBaru: -1, stokBekas: 0, stokRusak: 3 };
    expect(readStoredStockEffect(toStoredStockEffect(efek))).toEqual(efek);
  });

  it("null bila salah satu kolom kosong (opname lama)", () => {
    expect(
      readStoredStockEffect({
        efekStokBaru: null,
        efekStokBekas: null,
        efekStokRusak: null,
      }),
    ).toBeNull();
  });
});
