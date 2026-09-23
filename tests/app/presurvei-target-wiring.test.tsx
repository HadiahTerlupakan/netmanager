// @vitest-environment jsdom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel layar target sales (Task 15) yang hanya terlihat saat dirender.
 *
 * Fungsi murninya — `keBarisTarget`, `labelOpsiSales`, `nilaiSetelahGantiSales`,
 * `isSimpanTargetTerbuka`, `penutupModalTarget`, `pesanTabelKosong` — sudah
 * diuji tanpa DOM, dan kedua hook datanya di `presurvei-target-hook.test.ts`.
 * Yang dikunci di sini adalah nilai yang diteruskan ke sana, yang tercatat
 * sebagai kandidat Task 19 di ledger Task 15/16:
 *
 * - `TargetClient`: periode layar → modal, `onUbah` pemilih periode, `canCreate`
 *   pada Tetapkan dan Ubah, baris yang diubah → modal, `isError` → tabel,
 *   `barisPeriode` → modal;
 * - `TargetFormModal`: `onClose={tutup}` dan Batal nonaktif selama menyimpan,
 *   pemilih sales → `nilaiSetelahGantiSales`, `labelOpsiSales` di `<option>`,
 *   peringatan timpa, tombol Simpan, pesan gagal dan kosong daftar sales;
 * - `TargetTable`: `emptyMessage` dan `renderActions`;
 * - gerbang `page.tsx`.
 *
 * Hook data berjalan sungguhan di atas `QueryClient` nyata dengan `fetch`
 * distub; hanya izin, toast, dan `@/lib/rbac` yang dipalsukan.
 */

const palsu = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  ensureAnyPermission: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({ hasPermission: palsu.hasPermission }),
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

import type { BarisTarget } from "@/app/admin/presurvei/target/barisTarget";
import HalamanTarget from "@/app/admin/presurvei/target/page";
import { TargetClient } from "@/app/admin/presurvei/target/TargetClient";
import { TargetFormModal } from "@/app/admin/presurvei/target/TargetFormModal";
import { TargetTable } from "@/app/admin/presurvei/target/TargetTable";
import type { SalesPresurveiDto, TargetDto } from "@/modules/presurvei/client";

import {
  bongkarPanggung,
  cari,
  isiMedan,
  klikTombol,
  pasangPanggung,
  render,
  responsJson,
  tombolBerteks,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

/** Ditulis literal: test harus merah bila rute, izin, atau pesannya diganti. */
const URL_TARGET = "/api/admin/presurvei/target";
const URL_SALES = "/api/admin/presurvei/sales";
const IZIN_CREATE = "presurvei_target:create";
const IZIN_BACA_HALAMAN = ["presurvei_target:read"];
const PESAN_TABEL_GAGAL = "Target gagal dimuat.";
const PESAN_TABEL_KOSONG = "Belum ada target untuk periode ini.";
const TEKS_PERINGATAN_TIMPA =
  "Sales ini sudah punya target periode ini; menyimpan akan menimpanya.";

/** Tanggal layar: periode bawaan September 2026. */
const SEKARANG = new Date("2026-09-15T05:00:00.000Z");
const PERIODE_SEKARANG = { tahun: 2026, bulan: 9 };

const daftarSales: SalesPresurveiDto[] = [
  { id: "sales-andi", nama: "Andi" },
  { id: "sales-budi", nama: "Budi" },
  { id: "sales-cici", nama: "Cici" },
];

/** Angka tiap target berbeda satu sama lain supaya tertukarnya terbaca. */
const targetSeptember: TargetDto[] = [
  {
    id: "tg-budi",
    userId: "sales-budi",
    periodeTahun: 2026,
    periodeBulan: 9,
    targetKunjungan: 12,
    targetProspek: 7,
    targetKonversi: 3,
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "tg-cici",
    userId: "sales-cici",
    periodeTahun: 2026,
    periodeBulan: 9,
    targetKunjungan: 20,
    targetProspek: 9,
    targetKonversi: 4,
    updatedAt: "2026-09-02T00:00:00.000Z",
  },
];

const barisSeptember: BarisTarget[] = [
  { ...targetSeptember[0], namaSales: "Budi" },
  { ...targetSeptember[1], namaSales: "Cici" },
];

/** Janji yang penyelesaiannya dipegang test, untuk menahan `fetch`. */
function tunda<T>() {
  let selesai: (nilai: T) => void;
  const janji = new Promise<T>((resolve) => {
    selesai = resolve;
  });
  return { janji, selesai: (nilai: T) => selesai(nilai) };
}

type Penjawab = (url: string) => Response | Promise<Response>;

let panggung: Panggung;
let mockFetch: ReturnType<typeof vi.fn>;
let jawabTarget: Penjawab;
let jawabSales: Penjawab;
let jawabSimpan: Penjawab;

/** URL GET target yang diminta, berurutan. */
function urlTargetDiminta(): string[] {
  return mockFetch.mock.calls
    .filter(
      ([url, init]) =>
        String(url).startsWith(`${URL_TARGET}?`) &&
        (init as RequestInit | undefined)?.method === undefined,
    )
    .map(([url]) => String(url));
}

/** Badan POST target pertama. */
function badanSimpan(): Record<string, unknown> {
  const panggilan = mockFetch.mock.calls.find(
    ([, init]) => (init as RequestInit | undefined)?.method === "POST",
  );
  expect(panggilan, "tidak ada POST target").toBeDefined();
  const [url, init] = panggilan as [string, RequestInit];
  expect(url).toBe(URL_TARGET);
  return JSON.parse(init.body as string);
}

/** Teks tiap `<option>` di pemilih sales modal. */
function teksOpsiSales(): string[] {
  return [...document.body.querySelectorAll("#target-sales option")].map(
    (opsi) => opsi.textContent,
  );
}

/** Nilai ketiga medan angka, urut kunjungan-prospek-konversi. */
function nilaiMedanAngka(): string[] {
  return ["targetKunjungan", "targetProspek", "targetKonversi"].map(
    (kunci) => cari<HTMLInputElement>(`#target-${kunci}`).value,
  );
}

async function isiMedanAngka(
  kunjungan: string,
  prospek: string,
  konversi: string,
) {
  await isiMedan("#target-targetKunjungan", kunjungan);
  await isiMedan("#target-targetProspek", prospek);
  await isiMedan("#target-targetKonversi", konversi);
}

function tombolSimpan(): HTMLButtonElement {
  return cari<HTMLButtonElement>('button[type="submit"]');
}

/** Baris tabel versi desktop; `ResponsiveTable` juga merender kartu mobile. */
function barisTabel(): HTMLTableRowElement[] {
  return [
    ...document.body.querySelectorAll<HTMLTableRowElement>("table tbody tr"),
  ];
}

/** Klik elemen tertentu, bukan yang dicari dari teksnya. */
async function klikElemen(elemen: HTMLElement) {
  await act(async () => {
    elemen.click();
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SEKARANG);
  panggung = pasangPanggung();
  palsu.hasPermission.mockReset();
  palsu.hasPermission.mockReturnValue(true);
  palsu.ensureAnyPermission.mockReset();
  palsu.ensureAnyPermission.mockResolvedValue(undefined);
  palsu.toastSuccess.mockReset();
  palsu.toastError.mockReset();

  jawabTarget = (url) =>
    responsJson(200, {
      success: true,
      data:
        url.includes("bulan=9") && url.includes("tahun=2026")
          ? targetSeptember
          : [],
    });
  jawabSales = () => responsJson(200, { success: true, data: daftarSales });
  jawabSimpan = () =>
    responsJson(200, { success: true, data: targetSeptember[0] });

  mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
    const metode = init?.method ?? "GET";
    if (metode === "POST" && url === URL_TARGET) return jawabSimpan(url);
    if (metode === "GET" && url.startsWith(`${URL_TARGET}?`))
      return jawabTarget(url);
    if (metode === "GET" && url === URL_SALES) return jawabSales(url);
    return responsJson(404, { success: false, error: "tidak dikenal" });
  });
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(async () => {
  await bongkarPanggung(panggung);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("TargetClient", () => {
  async function renderLayar() {
    await render(panggung, <TargetClient />);
    await tungguSampai(
      () => barisTabel().length >= targetSeptember.length,
      "baris target September tampil",
    );
  }

  it("meminta target periode baru saat bulan lalu tahun diganti", async () => {
    await renderLayar();

    await isiMedan('select[aria-label="Bulan periode"]', "3");
    await tungguSampai(
      () => urlTargetDiminta().includes(`${URL_TARGET}?tahun=2026&bulan=3`),
      "GET target Maret 2026",
    );

    await isiMedan('select[aria-label="Tahun periode"]', "2025");
    await tungguSampai(
      () => urlTargetDiminta().includes(`${URL_TARGET}?tahun=2025&bulan=3`),
      "GET target Maret 2025",
    );
  });

  it("menyimpan ke periode yang sedang tampil, bukan periode bawaan", async () => {
    await renderLayar();
    await isiMedan('select[aria-label="Bulan periode"]', "3");
    await tungguSampai(
      () => document.body.textContent.includes(PESAN_TABEL_KOSONG),
      "tabel Maret kosong",
    );

    await klikTombol("Tetapkan target");
    expect(document.body.textContent).toContain("Maret 2026");
    await tungguSampai(() => teksOpsiSales().length > 1, "daftar sales tiba");
    await isiMedan("#target-sales", "sales-andi");
    await isiMedanAngka("5", "6", "2");
    await klikTombol("Simpan Target");

    await tungguSampai(
      () => mockFetch.mock.calls.some(([, init]) => init?.method === "POST"),
      "POST target terkirim",
    );
    expect(badanSimpan()).toEqual({
      userId: "sales-andi",
      periodeTahun: 2026,
      periodeBulan: 3,
      targetKunjungan: 5,
      targetProspek: 6,
      targetKonversi: 2,
    });
  });

  it("menandai sales yang sudah bertarget di modal dari baris periode yang tampil", async () => {
    await renderLayar();

    await klikTombol("Tetapkan target");
    await tungguSampai(() => teksOpsiSales().length > 1, "daftar sales tiba");

    expect(teksOpsiSales()).toEqual([
      "Pilih sales",
      "Andi",
      "Budi (sudah ada target)",
      "Cici (sudah ada target)",
    ]);
  });

  it("memeriksa izin create yang persis", async () => {
    await renderLayar();

    expect(palsu.hasPermission).toHaveBeenCalledWith(IZIN_CREATE);
  });

  it("tanpa izin create tidak menawarkan Tetapkan maupun Ubah", async () => {
    palsu.hasPermission.mockReturnValue(false);
    await renderLayar();

    expect(tombolBerteks("Tetapkan target")).toBeUndefined();
    expect(tombolBerteks("Ubah")).toBeUndefined();
    expect(
      document.body.querySelector("table thead")?.textContent,
    ).not.toContain("Aksi");
  });

  it("dengan izin create, Ubah membuka modal ubah berisi target baris itu", async () => {
    await renderLayar();
    expect(tombolBerteks("Tetapkan target")).toBeDefined();

    const tombolUbahCici = [...barisTabel()[1].querySelectorAll("button")].find(
      (tombol) => tombol.textContent.trim() === "Ubah",
    );
    expect(tombolUbahCici, "tombol Ubah baris Cici").toBeDefined();
    await klikElemen(tombolUbahCici);

    expect(cari("h2")?.textContent).toBe("Ubah Target");
    expect(cari("#target-sales")).toBeNull();
    expect(document.body.textContent).toContain("Cici");
    expect(nilaiMedanAngka()).toEqual(["20", "9", "4"]);
  });

  it("menyebut target gagal dimuat, bukan kosong, saat GET target ditolak", async () => {
    jawabTarget = () => responsJson(500, { success: false, error: "rusak" });
    await render(panggung, <TargetClient />);

    await tungguSampai(
      () => document.body.textContent.includes(PESAN_TABEL_GAGAL),
      "pesan tabel gagal",
    );
    expect(document.body.textContent).not.toContain(PESAN_TABEL_KOSONG);
  });
});

describe("TargetFormModal", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onClose = vi.fn<() => void>();
  });

  async function renderModal(targetDiubah: BarisTarget | null = null) {
    await render(
      panggung,
      <TargetFormModal
        periode={PERIODE_SEKARANG}
        barisPeriode={barisSeptember}
        targetDiubah={targetDiubah}
        onClose={onClose}
      />,
    );
  }

  async function renderModalBuatSiap() {
    await renderModal();
    await tungguSampai(() => teksOpsiSales().length > 1, "daftar sales tiba");
  }

  it("menahan penutupan dan menonaktifkan Batal selama POST berjalan", async () => {
    const simpanTertahan = tunda<Response>();
    jawabSimpan = () => simpanTertahan.janji;
    await renderModalBuatSiap();
    await isiMedan("#target-sales", "sales-andi");
    await isiMedanAngka("5", "6", "2");

    await klikTombol("Simpan Target");
    expect(tombolBerteks("Batal").disabled).toBe(true);
    await klikElemen(cari('[role="dialog"]'));
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).not.toHaveBeenCalled();

    simpanTertahan.selesai(
      responsJson(200, { success: true, data: targetSeptember[0] }),
    );
    await tungguSampai(() => onClose.mock.calls.length >= 1, "modal ditutup");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tombolBerteks("Batal").disabled).toBe(false);
  });

  it("menutup lewat backdrop saat tidak sedang menyimpan", async () => {
    await renderModalBuatSiap();

    await klikElemen(cari('[role="dialog"]'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("mengisi angka target lama saat sales bertarget dipilih, lalu mengosongkannya", async () => {
    await renderModalBuatSiap();
    await isiMedan("#target-targetKunjungan", "5");

    await isiMedan("#target-sales", "sales-budi");
    expect(nilaiMedanAngka()).toEqual(["12", "7", "3"]);
    expect(document.body.textContent).toContain(TEKS_PERINGATAN_TIMPA);

    await isiMedan("#target-sales", "sales-andi");
    expect(nilaiMedanAngka()).toEqual(["", "", ""]);
    expect(document.body.textContent).not.toContain(TEKS_PERINGATAN_TIMPA);
  });

  it("mempertahankan ketikan saat berpindah antar-sales tanpa target", async () => {
    jawabSales = () =>
      responsJson(200, {
        success: true,
        data: [...daftarSales, { id: "sales-dedi", nama: "Dedi" }],
      });
    await renderModalBuatSiap();
    await isiMedan("#target-sales", "sales-andi");
    await isiMedanAngka("5", "6", "2");

    await isiMedan("#target-sales", "sales-dedi");

    expect(nilaiMedanAngka()).toEqual(["5", "6", "2"]);
    expect(document.body.textContent).not.toContain(TEKS_PERINGATAN_TIMPA);
  });

  it("menonaktifkan Simpan selama daftar sales memuat, tanpa menyebutnya kosong", async () => {
    const salesTertahan = tunda<Response>();
    jawabSales = () => salesTertahan.janji;
    await renderModal();

    expect(tombolSimpan().disabled).toBe(true);
    expect(teksOpsiSales()).toEqual(["Memuat daftar sales…"]);
    expect(document.body.textContent).not.toContain("Belum ada sales aktif");

    salesTertahan.selesai(responsJson(200, { success: true, data: [] }));
    await tungguSampai(() => !tombolSimpan().disabled, "Simpan aktif");
    expect(document.body.textContent).toContain(
      "Belum ada sales aktif di tenant ini.",
    );
  });

  it("menyebut daftar sales gagal dan tetap menonaktifkan Simpan pada mode buat", async () => {
    jawabSales = () => responsJson(500, { success: false, error: "rusak" });
    await renderModal();

    await tungguSampai(() => cari('[role="alert"]') !== null, "pesan gagal");
    expect(cari('[role="alert"]').textContent).toContain(
      "Daftar sales gagal dimuat",
    );
    expect(cari("#target-sales")).toBeNull();
    expect(tombolSimpan().disabled).toBe(true);
  });

  it("mode ubah tetap bisa disimpan walau daftar sales gagal", async () => {
    jawabSales = () => responsJson(500, { success: false, error: "rusak" });
    await renderModal(barisSeptember[1]);
    await tungguSampai(
      () => mockFetch.mock.calls.some(([url]) => url === URL_SALES),
      "daftar sales diminta",
    );
    await act(async () => {
      await new Promise((selesai) => setTimeout(selesai, 0));
    });

    expect(tombolSimpan().disabled).toBe(false);
    await isiMedan("#target-targetProspek", "11");
    await klikTombol("Simpan Target");

    await tungguSampai(() => onClose.mock.calls.length >= 1, "tersimpan");
    expect(badanSimpan()).toEqual({
      userId: "sales-cici",
      periodeTahun: 2026,
      periodeBulan: 9,
      targetKunjungan: 20,
      targetProspek: 11,
      targetKonversi: 4,
    });
  });
});

describe("TargetTable", () => {
  it("membedakan tabel gagal dari periode tanpa target", async () => {
    await render(
      panggung,
      <TargetTable baris={[]} isLoading={false} isError onUbah={null} />,
    );
    expect(document.body.textContent).toContain(PESAN_TABEL_GAGAL);
    expect(document.body.textContent).not.toContain(PESAN_TABEL_KOSONG);

    await render(
      panggung,
      <TargetTable
        baris={[]}
        isLoading={false}
        isError={false}
        onUbah={null}
      />,
    );
    expect(document.body.textContent).toContain(PESAN_TABEL_KOSONG);
    expect(document.body.textContent).not.toContain(PESAN_TABEL_GAGAL);
  });

  it("tanpa onUbah tidak memasang kolom aksi", async () => {
    await render(
      panggung,
      <TargetTable
        baris={barisSeptember}
        isLoading={false}
        isError={false}
        onUbah={null}
      />,
    );

    expect(tombolBerteks("Ubah")).toBeUndefined();
    expect(cari("table thead").textContent).not.toContain("Aksi");
  });

  it("Ubah meneruskan baris tempat tombolnya berada", async () => {
    const onUbah = vi.fn();
    await render(
      panggung,
      <TargetTable
        baris={barisSeptember}
        isLoading={false}
        isError={false}
        onUbah={onUbah}
      />,
    );

    const tombolBarisKedua = barisTabel()[1].querySelector("button");
    await klikElemen(tombolBarisKedua);

    expect(onUbah).toHaveBeenCalledTimes(1);
    expect(onUbah).toHaveBeenCalledWith({
      ...targetSeptember[1],
      namaSales: "Cici",
    });
  });
});

describe("page.tsx target", () => {
  it("menjaga halaman dengan izin baca target yang persis", async () => {
    const elemen = await HalamanTarget();

    expect(palsu.ensureAnyPermission).toHaveBeenCalledWith(IZIN_BACA_HALAMAN);
    expect(elemen.type).toBe(TargetClient);
  });

  it("tidak merender apa pun bila gerbang izin menolak", async () => {
    palsu.ensureAnyPermission.mockRejectedValue(new Error("403"));

    await expect(HalamanTarget()).rejects.toThrow("403");
  });
});
