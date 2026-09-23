import { describe, expect, it } from "vitest";

import {
  buildProspekKolomUrl,
  cariHalamanGagal,
  daftarHalaman,
  gabungKartu,
  halamanTermuat,
  isTakBertuan,
  keadaanKolom,
  muatanSetelahMuatLebih,
  ringkasJumlahKolom,
  teksJumlahKolom,
  tentukanLangkahMuat,
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
  it("membaca meta yang terakhir tiba, bukan halaman terjauh", () => {
    // Setelah invalidasi semua halaman diambil ulang bersamaan; di sini
    // halaman satu dijawab paling akhir dan hitungannya yang paling baru.
    expect(
      ringkasJumlahKolom(
        [
          { meta: { total: 48, totalPages: 3 }, diperbaruiPada: 2000 },
          { meta: { total: 47, totalPages: 2 }, diperbaruiPada: 1000 },
        ],
        2,
      ),
    ).toEqual({ total: 48, adaLagi: true });
  });

  it("membaca halaman berikutnya bila ia yang lebih baru", () => {
    // Nilai kedua meta sengaja berbeda: membaca meta yang salah terlihat.
    expect(
      ringkasJumlahKolom(
        [
          { meta: { total: 40, totalPages: 2 }, diperbaruiPada: 1000 },
          { meta: { total: 47, totalPages: 3 }, diperbaruiPada: 2000 },
        ],
        2,
      ),
    ).toEqual({ total: 47, adaLagi: true });
  });

  it("tidak menawarkan halaman lagi di halaman terakhir", () => {
    expect(
      ringkasJumlahKolom(
        [{ meta: { total: 12, totalPages: 1 }, diperbaruiPada: 1000 }],
        1,
      ),
    ).toEqual({ total: 12, adaLagi: false });
  });

  it("melewati halaman yang belum punya meta", () => {
    expect(
      ringkasJumlahKolom(
        [
          { meta: { total: 47, totalPages: 3 }, diperbaruiPada: 1000 },
          { meta: undefined, diperbaruiPada: 0 },
        ],
        2,
      ),
    ).toEqual({ total: 47, adaLagi: true });
  });

  it("menganggap kolom kosong sebelum meta apa pun tiba", () => {
    expect(
      ringkasJumlahKolom([{ meta: undefined, diperbaruiPada: 0 }], 1),
    ).toEqual({ total: 0, adaLagi: false });
  });
});

describe("cariHalamanGagal", () => {
  it("menunjuk halaman gagal pertama, dihitung dari satu", () => {
    expect(cariHalamanGagal([false, true, true])).toBe(2);
  });

  it("menunjuk halaman pertama bila ia yang gagal", () => {
    expect(cariHalamanGagal([true, false])).toBe(1);
  });

  it("null bila semua halaman berhasil", () => {
    expect(cariHalamanGagal([false, false])).toBeNull();
  });
});

describe("tentukanLangkahMuat", () => {
  it("mencoba ulang halaman yang gagal alih-alih maju", () => {
    // Maju melewati halaman gagal membuang dua puluh kartu tanpa jejak.
    expect(tentukanLangkahMuat(2)).toEqual({ jenis: "coba-lagi", halaman: 2 });
  });

  it("maju bila tidak ada halaman yang gagal", () => {
    expect(tentukanLangkahMuat(null)).toEqual({ jenis: "maju" });
  });
});

describe("keadaanKolom", () => {
  it("membedakan kolom gagal dari kolom kosong", () => {
    expect(
      keadaanKolom({ isLoading: false, halamanGagal: 1, jumlahKartu: 0 }),
    ).toBe("gagal");
  });

  it("kosong hanya bila tidak ada yang gagal", () => {
    expect(
      keadaanKolom({ isLoading: false, halamanGagal: null, jumlahKartu: 0 }),
    ).toBe("kosong");
  });

  it("tetap berisi walau halaman berikutnya gagal", () => {
    expect(
      keadaanKolom({ isLoading: false, halamanGagal: 2, jumlahKartu: 20 }),
    ).toBe("berisi");
  });

  it("memuat selama halaman pertama belum tiba", () => {
    expect(
      keadaanKolom({ isLoading: true, halamanGagal: null, jumlahKartu: 0 }),
    ).toBe("memuat");
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
