// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel layar laporan pencapaian (Task 16) yang hanya terlihat saat dirender.
 *
 * `keBarisTampilan` dan `pesanLaporanKosong` sudah diuji tanpa DOM
 * (`presurvei-baris-laporan.test.ts`), hook-nya di
 * `presurvei-laporan-hook.test.ts`. Yang dikunci di sini, kandidat Task 19 di
 * ledger Task 16:
 *
 * - `LaporanTable`: cabang `SelMetrik` bertarget nol vs bilah, lebar bilah
 *   dari `lebarBilah` (bukan `persen`), tiap kolom ke metriknya sendiri, dan
 *   `emptyMessage`;
 * - `LaporanClient`: `isError` ke tabel, `onUbah` pemilih periode,
 *   `keBarisTampilan` diberi `daftarSales`, dan KEDUA keterangan batasan —
 *   teks UTC wajib menyebut ketiga metrik (review Task 16);
 * - gerbang `page.tsx`.
 */

const palsu = vi.hoisted(() => ({
  ensureAnyPermission: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-hot-toast", async () =>
  (await import("./presurvei-jsdom-harness")).modulToastPalsu(
    palsu.toastSuccess,
    palsu.toastError,
  ),
);

vi.mock("@/lib/rbac", () => ({
  ensureAnyPermission: palsu.ensureAnyPermission,
}));

import type {
  BarisTampilan,
  MetrikTampilan,
} from "@/app/admin/presurvei/laporan/barisLaporan";
import { LaporanClient } from "@/app/admin/presurvei/laporan/LaporanClient";
import { LaporanTable } from "@/app/admin/presurvei/laporan/LaporanTable";
import HalamanLaporan from "@/app/admin/presurvei/laporan/page";
import type {
  BarisLaporanDto,
  SalesPresurveiDto,
} from "@/modules/presurvei/client";

import {
  bongkarPanggung,
  isiMedan,
  pasangPanggung,
  render,
  responsJson,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

/** Ditulis literal: test harus merah bila rute, izin, atau teksnya diganti. */
const URL_LAPORAN = "/api/admin/presurvei/laporan";
const URL_SALES = "/api/admin/presurvei/sales";
const IZIN_BACA_HALAMAN = ["presurvei_laporan:read"];
const PESAN_TABEL_GAGAL = "Laporan gagal dimuat.";
const PESAN_TABEL_KOSONG = "Belum ada target untuk periode ini.";
const KETERANGAN_DAFTAR_TARGET =
  "Sales yang belum ditetapkan targetnya pada periode ini tidak muncul di daftar, karena laporan disusun dari daftar target.";
const KETERANGAN_UTC =
  "Batas periode memakai waktu UTC, bukan zona waktu setempat. Kunjungan, prospek baru, dan konversi pada jam-jam pertama tanggal 1 dapat terhitung pada bulan sebelumnya.";

const SEKARANG = new Date("2026-09-15T05:00:00.000Z");

/** Metrik tampilan dengan nilai yang semuanya berbeda satu sama lain. */
function metrik(
  target: number,
  tercapai: number,
  persen: number,
  lebarBilah: number,
): MetrikTampilan {
  return { target, tercapai, persen, lebarBilah, isTargetNol: target <= 0 };
}

/**
 * Persen 130 dengan lebar bilah 100: sel yang memakai `persen` sebagai lebar
 * terbaca salah. Angka tiap kolom berbeda supaya tertukarnya terbaca.
 */
const barisBertarget: BarisTampilan = {
  userId: "sales-budi",
  namaSales: "Budi",
  kunjungan: metrik(10, 13, 130, 100),
  prospek: metrik(20, 5, 25, 25),
  konversi: metrik(8, 2, 25, 25),
  isTanpaTarget: false,
};

const barisTanpaTarget: BarisTampilan = {
  userId: "sales-cici",
  namaSales: "Cici",
  kunjungan: metrik(0, 4, 100, 0),
  prospek: metrik(0, 1, 100, 0),
  konversi: metrik(0, 0, 100, 0),
  isTanpaTarget: true,
};

const daftarSales: SalesPresurveiDto[] = [{ id: "sales-budi", nama: "Budi" }];

const laporanSeptember: BarisLaporanDto[] = [
  {
    userId: "sales-budi",
    periodeTahun: 2026,
    periodeBulan: 9,
    kunjungan: { target: 10, tercapai: 6, persen: 60 },
    prospek: { target: 4, tercapai: 1, persen: 25 },
    konversi: { target: 2, tercapai: 1, persen: 50 },
  },
];

let panggung: Panggung;
let mockFetch: ReturnType<typeof vi.fn>;
let isLaporanGagal: boolean;

/** Sel `<td>` baris tabel desktop ke-`indeks`. */
function selBaris(indeks: number): HTMLTableCellElement[] {
  const baris = document.body.querySelectorAll("table tbody tr")[indeks];
  return [...baris.querySelectorAll("td")];
}

/** Judul kolom tabel desktop, urut tampil. */
function judulKolom(): string[] {
  return [...document.body.querySelectorAll("table thead th")].map((th) =>
    th.textContent.trim(),
  );
}

/** Lebar bilah di sel, atau null bila sel tidak berbilah. */
function lebarBilah(sel: HTMLElement): string | null {
  return sel.querySelector<HTMLElement>(".bg-indigo-500")?.style.width ?? null;
}

/** URL GET laporan yang diminta, berurutan. */
function urlLaporanDiminta(): string[] {
  return mockFetch.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith(`${URL_LAPORAN}?`));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SEKARANG);
  panggung = pasangPanggung();
  palsu.ensureAnyPermission.mockReset();
  palsu.ensureAnyPermission.mockResolvedValue(undefined);
  palsu.toastSuccess.mockReset();
  palsu.toastError.mockReset();
  isLaporanGagal = false;

  mockFetch = vi.fn(async (url: string) => {
    if (url.startsWith(`${URL_LAPORAN}?`)) {
      if (isLaporanGagal) {
        return responsJson(500, { success: false, error: "rusak" });
      }
      const isSeptember = url.includes("tahun=2026&bulan=9");
      return responsJson(200, {
        success: true,
        data: isSeptember ? laporanSeptember : [],
      });
    }
    if (url === URL_SALES) {
      return responsJson(200, { success: true, data: daftarSales });
    }
    return responsJson(404, { success: false, error: "tidak dikenal" });
  });
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(async () => {
  await bongkarPanggung(panggung);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("LaporanTable", () => {
  async function renderTabel(baris: BarisTampilan[], isError = false) {
    await render(
      panggung,
      <LaporanTable baris={baris} isLoading={false} isError={isError} />,
    );
  }

  it("memasang tiap kolom ke metriknya sendiri", async () => {
    await renderTabel([barisBertarget]);

    expect(judulKolom()).toEqual([
      "Sales",
      "Kunjungan",
      "Prospek baru",
      "Konversi",
    ]);
    const [, kunjungan, prospek, konversi] = selBaris(0);
    expect(kunjungan.textContent).toBe("13 / 10 · 130%");
    expect(prospek.textContent).toBe("5 / 20 · 25%");
    expect(konversi.textContent).toBe("2 / 8 · 25%");
  });

  it("melebarkan bilah menurut lebarBilah yang dibatasi, bukan persen mentah", async () => {
    await renderTabel([barisBertarget]);

    const [, kunjungan, prospek] = selBaris(0);
    expect(lebarBilah(kunjungan)).toBe("100%");
    expect(lebarBilah(prospek)).toBe("25%");
  });

  it("menampilkan metrik bertarget nol tanpa bilah dan tanpa persen", async () => {
    await renderTabel([barisTanpaTarget]);

    const [sales, kunjungan, prospek] = selBaris(0);
    expect(kunjungan.textContent).toBe("4(tanpa target)");
    expect(prospek.textContent).toBe("1(tanpa target)");
    expect(lebarBilah(kunjungan)).toBeNull();
    expect(sales.textContent).toBe("CiciTarget belum ditetapkan");
  });

  it("tidak menandai baris bertarget sebagai belum ditetapkan", async () => {
    await renderTabel([barisBertarget]);

    expect(selBaris(0)[0].textContent).toBe("Budi");
  });

  it("membedakan laporan gagal dari periode tanpa target", async () => {
    await renderTabel([], true);
    expect(document.body.textContent).toContain(PESAN_TABEL_GAGAL);
    expect(document.body.textContent).not.toContain(PESAN_TABEL_KOSONG);

    await renderTabel([], false);
    expect(document.body.textContent).toContain(PESAN_TABEL_KOSONG);
    expect(document.body.textContent).not.toContain(PESAN_TABEL_GAGAL);
  });
});

describe("LaporanClient", () => {
  it("memberi label nama sales dari daftar sales, bukan label cadangan", async () => {
    await render(panggung, <LaporanClient />);

    await tungguSampai(
      () => selBaris(0)?.[0]?.textContent === "Budi",
      "baris Budi berlabel nama",
    );
    expect(document.body.textContent).not.toContain("Sales tak tercantum");
    expect(selBaris(0)[1].textContent).toBe("6 / 10 · 60%");
  });

  it("menampilkan kedua keterangan batasan, dengan teks UTC yang menyebut ketiga metrik", async () => {
    await render(panggung, <LaporanClient />);

    const paragraf = [...document.body.querySelectorAll("p")].map((p) =>
      p.textContent.replace(/\s+/g, " ").trim(),
    );
    expect(paragraf).toContain(KETERANGAN_DAFTAR_TARGET);
    expect(paragraf).toContain(KETERANGAN_UTC);
  });

  it("menyebut laporan gagal dimuat, bukan kosong, saat GET ditolak", async () => {
    isLaporanGagal = true;
    await render(panggung, <LaporanClient />);

    await tungguSampai(
      () => document.body.textContent.includes(PESAN_TABEL_GAGAL),
      "pesan tabel gagal",
    );
    expect(document.body.textContent).not.toContain(PESAN_TABEL_KOSONG);
  });

  it("meminta laporan periode baru saat pemilih periode diubah", async () => {
    await render(panggung, <LaporanClient />);
    await tungguSampai(
      () => urlLaporanDiminta().length >= 1,
      "laporan periode bawaan diminta",
    );
    expect(urlLaporanDiminta()).toEqual([`${URL_LAPORAN}?tahun=2026&bulan=9`]);

    await isiMedan('select[aria-label="Bulan periode"]', "4");

    await tungguSampai(
      () => urlLaporanDiminta().includes(`${URL_LAPORAN}?tahun=2026&bulan=4`),
      "laporan April 2026 diminta",
    );
  });
});

describe("page.tsx laporan", () => {
  it("menjaga halaman dengan izin baca laporan yang persis", async () => {
    const elemen = await HalamanLaporan();

    expect(palsu.ensureAnyPermission).toHaveBeenCalledWith(IZIN_BACA_HALAMAN);
    expect(elemen.type).toBe(LaporanClient);
  });

  it("tidak merender apa pun bila gerbang izin menolak", async () => {
    palsu.ensureAnyPermission.mockRejectedValue(new Error("403"));

    await expect(HalamanLaporan()).rejects.toThrow("403");
  });
});
