import { describe, expect, it } from "vitest";

import {
  batasRentangTanggal,
  buildKegiatanListUrl,
  filterSetelahPindahHalaman,
  filterSetelahUbah,
  opsiSales,
  teksWaktuKegiatan,
  type FilterKegiatan,
} from "@/app/admin/presurvei/kegiatan/kegiatanListQuery";
import type { KegiatanListItemDto } from "@/modules/presurvei/client";

const kosong: FilterKegiatan = {
  page: 1,
  userId: "",
  jenis: "",
  hasil: "",
  dariTanggal: "",
  sampaiTanggal: "",
};

/**
 * Satu baris daftar kegiatan.
 *
 * Tipe kembaliannya ditulis eksplisit: dengan `strictNullChecks: false`, object
 * literal ber-`null` tanpa tipe kontekstual memicu TS7018.
 */
function kegiatan(ubahan: Partial<KegiatanListItemDto>): KegiatanListItemDto {
  return {
    id: "keg-1",
    jenis: "KUNJUNGAN",
    userId: "sales-1",
    prospekId: null,
    waktuMulai: "2026-09-22T01:30:00.000Z",
    alamatDikunjungi: "Jl. Melati 3",
    ditemuiNama: "Bu Ani",
    latitude: -6.2,
    longitude: 106.8,
    hasil: "TERTARIK",
    jumlahFoto: 2,
    ...ubahan,
  };
}

describe("buildKegiatanListUrl", () => {
  it("selalu mengirim halaman dan batas", () => {
    expect(buildKegiatanListUrl(kosong)).toBe(
      "/api/presurvei/kegiatan?page=1&limit=20",
    );
  });

  it("tidak mengirim filter yang kosong", () => {
    const url = buildKegiatanListUrl(kosong);

    expect(url).not.toContain("userId=");
    expect(url).not.toContain("jenis=");
    expect(url).not.toContain("dariTanggal=");
  });

  it("mengirim rentang tanggal apa adanya", () => {
    // Dua tanggal sengaja berbeda jauh: keduanya string bersebelahan, dan
    // tertukarnya menghasilkan rentang terbalik yang selalu kosong tanpa
    // satu pun pesan kesalahan.
    const url = buildKegiatanListUrl({
      ...kosong,
      dariTanggal: "2026-09-01",
      sampaiTanggal: "2026-09-30",
    });

    expect(url).toContain("dariTanggal=2026-09-01");
    expect(url).toContain("sampaiTanggal=2026-09-30");
  });

  it("menggabungkan seluruh filter yang terisi", () => {
    expect(
      buildKegiatanListUrl({
        page: 2,
        userId: "sales-7",
        jenis: "SURVEI_LOKASI",
        hasil: "TERTARIK",
        dariTanggal: "2026-09-01",
        sampaiTanggal: "2026-09-30",
      }),
    ).toBe(
      "/api/presurvei/kegiatan?page=2&limit=20&userId=sales-7&jenis=SURVEI_LOKASI&hasil=TERTARIK&dariTanggal=2026-09-01&sampaiTanggal=2026-09-30",
    );
  });

  it("memakai batas lebih besar untuk peta", () => {
    // Peta menggambar seluruh titik pada rentang itu sekaligus; membatasinya
    // ke 20 akan menampilkan sebagian kunjungan dan menyesatkan pembacanya.
    expect(buildKegiatanListUrl(kosong, { untukPeta: true })).toContain(
      "limit=100",
    );
  });

  it("memakukan peta ke halaman pertama walau tabel sedang di halaman lain", () => {
    // Assertion string penuh, bukan `toContain`: tanpa pemakuan ini, membuka
    // tab peta dari halaman 3 meminta baris 201-300 dan peta menggambar nol
    // titik di sebelah tabel yang penuh, tanpa satu pun pesan. `toContain`
    // pada "limit=100" saja tidak pernah menyentuh `page`.
    expect(
      buildKegiatanListUrl(
        { ...kosong, page: 3, hasil: "DEAL" },
        { untukPeta: true },
      ),
    ).toBe("/api/presurvei/kegiatan?page=1&limit=100&hasil=DEAL");
  });

  it("memangkas spasi pada nilai yang dikirim, bukan hanya pada penjaganya", () => {
    // Nilai tak ter-trim membuat pencarian server nol hasil. Hari ini seluruh
    // sumber filter adalah <select> dan <input type="date">, jadi spasi tidak
    // bisa lahir dari layar — penjaga ini defensif untuk medan teks bebas yang
    // mungkin menyusul, dan dikunci di sini supaya ia sudah terbukti benar.
    expect(buildKegiatanListUrl({ ...kosong, userId: "  sales-7  " })).toBe(
      "/api/presurvei/kegiatan?page=1&limit=20&userId=sales-7",
    );
  });

  it("memperlakukan nilai berisi spasi saja sebagai kosong", () => {
    expect(buildKegiatanListUrl({ ...kosong, userId: "   " })).toBe(
      "/api/presurvei/kegiatan?page=1&limit=20",
    );
  });
});

describe("batasRentangTanggal", () => {
  it("memasang ujung atas rentang sebagai batas medan 'dari' saja", () => {
    // Sengaja ASIMETRIS: hanya `sampaiTanggal` yang terisi, sehingga menukar
    // `min` dengan `max` memindahkan nilainya ke medan yang salah dan membuat
    // sisi satunya `undefined` — langsung merah, bukan sekadar bertukar diam.
    expect(
      batasRentangTanggal({ ...kosong, sampaiTanggal: "2026-09-30" }),
    ).toEqual({ maksDariTanggal: "2026-09-30", minSampaiTanggal: undefined });
  });

  it("memasang ujung bawah rentang sebagai batas medan 'sampai' saja", () => {
    expect(
      batasRentangTanggal({ ...kosong, dariTanggal: "2026-09-01" }),
    ).toEqual({ maksDariTanggal: undefined, minSampaiTanggal: "2026-09-01" });
  });

  it("tidak membatasi apa pun saat kedua medan kosong", () => {
    expect(batasRentangTanggal(kosong)).toEqual({
      maksDariTanggal: undefined,
      minSampaiTanggal: undefined,
    });
  });
});

describe("filterSetelahUbah", () => {
  it("mengembalikan halaman ke satu saat kriteria berubah", () => {
    // Menyaring dari halaman lima tanpa reset ini menghasilkan tabel kosong,
    // dan pemakai menyimpulkan datanya tidak ada.
    expect(
      filterSetelahUbah({ ...kosong, page: 5 }, { hasil: "DEAL" }),
    ).toEqual({
      page: 1,
      userId: "",
      jenis: "",
      hasil: "DEAL",
      dariTanggal: "",
      sampaiTanggal: "",
    });
  });

  it("tidak memutasi filter lama", () => {
    const lama: FilterKegiatan = { ...kosong, page: 5 };

    filterSetelahUbah(lama, { hasil: "DEAL" });

    expect(lama).toEqual({
      page: 5,
      userId: "",
      jenis: "",
      hasil: "",
      dariTanggal: "",
      sampaiTanggal: "",
    });
  });
});

describe("filterSetelahPindahHalaman", () => {
  it("mempertahankan seluruh kriteria saat halaman berpindah", () => {
    expect(
      filterSetelahPindahHalaman(
        {
          page: 1,
          userId: "sales-7",
          jenis: "TELEPON",
          hasil: "DEAL",
          dariTanggal: "2026-09-01",
          sampaiTanggal: "2026-09-30",
        },
        4,
      ),
    ).toEqual({
      page: 4,
      userId: "sales-7",
      jenis: "TELEPON",
      hasil: "DEAL",
      dariTanggal: "2026-09-01",
      sampaiTanggal: "2026-09-30",
    });
  });
});

describe("opsiSales", () => {
  it("mengumpulkan id sales dari baris tanpa duplikat dan terurut", () => {
    expect(
      opsiSales(
        [
          kegiatan({ userId: "sales-9" }),
          kegiatan({ userId: "sales-2" }),
          kegiatan({ userId: "sales-9" }),
        ],
        "",
      ),
    ).toEqual(["sales-2", "sales-9"]);
  });

  it("mempertahankan sales terpilih walau barisnya tidak ada", () => {
    // Menyaring satu sales lalu mempersempit rentang tanggal sampai nol baris
    // akan menghapus pilihan itu dari <select>. Layar lalu menampilkan "Semua
    // sales" padahal filternya masih menyaring satu orang — berbohong diam-diam.
    expect(opsiSales([], "sales-7")).toEqual(["sales-7"]);
  });

  it("tidak menambahkan pilihan kosong saat tidak ada sales terpilih", () => {
    expect(opsiSales([], "")).toEqual([]);
  });
});

describe("teksWaktuKegiatan", () => {
  it("menampilkan tanggal dan jam waktu lokal, bukan ISO mentah", () => {
    // Bergantung pada pemakuan `process.env.TZ = "Asia/Jakarta"` di
    // `tests/setup.ts` — bukan bug produksi kalau assertion ini bergeser.
    // Nilainya sengaja melewati tengah malam UTC: 23:45Z tanggal 22 jatuh pada
    // 06:45 tanggal 23 di Jakarta, sehingga memotong string ISO atau memakai
    // `formatDateDisplay` (tanpa jam) langsung merah.
    expect(
      teksWaktuKegiatan(kegiatan({ waktuMulai: "2026-09-22T23:45:00.000Z" })),
    ).toBe("23 Sep 2026 06:45");
  });
});
