// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel antar-berkas layar kampanye iklan yang hanya terlihat saat dirender.
 *
 * Fungsi murninya (`opsiSimpanUntukMode`, `muatanUntukMode`, `teksTanggalMulai`,
 * `keKesalahanForm`) sudah diuji tanpa DOM. Yang dikunci di sini adalah
 * pemasangannya — tiap butir di bawah pernah dibuktikan lolos hijau lewat
 * mutasi saat Task 5/6 direview:
 *
 * - `mode` yang diteruskan ke `IklanForm` sama dengan yang menurunkan tujuan
 *   simpan, di KEDUA situs pakai (arah senyap: form mode buat di layar ubah
 *   mengirim `kode` ke `PATCH`, di-strip server, 200);
 * - kunci invalidasi `useSimpanIklan` benar-benar mengenai query daftar
 *   `useIklanListQuery` dan query rincian `useApi` — dibuktikan lewat refetch
 *   query aktif, bukan dengan menyalin string kuncinya;
 * - tujuan `router.push` setelah simpan;
 * - pesan kesalahan level-form benar-benar dirender;
 * - baris `render:` kolom tanggal di `IklanTable`.
 *
 * `useSimpanIklan`, `useIklanListQuery`, dan `useApi` berjalan sungguhan di
 * atas `QueryClient` nyata; hanya `fetch`, router, dan toast yang dipalsukan.
 */

const palsu = vi.hoisted(() => ({
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  /** Bila diisi, menggantikan schema bawaan form — lihat test level-form. */
  schemaPaksaan: null as null | { safeParse: (muatan: unknown) => unknown },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: palsu.push }),
}));

vi.mock("react-hot-toast", async () =>
  (await import("./presurvei-jsdom-harness")).modulToastPalsu(
    palsu.toastSuccess,
    palsu.toastError,
  ),
);

/**
 * Mock parsial: seluruh ekspor `iklanFormState` tetap ASLI, kecuali
 * `schemaUntukMode` yang dibungkus supaya satu test bisa memaksakan schema.
 *
 * Kopling yang perlu diketahui: pembungkus ini bergantung pada `IklanForm`
 * memanggil `schemaUntukMode` lewat impor modul ini. Bila kelak `IklanForm`
 * memilih schema dengan cara lain (misalnya mengimpor `buatIklanSchema`
 * langsung), `schemaPaksaan` diam-diam tidak berlaku lagi — test level-form
 * akan merah karena pesan tak muncul, bukan hijau palsu. Selama
 * `schemaPaksaan` null, perilakunya identik dengan produksi, sehingga test
 * mode buat/ubah menguji schema asli.
 */
vi.mock("@/app/admin/presurvei/iklan/iklanFormState", async (asli) => {
  const modul =
    await asli<typeof import("@/app/admin/presurvei/iklan/iklanFormState")>();
  return {
    ...modul,
    schemaUntukMode: (mode: Parameters<typeof modul.schemaUntukMode>[0]) =>
      palsu.schemaPaksaan ?? modul.schemaUntukMode(mode),
  };
});

import { z } from "zod";

import { IklanEditClient } from "@/app/admin/presurvei/iklan/[id]/edit/IklanEditClient";
import { IklanTable } from "@/app/admin/presurvei/iklan/IklanTable";
import { IklanCreateClient } from "@/app/admin/presurvei/iklan/new/IklanCreateClient";
import { useIklanListQuery } from "@/app/admin/presurvei/iklan/useIklanListQuery";
import type {
  IklanDetailDto,
  IklanListItemDto,
} from "@/modules/presurvei/client";

import {
  bongkarPanggung,
  cari,
  isiMedan,
  klikTombol,
  pasangPanggung,
  render,
  responsJson,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

/** Ditulis literal, bukan diimpor: test harus merah bila konstantanya diganti. */
const RUTE_DAFTAR_IKLAN = "/admin/presurvei/iklan";
const URL_KOLEKSI = "/api/admin/presurvei/iklan";
const URL_RINCIAN = "/api/admin/presurvei/iklan/iklan-42";

const rincian: IklanDetailDto = {
  id: "iklan-42",
  nama: "Promo Kemerdekaan",
  kode: "promo-merdeka",
  channel: "TIKTOK",
  tanggalMulai: "2026-08-01T00:00:00.000Z",
  tanggalSelesai: "2026-08-31T00:00:00.000Z",
  isAktif: true,
  isBerjalan: false,
  biaya: 2500000,
  penanggungJawabId: null,
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
};

const amplopDaftarKosong = {
  success: true,
  data: [] as IklanListItemDto[],
  meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
};

let panggung: Panggung;
let mockFetch: ReturnType<typeof vi.fn>;

/** Seluruh panggilan `fetch` sebagai `[url, metode]`. */
function panggilanFetch(): Array<[string, string]> {
  return mockFetch.mock.calls.map(([url, init]) => [
    String(url),
    (init as RequestInit | undefined)?.method ?? "GET",
  ]);
}

/** Jumlah GET ke URL yang diawali `awalan`. */
function jumlahGet(awalan: string): number {
  return panggilanFetch().filter(
    ([url, metode]) => metode === "GET" && url.startsWith(awalan),
  ).length;
}

/** Permintaan tulis (bukan GET) pertama beserta badannya. */
function permintaanTulis(): { url: string; metode: string; badan: unknown } {
  const panggilan = mockFetch.mock.calls.find(
    ([, init]) =>
      (init as RequestInit | undefined)?.method !== undefined &&
      (init as RequestInit).method !== "GET",
  );
  expect(panggilan, "tidak ada permintaan tulis").toBeDefined();
  const [url, init] = panggilan as [string, RequestInit];
  return {
    url,
    metode: init.method,
    badan: JSON.parse(init.body as string),
  };
}

/**
 * Menahan query daftar `useIklanListQuery` tetap aktif, seperti halaman daftar
 * yang masih ter-cache. Dipakai untuk membuktikan invalidasi mengenainya.
 */
function DaftarAktif(): null {
  useIklanListQuery();
  return null;
}

beforeEach(() => {
  panggung = pasangPanggung();
  palsu.push.mockReset();
  palsu.toastSuccess.mockReset();
  palsu.toastError.mockReset();
  palsu.schemaPaksaan = null;
  mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
    const metode = init?.method ?? "GET";
    if (metode === "GET" && url.startsWith(`${URL_KOLEKSI}?`)) {
      return responsJson(200, amplopDaftarKosong);
    }
    if (metode === "GET" && url === URL_RINCIAN) {
      return responsJson(200, { success: true, data: rincian });
    }
    if (metode === "POST" || metode === "PATCH") {
      return responsJson(200, { success: true, data: rincian });
    }
    return responsJson(404, { success: false, error: "tidak dikenal" });
  });
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(async () => {
  await bongkarPanggung(panggung);
  vi.unstubAllGlobals();
});

describe("IklanCreateClient — mode buat", () => {
  async function renderBuat() {
    await render(
      panggung,
      <>
        <DaftarAktif />
        <IklanCreateClient />
      </>,
    );
    await tungguSampai(
      () => jumlahGet(`${URL_KOLEKSI}?`) === 1,
      "daftar iklan termuat",
    );
  }

  it("menampilkan medan kode UTM yang bisa diisi", async () => {
    await renderBuat();

    expect(cari("#iklan-kode")?.tagName).toBe("INPUT");
  });

  it("mengirim POST berisi kode, menyegarkan daftar, lalu kembali ke daftar", async () => {
    await renderBuat();

    await isiMedan("#iklan-nama", "Promo Ramadan");
    await isiMedan("#iklan-kode", "promo-ramadan");
    await isiMedan("#iklan-tanggal-mulai", "2026-03-01");
    await klikTombol("Buat Kampanye");
    await tungguSampai(() => palsu.push.mock.calls.length > 0, "router.push");

    expect(permintaanTulis()).toEqual({
      url: URL_KOLEKSI,
      metode: "POST",
      badan: {
        nama: "Promo Ramadan",
        kode: "promo-ramadan",
        channel: "META",
        tanggalMulai: "2026-03-01",
        tanggalSelesai: null,
        biaya: null,
        isAktif: true,
      },
    });
    expect(palsu.push).toHaveBeenCalledWith(RUTE_DAFTAR_IKLAN);
    // Query daftar yang aktif diambil ulang: kunci invalidasinya mengenai
    // kunci `useIklanListQuery`, bukan sekadar "invalidateQueries dipanggil".
    await tungguSampai(
      () => jumlahGet(`${URL_KOLEKSI}?`) >= 2,
      "daftar iklan diambil ulang setelah simpan",
    );
    expect(jumlahGet(`${URL_KOLEKSI}?`)).toBe(2);
  });
});

describe("IklanEditClient — mode ubah", () => {
  async function renderUbah() {
    await render(
      panggung,
      <>
        <DaftarAktif />
        <IklanEditClient iklanId="iklan-42" />
      </>,
    );
    await tungguSampai(() => cari("#iklan-nama") !== null, "form ubah tampil");
  }

  it("memuat rincian dari endpoint admin kampanye itu", async () => {
    await renderUbah();

    expect(jumlahGet(URL_RINCIAN)).toBe(1);
    const medanNama = cari<HTMLInputElement>("#iklan-nama");
    expect(medanNama, "medan #iklan-nama tidak dirender").not.toBeNull();
    expect(medanNama.value).toBe("Promo Kemerdekaan");
  });

  it("menampilkan kode UTM sebagai teks mati, bukan medan isian", async () => {
    await renderUbah();

    expect(cari("#iklan-kode")).toBeNull();
    expect(document.body.textContent).toContain(
      "Kode UTM tidak bisa diubah setelah kampanye dibuat",
    );
  });

  it("mengirim PATCH tanpa kode ke kampanye itu, menyegarkan daftar dan rincian", async () => {
    await renderUbah();

    await isiMedan("#iklan-nama", "Promo Kemerdekaan Diperpanjang");
    await klikTombol("Simpan Perubahan");
    await tungguSampai(() => palsu.push.mock.calls.length > 0, "router.push");

    const tulis = permintaanTulis();
    expect(tulis.url).toBe(URL_RINCIAN);
    expect(tulis.metode).toBe("PATCH");
    expect(tulis.badan).toEqual({
      nama: "Promo Kemerdekaan Diperpanjang",
      channel: "TIKTOK",
      tanggalMulai: "2026-08-01",
      tanggalSelesai: "2026-08-31",
      biaya: 2500000,
      isAktif: true,
    });
    expect(tulis.badan).not.toHaveProperty("kode");
    expect(palsu.push).toHaveBeenCalledWith(RUTE_DAFTAR_IKLAN);
    await tungguSampai(
      () => jumlahGet(`${URL_KOLEKSI}?`) >= 2 && jumlahGet(URL_RINCIAN) >= 2,
      "daftar dan rincian diambil ulang setelah simpan",
    );
    expect(jumlahGet(`${URL_KOLEKSI}?`)).toBe(2);
    expect(jumlahGet(URL_RINCIAN)).toBe(2);
  });
});

describe("IklanForm — pesan kesalahan level-form", () => {
  it("merender pesan yang tidak menempel ke medan mana pun", async () => {
    // Schema yang menolak di akar (path kosong), seperti aturan lintas-medan.
    // Schema produksi hari ini tak punya refine berpath kosong yang terjangkau
    // dari UI, jadi keadaan itu dipaksakan — yang diuji adalah JSX-nya.
    palsu.schemaPaksaan = z.object({}).refine(() => false, {
      message: "Tanggal selesai tidak boleh mendahului tanggal mulai",
    });
    await render(panggung, <IklanCreateClient />);

    await klikTombol("Buat Kampanye");

    expect(cari('[role="alert"]')?.textContent).toBe(
      "Tanggal selesai tidak boleh mendahului tanggal mulai",
    );
    expect(panggilanFetch().filter(([, metode]) => metode !== "GET")).toEqual(
      [],
    );
  });
});

describe("IklanTable", () => {
  const baris: IklanListItemDto[] = [
    {
      id: "iklan-1",
      nama: "Promo Ramadan",
      kode: "promo-ramadan",
      channel: "META",
      tanggalMulai: "2026-03-01T00:00:00.000Z",
      tanggalSelesai: "2026-04-15T00:00:00.000Z",
      isAktif: true,
      isBerjalan: true,
    },
  ];

  it("menampilkan tanggal terformat, bukan ISO mentah", async () => {
    await render(
      panggung,
      <IklanTable
        baris={baris}
        isLoading={false}
        page={1}
        totalPages={1}
        onPageChange={() => undefined}
      />,
    );

    const teks = document.body.textContent;
    // `formatDateDisplay` memakai lokal id-ID; TZ test dipaku Asia/Jakarta.
    expect(teks).toContain("1 Mar 2026");
    expect(teks).toContain("15 Apr 2026");
    expect(teks).not.toContain("2026-03-01T00:00:00.000Z");
  });

  it("tidak mencetak angka halaman mentah saat daftar kosong ber-totalPages 0", async () => {
    // API menjawab `totalPages: 0` untuk nol hasil, dan `IklanClient` meneruskannya
    // apa adanya (`??` tidak mengganti 0). `ResponsiveTable` memakai
    // `{totalPages && ...}` yang akan mencetak "0" — hari ini tak terjangkau
    // hanya karena keadaan kosong kembali lebih awal. Test ini mengunci itu.
    await render(
      panggung,
      <IklanTable
        baris={[]}
        isLoading={false}
        page={1}
        totalPages={0}
        onPageChange={() => undefined}
      />,
    );

    expect(document.body.textContent).toContain("Belum ada kampanye iklan.");
    expect(document.body.textContent).not.toMatch(/\d/);
  });
});
