import { describe, expect, it } from "vitest";

import {
  buildProspekKolomUrl,
  daftarHalaman,
  gabungKartu,
  halamanTermuat,
  isTakBertuan,
  muatanSetelahMuatLebih,
  ringkasJumlahKolom,
  teksJumlahKolom,
} from "@/app/admin/presurvei/prospek/prospekKolomQuery";
import type { ProspekListItemDto } from "@/modules/presurvei/client";

/** Kartu minimal; `id` dan `nama` sengaja berbeda supaya tertukarnya terlihat. */
function kartu(id: string): ProspekListItemDto {
  return {
    id,
    nama: `Nama ${id}`,
    noTelp: "0812",
    alamat: "Jl. Mawar",
    sumber: "LAPANGAN",
    status: "BARU",
    pemilikId: "sales-1",
    paketDiminati: null,
    createdAt: "2026-09-22T00:00:00.000Z",
  };
}

describe("buildProspekKolomUrl", () => {
  it("menyaring tepat satu status per kolom", () => {
    expect(buildProspekKolomUrl("NEGOSIASI", 1)).toBe(
      "/api/presurvei/prospek?status=NEGOSIASI&page=1&limit=20",
    );
  });

  it("meneruskan halaman untuk memuat lebih banyak", () => {
    // Tiap kolom berpaginasi sendiri; tanpa ini tombol "muat lebih" akan
    // mengambil ulang halaman satu dan kartunya tidak pernah bertambah.
    expect(buildProspekKolomUrl("BARU", 3)).toContain("page=3");
  });

  it("memakai status yang diminta, bukan yang pertama", () => {
    // Keduanya string bersebelahan di pemanggilan; tertukarnya membuat
    // seluruh kolom menampilkan isi kolom yang sama tanpa ditolak compiler.
    expect(buildProspekKolomUrl("TIDAK_LAYAK", 1)).toContain(
      "status=TIDAK_LAYAK",
    );
    expect(buildProspekKolomUrl("DEAL", 1)).toContain("status=DEAL");
  });
});

describe("halamanTermuat", () => {
  it("memakai halaman yang tersimpan untuk status yang sama", () => {
    expect(halamanTermuat({ status: "TERTARIK", halaman: 4 }, "TERTARIK")).toBe(
      4,
    );
  });

  it("kembali ke halaman pertama saat statusnya berganti", () => {
    // Tanpa reset ini kolom yang sudah dimuat sampai halaman empat, lalu
    // dipakai untuk status lain, langsung meminta empat halaman status baru.
    expect(halamanTermuat({ status: "TERTARIK", halaman: 4 }, "DEAL")).toBe(1);
  });
});

describe("muatanSetelahMuatLebih", () => {
  it("maju satu halaman untuk status yang sama", () => {
    expect(
      muatanSetelahMuatLebih({ status: "BARU", halaman: 2 }, "BARU"),
    ).toEqual({ status: "BARU", halaman: 3 });
  });

  it("mulai dari halaman pertama bila muatan lama milik status lain", () => {
    expect(
      muatanSetelahMuatLebih({ status: "BARU", halaman: 5 }, "NEGOSIASI"),
    ).toEqual({ status: "NEGOSIASI", halaman: 2 });
  });
});

describe("daftarHalaman", () => {
  it("mencakup setiap halaman dari satu sampai yang terjauh", () => {
    // Halaman yang terlewat berarti kartunya hilang dari tengah kolom.
    expect(daftarHalaman(3)).toEqual([1, 2, 3]);
  });

  it("hanya halaman pertama pada muatan awal", () => {
    expect(daftarHalaman(1)).toEqual([1]);
  });
});

describe("gabungKartu", () => {
  it("menambahkan halaman berikutnya di belakang, bukan menukarnya", () => {
    const hasil = gabungKartu([[kartu("p1"), kartu("p2")], [kartu("p3")]]);

    expect(hasil.map((item) => item.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("membuang kartu kembar akibat offset yang bergeser", () => {
    // p2 terdorong ke halaman dua oleh prospek baru di antara dua pengambilan.
    const hasil = gabungKartu([
      [kartu("p1"), kartu("p2")],
      [kartu("p2"), kartu("p3")],
    ]);

    expect(hasil.map((item) => item.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("melewati halaman yang belum tiba", () => {
    const hasil = gabungKartu([[kartu("p1")], undefined]);

    expect(hasil.map((item) => item.id)).toEqual(["p1"]);
  });
});

describe("ringkasJumlahKolom", () => {
  it("membaca total dan sisa halaman dari meta terjauh yang tiba", () => {
    // Nilai kedua meta sengaja berbeda: membaca meta yang salah terlihat.
    expect(
      ringkasJumlahKolom(
        [
          { total: 40, totalPages: 2 },
          { total: 47, totalPages: 3 },
        ],
        2,
      ),
    ).toEqual({ total: 47, adaLagi: true });
  });

  it("tidak menawarkan halaman lagi di halaman terakhir", () => {
    expect(ringkasJumlahKolom([{ total: 12, totalPages: 1 }], 1)).toEqual({
      total: 12,
      adaLagi: false,
    });
  });

  it("memakai meta terakhir yang sudah tiba selama halaman baru dimuat", () => {
    expect(
      ringkasJumlahKolom([{ total: 47, totalPages: 3 }, undefined], 2),
    ).toEqual({ total: 47, adaLagi: true });
  });

  it("menganggap kolom kosong sebelum meta apa pun tiba", () => {
    expect(ringkasJumlahKolom([undefined], 1)).toEqual({
      total: 0,
      adaLagi: false,
    });
  });
});

describe("teksJumlahKolom", () => {
  it("menyebut kartu yang tampil dan total di server", () => {
    expect(teksJumlahKolom(20, 47)).toBe("menampilkan 20 dari 47");
  });

  it("tetap menulis nol, bukan kosong", () => {
    expect(teksJumlahKolom(0, 0)).toBe("menampilkan 0 dari 0");
  });
});

describe("isTakBertuan", () => {
  it("menandai prospek tanpa pemilik", () => {
    expect(isTakBertuan({ pemilikId: null })).toBe(true);
  });

  it("menandai pemilik string kosong", () => {
    expect(isTakBertuan({ pemilikId: "" })).toBe(true);
  });

  it("tidak menandai prospek yang punya pemilik", () => {
    expect(isTakBertuan({ pemilikId: "sales-3" })).toBe(false);
  });
});
