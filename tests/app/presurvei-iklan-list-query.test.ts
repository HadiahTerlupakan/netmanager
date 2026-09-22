import { describe, expect, it } from "vitest";

/**
 * Pembentukan URL daftar iklan dari state filter. Diuji langsung sebagai
 * fungsi murni karena repo ini tidak punya DOM palsu — logika yang tertinggal
 * di dalam komponen tidak akan pernah teruji.
 */

import { buildIklanListUrl } from "@/app/admin/presurvei/iklan/iklanListQuery";

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
});
