import { describe, expect, it } from "vitest";

import {
  buildRekapRencanaUrl,
  buildRencanaListUrl,
  filterAwalRencana,
  filterSetelahPindahHalaman,
  filterSetelahUbah,
  kunciQueryDaftarRencana,
  kunciQueryRekapRencana,
  kunciQueryRincianRencana,
  KUNCI_RENCANA,
  periksaRentangRekap,
  urlBatalRencana,
  urlRincianRencana,
  type FilterRencana,
} from "@/app/admin/presurvei/rencana/rencanaQuery";
import {
  batasRentang,
  keTanggalLokal,
  rentangBulanIni,
  rentangMingguIni,
} from "@/app/admin/presurvei/rencana/rentangTanggal";

const PEKAN_INI = { dari: "2026-09-21", sampai: "2026-09-27" };

describe("rentangTanggal", () => {
  it("membentuk tanggal lokal berawalan nol, bukan tanggal UTC", () => {
    // Konstruktor bertiga angka memakai zona lokal, sama seperti layar.
    expect(keTanggalLokal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("pekan berjalan dimulai Senin dan berakhir Minggu", () => {
    // Sabtu 26 September 2026.
    expect(rentangMingguIni(new Date(2026, 8, 26, 23, 30))).toEqual(PEKAN_INI);
  });

  it("hari Minggu masih milik pekan yang diawali Senin sebelumnya", () => {
    // `getDay()` Minggu = 0; tanpa penyesuaian ia membuka pekan baru.
    expect(rentangMingguIni(new Date(2026, 8, 27))).toEqual(PEKAN_INI);
  });

  it("hari Senin membuka pekannya sendiri", () => {
    expect(rentangMingguIni(new Date(2026, 8, 21))).toEqual(PEKAN_INI);
  });

  it("pekan yang melintasi pergantian bulan dan tahun", () => {
    // Kamis 1 Januari 2026.
    expect(rentangMingguIni(new Date(2026, 0, 1))).toEqual({
      dari: "2025-12-29",
      sampai: "2026-01-04",
    });
  });

  it("bulan berjalan sampai hari terakhirnya, termasuk kabisat", () => {
    expect(rentangBulanIni(new Date(2028, 1, 10))).toEqual({
      dari: "2028-02-01",
      sampai: "2028-02-29",
    });
  });

  it("batas rentang memasang max ke medan dari dan min ke medan sampai", () => {
    expect(batasRentang(PEKAN_INI)).toEqual({
      maksDari: "2026-09-27",
      minSampai: "2026-09-21",
    });
    expect(batasRentang({ dari: "", sampai: "" })).toEqual({
      maksDari: undefined,
      minSampai: undefined,
    });
  });
});

describe("filter & URL daftar rencana", () => {
  const awal = filterAwalRencana(PEKAN_INI);

  it("filter awal hanya membawa rentang", () => {
    expect(awal).toEqual({
      ...PEKAN_INI,
      page: 1,
      salesId: "",
      status: "",
    });
  });

  it("URL memuat param yang terisi saja, dengan nama param validator", () => {
    const url = new URL(buildRencanaListUrl(awal), "http://x");
    expect(url.pathname).toBe("/api/presurvei/rencana");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "1",
      limit: "20",
      dari: "2026-09-21",
      sampai: "2026-09-27",
    });
  });

  it("URL membawa sales dan status saat dipilih", () => {
    const filter: FilterRencana = {
      ...awal,
      page: 3,
      salesId: "sales-1",
      status: "TERLEWAT",
    };
    const params = new URL(buildRencanaListUrl(filter), "http://x")
      .searchParams;
    expect(params.get("salesId")).toBe("sales-1");
    expect(params.get("status")).toBe("TERLEWAT");
    expect(params.get("page")).toBe("3");
  });

  it("mengubah kriteria kembali ke halaman pertama", () => {
    const halamanLima = filterSetelahPindahHalaman(awal, 5);
    expect(halamanLima.page).toBe(5);
    expect(filterSetelahUbah(halamanLima, { status: "SELESAI" })).toEqual({
      ...awal,
      status: "SELESAI",
      page: 1,
    });
  });

  it("semua kunci cache rencana berawalan sama supaya satu invalidasi cukup", () => {
    for (const kunci of [
      kunciQueryDaftarRencana(awal),
      kunciQueryRincianRencana("r-1"),
      kunciQueryRekapRencana(PEKAN_INI),
    ]) {
      expect(kunci[0]).toBe(KUNCI_RENCANA);
    }
  });

  it("kunci daftar berbeda untuk filter berbeda", () => {
    expect(kunciQueryDaftarRencana(awal)).not.toEqual(
      kunciQueryDaftarRencana({ ...awal, status: "BATAL" }),
    );
  });

  it("URL rincian dan batal meng-encode id", () => {
    expect(urlRincianRencana("a/b")).toBe("/api/presurvei/rencana/a%2Fb");
    expect(urlBatalRencana("r-1")).toBe("/api/presurvei/rencana/r-1/batal");
  });
});

describe("rekap rencana", () => {
  it("URL rekap membawa dari dan sampai", () => {
    expect(buildRekapRencanaUrl(PEKAN_INI)).toBe(
      "/api/presurvei/rencana/rekap?dari=2026-09-21&sampai=2026-09-27",
    );
  });

  it("rentang sah tidak berpesan", () => {
    expect(periksaRentangRekap(PEKAN_INI)).toBeNull();
  });

  it("menolak rentang kosong dan terbalik", () => {
    expect(
      periksaRentangRekap({ dari: "", sampai: "2026-09-01" }),
    ).not.toBeNull();
    expect(
      periksaRentangRekap({ dari: "2026-09-10", sampai: "2026-09-01" }),
    ).toMatch(/sebelum/);
  });

  it("batas 92 hari mengikuti rekapRencanaSchema (selisih < 92)", () => {
    // 1 Jan + 91 hari = 2 Apr (2026 bukan kabisat) → sah.
    expect(
      periksaRentangRekap({ dari: "2026-01-01", sampai: "2026-04-02" }),
    ).toBeNull();
    expect(
      periksaRentangRekap({ dari: "2026-01-01", sampai: "2026-04-03" }),
    ).toMatch(/92 hari/);
  });
});
