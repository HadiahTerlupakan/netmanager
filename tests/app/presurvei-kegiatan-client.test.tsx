// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel shell layar kegiatan (`KegiatanClient`) yang hanya terlihat saat dirender.
 *
 * Fungsi murninya — `buildKegiatanListUrl`, `keTitikPeta`, `jumlahDiLuarBatas`,
 * `teksWaktuKegiatan`, `keMuatanKegiatan` — sudah diuji tanpa DOM. Yang dikunci
 * di sini adalah nilai yang diteruskan ke sana, yang pernah dibuktikan lolos
 * hijau lewat mutasi saat Task 7, 8, dan 10 direview:
 *
 * - `useKegiatanListQuery({ untukPeta: isTabPeta })` — tanpa itu peta menggambar
 *   20 titik halaman tabel alih-alih himpunan 100 baris;
 * - props `tanpaKoordinat`/`diLuarBatas` ke peta dan field
 *   `totalCocok`/`jumlahTerambil` ke `jumlahDiLuarBatas` (tertukar = peringatan
 *   pemotongan tak pernah muncul);
 * - sakelar tab dan baris `render: teksWaktuKegiatan` di `KegiatanTable`;
 * - toast gagal memuat di `useKegiatanListQuery` (dulu tak pernah bisa merah
 *   karena `useEffect` distub di test hook);
 * - tombol → modal catat kegiatan, pemetaan medan → muatan, invalidasi daftar,
 *   dan pesan level-form.
 *
 * Hook data berjalan sungguhan di atas `QueryClient` nyata dengan `fetch`
 * distub. `next/dynamic` dipalsukan supaya peta (OpenLayers) diganti penangkap
 * props — kabel peta sendiri dijaga `presurvei-kegiatan-peta-wiring.test.tsx`.
 */

const palsu = vi.hoisted(() => ({
  hasAnyPermission: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  propsPeta: [] as Array<Record<string, unknown>>,
}));

vi.mock("next/dynamic", async () => {
  const { createElement } = await import("react");
  return {
    default: () =>
      function PetaPalsu(props: Record<string, unknown>) {
        palsu.propsPeta.push(props);
        return createElement("div", { "data-peta-palsu": "" });
      },
  };
});

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({ hasAnyPermission: palsu.hasAnyPermission }),
}));

vi.mock("react-hot-toast", () => ({
  toast: Object.assign(vi.fn(), {
    success: palsu.toastSuccess,
    error: palsu.toastError,
  }),
}));

import { KegiatanClient } from "@/app/admin/presurvei/kegiatan/KegiatanClient";
import type { KegiatanListItemDto } from "@/modules/presurvei/client";

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

/** Ditulis literal: test harus merah bila rute atau pesannya diganti. */
const URL_DAFTAR = "/api/presurvei/kegiatan";
const URL_SALES = "/api/admin/presurvei/sales";
const PESAN_GAGAL_MUAT = "Gagal memuat daftar kegiatan";

/** Tiga baris, dua berkoordinat: `tanpaKoordinat` = 1. */
const baris: KegiatanListItemDto[] = [
  {
    id: "kg-1",
    jenis: "KUNJUNGAN",
    userId: "sales-1",
    namaSales: "Andi",
    prospekId: null,
    waktuMulai: "2026-09-10T02:00:00.000Z",
    alamatDikunjungi: "Jl. Melati 1",
    ditemuiNama: "Bu Rina",
    latitude: -6.2,
    longitude: 106.8,
    hasil: "TERTARIK",
    jumlahFoto: 2,
  },
  {
    id: "kg-2",
    jenis: "KUNJUNGAN",
    userId: "sales-1",
    namaSales: "Andi",
    prospekId: null,
    waktuMulai: "2026-09-11T03:30:00.000Z",
    alamatDikunjungi: "Jl. Mawar 2",
    ditemuiNama: null,
    latitude: -6.3,
    longitude: 106.9,
    hasil: "TIDAK_MINAT",
    jumlahFoto: 0,
  },
  {
    id: "kg-3",
    jenis: "TELEPON",
    userId: "sales-2",
    namaSales: "Budi",
    prospekId: null,
    waktuMulai: "2026-09-12T04:00:00.000Z",
    alamatDikunjungi: null,
    ditemuiNama: null,
    latitude: null,
    longitude: null,
    hasil: "PERLU_FOLLOWUP",
    jumlahFoto: 0,
  },
];

/**
 * Total cocok 150 sementara yang terambil 3: selisihnya (147) berbeda dari
 * `tanpaKoordinat` (1) dan dari kedua masukannya, sehingga setiap pertukaran
 * props atau field menghasilkan angka yang terbaca salah.
 */
const TOTAL_COCOK = 150;

let panggung: Panggung;
let mockFetch: ReturnType<typeof vi.fn>;
let isDaftarGagal: boolean;

/** URL GET daftar kegiatan yang diminta, berurutan. */
function urlDaftarDiminta(): string[] {
  return mockFetch.mock.calls
    .map(([url, init]) => [String(url), (init as RequestInit)?.method])
    .filter(([url, metode]) => !metode && url.startsWith(`${URL_DAFTAR}?`))
    .map(([url]) => url);
}

function paramDari(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url, "http://lokal").searchParams);
}

/** Props terakhir yang diterima peta palsu. */
function propsPetaTerakhir(): Record<string, unknown> {
  expect(palsu.propsPeta.length, "peta belum pernah dirender").toBeGreaterThan(
    0,
  );
  return palsu.propsPeta[palsu.propsPeta.length - 1];
}

beforeEach(() => {
  panggung = pasangPanggung();
  palsu.propsPeta.length = 0;
  palsu.toastSuccess.mockReset();
  palsu.toastError.mockReset();
  palsu.hasAnyPermission.mockReset();
  palsu.hasAnyPermission.mockReturnValue(true);
  isDaftarGagal = false;
  mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" && url === URL_DAFTAR) {
      return responsJson(201, { success: true, data: { id: "kg-baru" } });
    }
    if (url === URL_SALES) {
      return responsJson(200, { success: true, data: [] });
    }
    if (url.startsWith(`${URL_DAFTAR}?`)) {
      if (isDaftarGagal) {
        return responsJson(500, { success: false, error: "rusak" });
      }
      return responsJson(200, {
        success: true,
        data: baris,
        meta: { page: 1, limit: 20, total: TOTAL_COCOK, totalPages: 8 },
      });
    }
    return responsJson(404, { success: false, error: "tidak dikenal" });
  });
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(async () => {
  await bongkarPanggung(panggung);
  vi.unstubAllGlobals();
});

async function renderLayar() {
  await render(panggung, <KegiatanClient />);
  await tungguSampai(
    () => urlDaftarDiminta().length > 0,
    "daftar kegiatan diminta",
  );
}

async function bukaTab(label: string) {
  await klikTombol(label);
}

describe("KegiatanClient — tab daftar", () => {
  it("membuka tab daftar lebih dulu dan meminta halaman tabel", async () => {
    await renderLayar();

    expect(tombolBerteks("Daftar")?.getAttribute("aria-selected")).toBe("true");
    expect(paramDari(urlDaftarDiminta()[0])).toMatchObject({
      page: "1",
      limit: "20",
    });
    expect(cari("[data-peta-palsu]")).toBeNull();
  });

  it("menampilkan waktu kegiatan terformat di tabel, bukan ISO mentah", async () => {
    await renderLayar();
    await tungguSampai(
      () => document.body.textContent.includes("Jl. Melati 1"),
      "baris tabel tampil",
    );

    const teks = document.body.textContent;
    // `formatDateTimeDisplay`, TZ test dipaku Asia/Jakarta (UTC+7).
    expect(teks).toContain("10 Sep 2026 09:00");
    expect(teks).not.toContain("2026-09-10T02:00:00.000Z");
  });

  it("memberi tahu lewat toast bila daftar gagal dimuat", async () => {
    isDaftarGagal = true;
    await renderLayar();

    await tungguSampai(
      () => palsu.toastError.mock.calls.length > 0,
      "toast gagal memuat",
    );
    expect(palsu.toastError).toHaveBeenCalledWith(PESAN_GAGAL_MUAT);
  });
});

describe("KegiatanClient — tab peta", () => {
  it("berpindah ke peta dan meminta himpunan peta: halaman 1, batas 100", async () => {
    await renderLayar();

    await bukaTab("Peta kunjungan");
    await tungguSampai(
      () => cari("[data-peta-palsu]") !== null,
      "peta dirender",
    );

    expect(tombolBerteks("Peta kunjungan")?.getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(tombolBerteks("Daftar")?.getAttribute("aria-selected")).toBe(
      "false",
    );
    const urlTerakhir = urlDaftarDiminta().at(-1);
    expect(paramDari(urlTerakhir)).toMatchObject({ page: "1", limit: "100" });
  });

  it("meneruskan titik, jumlah tanpa koordinat, dan selisih pemotongan ke peta", async () => {
    await renderLayar();

    await bukaTab("Peta kunjungan");
    await tungguSampai(
      () =>
        palsu.propsPeta.length > 0 &&
        (propsPetaTerakhir().titik as unknown[]).length > 0,
      "peta menerima titik",
    );

    const props = propsPetaTerakhir();
    expect((props.titik as Array<{ id: string }>).map((t) => t.id)).toEqual([
      "kg-1",
      "kg-2",
    ]);
    expect(props.tanpaKoordinat).toBe(1);
    expect(props.diLuarBatas).toBe(TOTAL_COCOK - baris.length);
  });
});

describe("KegiatanClient — modal catat kegiatan", () => {
  it("tidak menawarkan tombol catat tanpa izin create", async () => {
    palsu.hasAnyPermission.mockReturnValue(false);
    await renderLayar();

    expect(tombolBerteks("Catat kegiatan")).toBeUndefined();
    expect(palsu.hasAnyPermission).toHaveBeenCalledWith([
      "presurvei:create",
      "m_presurvei:create",
    ]);
  });

  it("membuka modal dari tombol, mengirim medan ke tempatnya, lalu menyegarkan daftar", async () => {
    await renderLayar();
    expect(cari('[role="dialog"]')).toBeNull();

    await klikTombol("Catat kegiatan");
    expect(cari('[role="dialog"]')).not.toBeNull();

    await isiMedan("#kegiatan-hasil", "TERTARIK");
    await isiMedan("#kegiatan-waktu-mulai", "2025-01-15T10:00");
    await isiMedan("#kegiatan-ditemui", "Pak Joko");
    await isiMedan("#kegiatan-alamat", "Jl. Kenari 7");
    await isiMedan("#kegiatan-iklan", "iklan-5");
    await isiMedan("#kegiatan-prospek", "prospek-8");
    await isiMedan("#kegiatan-catatan", "Minta brosur");
    const jumlahDaftarSebelum = urlDaftarDiminta().length;
    await klikTombol("Catat Kegiatan");
    await tungguSampai(
      () => palsu.toastSuccess.mock.calls.length > 0,
      "kegiatan tersimpan",
    );

    const kirim = mockFetch.mock.calls.find(
      ([, init]) => (init as RequestInit)?.method === "POST",
    ) as [string, RequestInit];
    expect(kirim[0]).toBe(URL_DAFTAR);
    expect(JSON.parse(kirim[1].body as string)).toEqual({
      jenis: "TELEPON",
      hasil: "TERTARIK",
      waktuMulai: "2025-01-15T03:00:00.000Z",
      alamatDikunjungi: "Jl. Kenari 7",
      ditemuiNama: "Pak Joko",
      catatan: "Minta brosur",
      prospekId: "prospek-8",
      iklanId: "iklan-5",
    });
    await tungguSampai(
      () => cari('[role="dialog"]') === null,
      "modal tertutup setelah tersimpan",
    );
    await tungguSampai(
      () => urlDaftarDiminta().length > jumlahDaftarSebelum,
      "daftar diambil ulang setelah simpan",
    );
  });

  it("menampilkan penolakan lintas-medan sebagai pesan level-form, tanpa mengirim", async () => {
    await renderLayar();
    await klikTombol("Catat kegiatan");

    await isiMedan("#kegiatan-jenis", "KUNJUNGAN");
    await isiMedan("#kegiatan-waktu-mulai", "2025-01-15T10:00");
    await klikTombol("Catat Kegiatan");

    expect(cari('[role="alert"]')?.textContent).toBe(
      "Kunjungan dan survei lokasi wajib menyertakan koordinat",
    );
    expect(
      mockFetch.mock.calls.some(
        ([, init]) => (init as RequestInit)?.method === "POST",
      ),
    ).toBe(false);
  });
});
