import { describe, expect, it } from "vitest";

/**
 * Pembentukan URL daftar iklan dari state filter. Diuji langsung sebagai
 * fungsi murni karena repo ini tidak punya DOM palsu — logika yang tertinggal
 * di dalam komponen tidak akan pernah teruji.
 */

import type { ReactNode } from "react";

import { kolom } from "@/app/admin/presurvei/iklan/IklanTable";
import {
  buildIklanListUrl,
  filterSetelahPindahHalaman,
  filterSetelahUbah,
  kunciStatusDari,
  STATUS_PILIHAN,
  URUTAN_STATUS,
} from "@/app/admin/presurvei/iklan/iklanListQuery";
import type { IklanListItemDto } from "@/modules/presurvei/client";

describe("buildIklanListUrl", () => {
  it("selalu mengirim halaman dan batas", () => {
    expect(
      buildIklanListUrl({ page: 2, search: "", channel: "", isAktif: null }),
    ).toBe("/api/admin/presurvei/iklan?page=2&limit=20");
  });

  it("tidak mengirim filter yang kosong", () => {
    // Mengirim `search=` kosong membuat server menyaring dengan string kosong
    // alih-alih tidak menyaring sama sekali.
    const url = buildIklanListUrl({
      page: 1,
      search: "",
      channel: "",
      isAktif: null,
    });

    expect(url).not.toContain("search=");
    expect(url).not.toContain("channel=");
    expect(url).not.toContain("isAktif=");
  });

  it("mengirim isAktif false, bukan menghilangkannya", () => {
    // `false` itu falsy. Penyaringan berbasis truthiness akan membuat filter
    // "hanya yang nonaktif" diam-diam berubah jadi "semua".
    expect(
      buildIklanListUrl({ page: 1, search: "", channel: "", isAktif: false }),
    ).toContain("isAktif=false");
  });

  it("menyandikan pencarian yang mengandung karakter khusus", () => {
    // Tanpa penyandian, kode kampanye ber-'&' memotong query string dan
    // filter sesudahnya hilang tanpa gejala.
    const url = buildIklanListUrl({
      page: 1,
      search: "promo & diskon",
      channel: "",
      isAktif: null,
    });

    expect(url).toContain("search=promo+%26+diskon");
  });

  it("menggabungkan seluruh filter yang terisi", () => {
    const url = buildIklanListUrl({
      page: 3,
      search: "ramadan",
      channel: "META",
      isAktif: true,
    });

    expect(url).toBe(
      "/api/admin/presurvei/iklan?page=3&limit=20&search=ramadan&channel=META&isAktif=true",
    );
  });

  it("membuang spasi di tepi nilai yang dikirim, bukan hanya saat memeriksa", () => {
    // Penjaga memakai .trim(), tapi nilai yang DIKIRIM juga harus. Tanpa ini,
    // "ramadan " jadi search=ramadan+ dan pencarian server nol hasil.
    // Dibandingkan sebagai URL utuh, bukan `toContain`: di sini `search`
    // adalah parameter terakhir, jadi pola bertanda `&` di ujung tidak akan
    // pernah cocok dan assertion-nya kehilangan gigi.
    expect(
      buildIklanListUrl({
        page: 1,
        search: "  ramadan  ",
        channel: "",
        isAktif: null,
      }),
    ).toBe("/api/admin/presurvei/iklan?page=1&limit=20&search=ramadan");
  });
});

describe("kunciStatusDari", () => {
  it("membedakan nonaktif dari semua", () => {
    // `false` adalah pilihan yang sah, bukan ketiadaan pilihan. Percabangan
    // berbasis truthiness akan menyamakan keduanya, dan pemakai yang memilih
    // "Hanya yang nonaktif" akan melihat seluruh kampanye.
    expect(kunciStatusDari(false)).toBe("nonaktif");
    expect(kunciStatusDari(null)).toBe("semua");
    expect(kunciStatusDari(true)).toBe("aktif");
  });

  it("memetakan tiap kunci ke nilai filter yang benar", () => {
    expect(URUTAN_STATUS.map((kunci) => STATUS_PILIHAN[kunci].isAktif)).toEqual(
      [null, true, false],
    );
    // Label ikut dikunci: menukar "Hanya yang aktif" dengan "Hanya yang
    // nonaktif" tidak mengubah satu pun nilai di atas, tapi pemakai yang
    // memilih "nonaktif" akan melihat kampanye yang aktif.
    expect(URUTAN_STATUS.map((kunci) => STATUS_PILIHAN[kunci].label)).toEqual([
      "Semua status",
      "Hanya yang aktif",
      "Hanya yang nonaktif",
    ]);
  });
});

describe("filterSetelahUbah", () => {
  it("mengembalikan ke halaman pertama saat kriteria berubah", () => {
    // Tanpa ini, pemakai di halaman 5 yang mengetik pencarian akan meminta
    // halaman 5 dari hasil yang cuma satu halaman, dan melihat tabel kosong.
    const hasil = filterSetelahUbah(
      { page: 5, search: "", channel: "", isAktif: null },
      { search: "ramadan" },
    );

    expect(hasil.page).toBe(1);
    expect(hasil.search).toBe("ramadan");
  });

  it("mempertahankan kriteria yang tidak diubah", () => {
    const hasil = filterSetelahUbah(
      { page: 3, search: "ramadan", channel: "META", isAktif: false },
      { channel: "GOOGLE" },
    );

    expect(hasil.search).toBe("ramadan");
    expect(hasil.isAktif).toBe(false);
    expect(hasil.channel).toBe("GOOGLE");
  });
});

describe("filterSetelahPindahHalaman", () => {
  it("mengubah halaman tanpa menyentuh kriteria", () => {
    const hasil = filterSetelahPindahHalaman(
      { page: 1, search: "ramadan", channel: "META", isAktif: false },
      4,
    );

    expect(hasil).toEqual({
      page: 4,
      search: "ramadan",
      channel: "META",
      isAktif: false,
    });
  });
});

/**
 * Menjalankan `render` satu kolom tanpa DOM apa pun.
 *
 * Hanya sah untuk kolom tanggal: keduanya mengembalikan string biasa, bukan
 * JSX. Kolom `channel` dan `isBerjalan` mengembalikan elemen dan memang tidak
 * terjangkau tanpa DOM palsu.
 */
function renderKolomTanggal(
  key: string,
  item: Partial<IklanListItemDto>,
): ReactNode {
  const kolomTanggal = kolom.find((satuKolom) => satuKolom.key === key);
  return kolomTanggal?.render?.(item as IklanListItemDto, 0);
}

describe("kolom tanggal IklanTable", () => {
  it("memformat tanggal mulai, tidak mencetak ISO mentah", () => {
    // Tanpa ini, mengembalikan render ke `item.tanggalMulai` lolos hijau dan
    // tabel mencetak 2026-09-22T00:00:00.000Z ke layar.
    expect(
      renderKolomTanggal("tanggalMulai", {
        tanggalMulai: "2026-09-22T00:00:00.000Z",
      }),
    ).toBe("22 Sep 2026");
  });

  it("memformat tanggal selesai dari fieldnya sendiri", () => {
    // Tanggal sengaja berbeda dari test di atas: kalau kolom ini keliru
    // membaca `tanggalMulai`, nilainya jadi undefined dan hasilnya "-".
    expect(
      renderKolomTanggal("tanggalSelesai", {
        tanggalSelesai: "2026-10-05T00:00:00.000Z",
      }),
    ).toBe("5 Okt 2026");
  });

  it("menampilkan strip untuk kampanye tanpa tanggal selesai", () => {
    expect(renderKolomTanggal("tanggalSelesai", { tanggalSelesai: null })).toBe(
      "-",
    );
  });
});
