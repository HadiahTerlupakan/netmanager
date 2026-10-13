import { describe, expect, it } from "vitest";

import {
  namaPelaku,
  ringkasPembuatan,
  ringkasPenghapusan,
  ringkasPerubahan,
} from "@/modules/inventory/domain/riwayat-stock-opname";

/**
 * Isi jejak perubahan stock opname.
 *
 * Yang dicari pembaca riwayat adalah angka yang benar-benar berubah. Riwayat
 * yang mencatat seluruh field pada tiap penyuntingan sama tidak bergunanya
 * dengan riwayat yang tidak mencatat apa-apa: satu perubahan stok tenggelam di
 * antara belasan field yang nilainya sama.
 */
describe("ringkasPerubahan", () => {
  it("hanya mencatat field yang berubah", () => {
    const hasil = ringkasPerubahan(
      { stokFisik: 10, kondisiRusak: 2, keterangan: "Rutin" },
      { stokFisik: 11, kondisiRusak: 2, keterangan: "Rutin" },
    );

    expect(hasil).toEqual({ stokFisik: { dari: 10, ke: 11 } });
  });

  it("mengembalikan objek kosong saat tidak ada yang berubah", () => {
    const catatan = { stokFisik: 7, kondisiBaik: 7, pic: "Budi" };

    expect(ringkasPerubahan(catatan, { ...catatan })).toEqual({});
  });

  it("menyamakan null, undefined, dan string kosong", () => {
    // Form mengirim "" untuk field yang dikosongkan, sementara basis data
    // menyimpan null. Tanpa penyamaan ini tiap penyimpanan akan tampak
    // mengubah setiap field opsional yang memang selalu kosong.
    const hasil = ringkasPerubahan(
      { keterangan: null, nomorRak: undefined, nomorBox: "" },
      { keterangan: "", nomorRak: null, nomorBox: undefined },
    );

    expect(hasil).toEqual({});
  });

  it("mengabaikan field yang tidak layak masuk riwayat", () => {
    const hasil = ringkasPerubahan(
      { id: "op-1", tenantId: "t-1", createdAt: "dulu", stokFisik: 3 },
      { id: "op-1", tenantId: "t-2", createdAt: "kini", stokFisik: 3 },
    );

    expect(hasil).toEqual({});
  });

  it("mencatat perubahan menjadi kosong sebagai nilai null", () => {
    const hasil = ringkasPerubahan(
      { alasanSelisih: "Hilang" },
      { alasanSelisih: "" },
    );

    expect(hasil).toEqual({ alasanSelisih: { dari: "Hilang", ke: null } });
  });
});

describe("ringkasPembuatan dan ringkasPenghapusan", () => {
  it("pembuatan mencatat nilai awal dengan sisi 'dari' kosong", () => {
    const hasil = ringkasPembuatan({
      stokFisik: 9,
      stokSistem: 12,
      selisih: -3,
      keterangan: null,
      id: "op-1",
    });

    expect(hasil).toEqual({
      stokFisik: { dari: null, ke: 9 },
      stokSistem: { dari: null, ke: 12 },
      selisih: { dari: null, ke: -3 },
    });
  });

  it("penghapusan mencatat nilai terakhir dengan sisi 'ke' kosong", () => {
    const hasil = ringkasPenghapusan({
      stokFisik: 4,
      selisih: 0,
      nomorRak: "",
    });

    // selisih 0 tetap dicatat: nol adalah nilai, bukan ketiadaan nilai.
    expect(hasil).toEqual({
      stokFisik: { dari: 4, ke: null },
      selisih: { dari: 0, ke: null },
    });
  });
});

describe("namaPelaku", () => {
  it("memakai nama, lalu email, lalu cadangan", () => {
    expect(namaPelaku("Budi", "budi@contoh.id")).toBe("Budi");
    expect(namaPelaku(null, "budi@contoh.id")).toBe("budi@contoh.id");
    expect(namaPelaku("", "", "Admin")).toBe("Admin");
  });
});
