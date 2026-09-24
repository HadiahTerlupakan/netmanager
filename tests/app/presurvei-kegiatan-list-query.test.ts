import { describe, expect, it } from "vitest";

import {
  batasRentangTanggal,
  buildKegiatanListUrl,
  filterSetelahPindahHalaman,
  filterSetelahUbah,
  opsiSales,
  teksSalesKegiatan,
  teksWaktuKegiatan,
  type FilterKegiatan,
} from "@/app/admin/presurvei/kegiatan/kegiatanListQuery";
import type {
  KegiatanListItemDto,
  SalesPresurveiDto,
} from "@/modules/presurvei/client";

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
    namaSales: null,
    peranPelaku: null,
    departemenPelaku: null,
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
  const TANPA_DAFTAR: SalesPresurveiDto[] = [];

  it("memakai daftar sales tenant beserta namanya, terurut menurut nama", () => {
    expect(
      opsiSales(
        [
          { id: "sales-9", nama: "Wati" },
          { id: "sales-2", nama: "Andi" },
        ],
        [],
        "",
      ),
    ).toEqual([
      { id: "sales-2", nama: "Andi" },
      { id: "sales-9", nama: "Wati" },
    ]);
  });

  it("melengkapi daftar dengan pelaku baris yang tidak ada di daftar, tanpa duplikat", () => {
    // Daftar sales hanya memuat yang AKTIF; pelaku kegiatan lama yang sudah
    // dinonaktifkan tetap harus bisa dipilih selama kegiatannya tampil.
    expect(
      opsiSales(
        [{ id: "sales-2", nama: "Andi" }],
        [
          kegiatan({ userId: "sales-lama", namaSales: "Zaenal" }),
          kegiatan({ userId: "sales-2", namaSales: "Andi" }),
          kegiatan({ userId: "sales-lama", namaSales: "Zaenal" }),
        ],
        "",
      ),
    ).toEqual([
      { id: "sales-2", nama: "Andi" },
      { id: "sales-lama", nama: "Zaenal" },
    ]);
  });

  it("mendahulukan nama dari daftar sales atas nama di baris", () => {
    // Baris bisa membawa `namaSales` null (pelaku tak bisa ditampilkan);
    // daftar sales tenant tidak pernah.
    expect(
      opsiSales(
        [{ id: "sales-3", nama: "Citra" }],
        [kegiatan({ userId: "sales-3", namaSales: null })],
        "",
      ),
    ).toEqual([{ id: "sales-3", nama: "Citra" }]);
  });

  it("memakai id sebagai label pelaku baris yang tidak bernama", () => {
    expect(
      opsiSales(
        TANPA_DAFTAR,
        [kegiatan({ userId: "sales-tanpa-nama", namaSales: null })],
        "",
      ),
    ).toEqual([{ id: "sales-tanpa-nama", nama: "sales-tanpa-nama" }]);
  });

  it("mempertahankan sales terpilih walau tidak ada di daftar maupun baris", () => {
    // Menyaring satu sales lalu mempersempit rentang tanggal sampai nol baris
    // akan menghapus pilihan itu dari <select>. Layar lalu menampilkan "Semua
    // sales" padahal filternya masih menyaring satu orang — berbohong diam-diam.
    expect(opsiSales(TANPA_DAFTAR, [], "sales-7")).toEqual([
      { id: "sales-7", nama: "sales-7" },
    ]);
  });

  it("memberi sales terpilih namanya bila ia ada di daftar", () => {
    expect(opsiSales([{ id: "sales-7", nama: "Gita" }], [], "sales-7")).toEqual(
      [{ id: "sales-7", nama: "Gita" }],
    );
  });

  it("tidak menambahkan pilihan kosong saat tidak ada sales terpilih", () => {
    expect(opsiSales(TANPA_DAFTAR, [], "")).toEqual([]);
  });

  it("tidak mengubah daftar sales yang diterimanya", () => {
    // Daftar itu milik cache React Query; mengurutkannya di tempat akan
    // merusak data yang dibagi layar lain.
    const daftar = Object.freeze([
      Object.freeze({ id: "sales-9", nama: "Wati" }),
      Object.freeze({ id: "sales-2", nama: "Andi" }),
    ]);

    opsiSales(daftar, [], "");

    expect(daftar.map((sales) => sales.id)).toEqual(["sales-9", "sales-2"]);
  });
});

describe("teksSalesKegiatan", () => {
  it("menampilkan nama pelaku bila ada", () => {
    expect(
      teksSalesKegiatan(kegiatan({ userId: "sales-1", namaSales: "Rina" })),
    ).toBe("Rina");
  });

  it("jatuh ke id pelaku saat nama null", () => {
    expect(
      teksSalesKegiatan(kegiatan({ userId: "sales-1", namaSales: null })),
    ).toBe("sales-1");
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
