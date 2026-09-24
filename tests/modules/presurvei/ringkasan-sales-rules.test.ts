import { describe, expect, it } from "vitest";

import {
  lengkapiHitunganPerJenis,
  periodeBulanUtc,
  pilihPerluFollowUp,
  rentangHariUtc,
  type ProspekSentuhan,
} from "@/modules/presurvei/domain/ringkasan-sales";

/**
 * Batas "hari ini" dan "bulan ini" ringkasan Beranda adalah UTC, sama dengan
 * laporan pencapaian (`TargetService.bangunRentangBulan`). Semua waktu di
 * berkas ini ditulis eksplisit dengan akhiran Z supaya tidak bergantung pada
 * zona mesin.
 */

describe("rentangHariUtc", () => {
  it("mencakup seluruh hari UTC yang memuat waktu itu", () => {
    expect(rentangHariUtc(new Date("2026-09-24T23:30:00.000Z"))).toEqual({
      mulai: new Date("2026-09-24T00:00:00.000Z"),
      selesai: new Date("2026-09-24T23:59:59.999Z"),
    });
  });

  it("tidak melompat ke hari berikutnya di akhir bulan", () => {
    expect(rentangHariUtc(new Date("2026-09-30T23:59:59.999Z"))).toEqual({
      mulai: new Date("2026-09-30T00:00:00.000Z"),
      selesai: new Date("2026-09-30T23:59:59.999Z"),
    });
  });
});

describe("periodeBulanUtc", () => {
  it("memberi bulan 1–12, bukan indeks 0–11", () => {
    expect(periodeBulanUtc(new Date("2026-12-31T23:00:00.000Z"))).toEqual({
      tahun: 2026,
      bulan: 12,
    });
  });

  it("berganti tahun tepat di tengah malam UTC", () => {
    expect(periodeBulanUtc(new Date("2027-01-01T00:00:00.000Z"))).toEqual({
      tahun: 2027,
      bulan: 1,
    });
  });
});

describe("lengkapiHitunganPerJenis", () => {
  it("mengisi nol untuk jenis yang tidak muncul dan mempertahankan yang ada", () => {
    expect(lengkapiHitunganPerJenis({ KUNJUNGAN: 3, TELEPON: 4 })).toEqual({
      KUNJUNGAN: 3,
      SURVEI_LOKASI: 0,
      TELEPON: 4,
      CHAT: 0,
      IKLAN: 0,
    });
  });
});

const prospek = (id: string, updatedAt: string): ProspekSentuhan => ({
  id,
  nama: `Nama ${id}`,
  noTelp: `0812${id}`,
  status: "DIHUBUNGI",
  updatedAt: new Date(updatedAt),
});

describe("pilihPerluFollowUp", () => {
  it("kegiatan tertaut yang lebih baru menggeser sentuhan terakhir", () => {
    // A diubah paling awal tapi baru di-follow-up; B tidak disentuh sejak
    // 5 September. Mencatat follow-up tidak mengubah updatedAt prospek
    // (KegiatanService.catat hanya menulis kegiatan), jadi tanpa kegiatan
    // terakhir A akan tetap di puncak daftar.
    const hasil = pilihPerluFollowUp(
      [
        prospek("a", "2026-09-01T00:00:00.000Z"),
        prospek("b", "2026-09-05T00:00:00.000Z"),
      ],
      { a: new Date("2026-09-20T00:00:00.000Z") },
      5,
    );

    expect(hasil.map((baris) => baris.id)).toEqual(["b", "a"]);
    expect(hasil[1].sentuhanTerakhir).toEqual(
      new Date("2026-09-20T00:00:00.000Z"),
    );
  });

  it("kegiatan yang lebih lama dari updatedAt tidak memundurkan sentuhan", () => {
    const hasil = pilihPerluFollowUp(
      [prospek("c", "2026-09-10T00:00:00.000Z")],
      { c: new Date("2026-09-02T00:00:00.000Z") },
      5,
    );

    expect(hasil[0].sentuhanTerakhir).toEqual(
      new Date("2026-09-10T00:00:00.000Z"),
    );
  });

  it("memotong ke batas dan mengurutkan seri dengan id", () => {
    const hasil = pilihPerluFollowUp(
      [
        prospek("z", "2026-09-01T00:00:00.000Z"),
        prospek("y", "2026-09-01T00:00:00.000Z"),
        prospek("x", "2026-09-03T00:00:00.000Z"),
      ],
      {},
      2,
    );

    expect(hasil.map((baris) => baris.id)).toEqual(["y", "z"]);
  });

  it("memetakan nama, nomor, dan status apa adanya", () => {
    const hasil = pilihPerluFollowUp(
      [{ ...prospek("d", "2026-09-01T00:00:00.000Z"), status: "NEGOSIASI" }],
      {},
      5,
    );

    expect(hasil[0]).toEqual({
      id: "d",
      nama: "Nama d",
      noTelp: "0812d",
      status: "NEGOSIASI",
      sentuhanTerakhir: new Date("2026-09-01T00:00:00.000Z"),
    });
  });

  it("tidak mengurutkan ulang array masukan", () => {
    // Sengaja BUKAN Object.freeze: sebuah implementasi yang men-sort array
    // masukan di tempat (bukan menyalinnya lewat map) harus membuat test ini
    // merah lewat assertion urutan, bukan lewat TypeError yang dilempar
    // Array.prototype.sort saat mencoba menulis ke array yang dibekukan.
    const masukan = [
      prospek("m", "2026-09-09T00:00:00.000Z"),
      prospek("n", "2026-09-01T00:00:00.000Z"),
    ];

    pilihPerluFollowUp(masukan, {}, 5);

    expect(masukan.map((baris) => baris.id)).toEqual(["m", "n"]);
  });
});
