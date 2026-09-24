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
  hasPermission: vi.fn(),
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
  usePermission: () => ({
    hasAnyPermission: palsu.hasAnyPermission,
    hasPermission: palsu.hasPermission,
  }),
}));

vi.mock("react-hot-toast", async () =>
  (await import("./presurvei-jsdom-harness")).modulToastPalsu(
    palsu.toastSuccess,
    palsu.toastError,
  ),
);

import { act } from "react";

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
const URL_DEPARTEMEN = "/api/admin/presurvei/departemen";
/** Izin cakupan tenant (`isCakupanTenantPresurvei`), ditulis literal. */
const IZIN_BACA_TENANT = "presurvei:read";
const SELEKTOR_FILTER_PERAN = 'select[aria-label="Filter peran pelaku"]';
const SELEKTOR_FILTER_DEPARTEMEN =
  'select[aria-label="Filter departemen pelaku"]';
const PESAN_GAGAL_MUAT = "Gagal memuat daftar kegiatan";

/** Tiga baris, dua berkoordinat: `tanpaKoordinat` = 1. */
const baris: KegiatanListItemDto[] = [
  {
    id: "kg-1",
    jenis: "KUNJUNGAN",
    userId: "sales-1",
    namaSales: "Andi",
    peranPelaku: "NON_SALES",
    departemenPelaku: "Teknik",
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
    peranPelaku: "NON_SALES",
    departemenPelaku: "Teknik",
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
    peranPelaku: "SALES",
    departemenPelaku: "Marketing",
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
 * Baris untuk permintaan peta (`limit=100`), sengaja BERBEDA dari baris tabel:
 * tiga berkoordinat dan dua tanpa. Dengan data yang sama untuk kedua batas,
 * peta yang digambar dari himpunan tabel (misalnya karena peta dan tabel
 * memakai dua pemanggilan hook terpisah) tidak bisa dibedakan dari yang benar.
 */
const barisPeta: KegiatanListItemDto[] = [
  { ...baris[0], id: "kg-p1", latitude: -6.1, longitude: 106.7 },
  { ...baris[0], id: "kg-p2", latitude: -6.15, longitude: 106.75 },
  { ...baris[1], id: "kg-p3", latitude: -6.25, longitude: 106.85 },
  { ...baris[2], id: "kg-p4" },
  { ...baris[2], id: "kg-p5" },
];

/**
 * Total cocok 150. Selisihnya terhadap himpunan peta (145) berbeda dari
 * `tanpaKoordinat` peta (2), dari selisih terhadap himpunan tabel (147), dan
 * dari kedua masukannya, sehingga setiap pertukaran props, field, atau sumber
 * data menghasilkan angka yang terbaca salah.
 */
const TOTAL_COCOK = 150;

/** Batas per permintaan, dicocokkan ke `kegiatanListQuery.ts` (tabel 20, peta 100). */
const LIMIT_TABEL = "20";
const LIMIT_PETA = "100";

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
  palsu.hasPermission.mockReset();
  palsu.hasPermission.mockImplementation(
    (izin: string) => izin === IZIN_BACA_TENANT,
  );
  isDaftarGagal = false;
  mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" && url === URL_DAFTAR) {
      return responsJson(201, { success: true, data: { id: "kg-baru" } });
    }
    if (url === URL_SALES) {
      return responsJson(200, { success: true, data: [] });
    }
    if (url === URL_DEPARTEMEN) {
      return responsJson(200, {
        success: true,
        data: [
          { id: "dept-cs", nama: "Customer Service" },
          { id: "dept-teknik", nama: "Teknik" },
        ],
      });
    }
    if (url.startsWith(`${URL_DAFTAR}?`)) {
      if (isDaftarGagal) {
        return responsJson(500, { success: false, error: "rusak" });
      }
      const param = paramDari(url);
      if (param.limit === LIMIT_PETA) {
        return responsJson(200, {
          success: true,
          data: barisPeta,
          meta: { page: 1, limit: 100, total: TOTAL_COCOK, totalPages: 2 },
        });
      }
      return responsJson(200, {
        success: true,
        data: baris,
        meta: {
          page: Number(param.page),
          limit: 20,
          total: TOTAL_COCOK,
          totalPages: 8,
        },
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

/** Tombol pembuka modal di kepala halaman — di LUAR dialog. */
function tombolBukaModal(): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find(
    (tombol) =>
      tombol.closest('[role="dialog"]') === null &&
      tombol.textContent.trim() === "Catat kegiatan",
  );
}

/** Tombol kirim di DALAM dialog, dipilih lewat `type="submit"`, bukan teks. */
function tombolKirimModal(): HTMLButtonElement | null {
  return cari<HTMLButtonElement>('[role="dialog"] button[type="submit"]');
}

async function klikElemen(
  tombol: HTMLButtonElement | null | undefined,
  keterangan: string,
) {
  expect(tombol, `${keterangan} tidak ditemukan`).toBeTruthy();
  await act(async () => {
    tombol.click();
  });
}

/** URL GET daftar terakhir yang memakai batas `limit`. */
function urlTerakhirBerbatas(limit: string): string | undefined {
  return urlDaftarDiminta()
    .filter((url) => paramDari(url).limit === limit)
    .at(-1);
}

describe("KegiatanClient — tab daftar", () => {
  it("membuka tab daftar lebih dulu dan meminta halaman tabel", async () => {
    await renderLayar();

    expect(tombolBerteks("Daftar")?.getAttribute("aria-selected")).toBe("true");
    expect(paramDari(urlDaftarDiminta()[0])).toMatchObject({
      page: "1",
      limit: LIMIT_TABEL,
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
    // Bergantung TZ: `tests/setup.ts:5` memaku `process.env.TZ` ke
    // Asia/Jakarta (UTC+7), jadi 02:00Z tercetak 09:00.
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
  it("peta menyaring himpunan yang sama dengan tabel, dipaku ke halaman 1 batas 100", async () => {
    await renderLayar();

    // Filter diubah lewat UI, lalu tabel dipindah ke halaman 2 — urutan ini
    // penting karena mengubah filter mengembalikan tabel ke halaman 1.
    await isiMedan('select[aria-label="Filter jenis kegiatan"]', "KUNJUNGAN");
    await klikElemen(tombolBerteks("2"), "tombol halaman 2");
    await tungguSampai(
      () =>
        paramDari(urlTerakhirBerbatas(LIMIT_TABEL) ?? "").page === "2" &&
        paramDari(urlTerakhirBerbatas(LIMIT_TABEL) ?? "").jenis === "KUNJUNGAN",
      "tabel meminta halaman 2 berfilter",
    );

    await klikTombol("Peta kunjungan");
    await tungguSampai(
      () => urlTerakhirBerbatas(LIMIT_PETA) !== undefined,
      "himpunan peta diminta",
    );

    expect(tombolBerteks("Peta kunjungan")?.getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(tombolBerteks("Daftar")?.getAttribute("aria-selected")).toBe(
      "false",
    );
    expect(paramDari(urlTerakhirBerbatas(LIMIT_PETA))).toEqual({
      page: "1",
      limit: LIMIT_PETA,
      jenis: "KUNJUNGAN",
    });
  });

  it("meneruskan titik, jumlah tanpa koordinat, dan selisih pemotongan dari himpunan peta", async () => {
    await renderLayar();

    await klikTombol("Peta kunjungan");
    await tungguSampai(
      () =>
        palsu.propsPeta.length > 0 &&
        (propsPetaTerakhir().titik as unknown[]).length ===
          barisPeta.length - 2,
      "peta menerima titik himpunan peta",
    );

    const props = propsPetaTerakhir();
    expect((props.titik as Array<{ id: string }>).map((t) => t.id)).toEqual([
      "kg-p1",
      "kg-p2",
      "kg-p3",
    ]);
    expect(props.tanpaKoordinat).toBe(2);
    expect(props.diLuarBatas).toBe(TOTAL_COCOK - barisPeta.length);
  });
});

describe("KegiatanClient — peran dan departemen pelaku", () => {
  it("kolom Sales menampilkan nama beserta peran dan departemen pelaku", async () => {
    await renderLayar();
    await tungguSampai(
      () => document.body.textContent.includes("Non-sales · Teknik"),
      "label peran tampil di tabel",
    );

    expect(document.body.textContent).toContain("Sales · Marketing");
    expect(document.body.textContent).toContain("Budi");
  });

  it("filter peran dan departemen menyaring tabel DAN peta, dan tabel kembali ke halaman 1", async () => {
    await renderLayar();
    await tungguSampai(
      () => tombolBerteks("2") !== undefined,
      "paginasi tabel tampil",
    );
    await klikElemen(tombolBerteks("2"), "tombol halaman 2");
    await tungguSampai(
      () => paramDari(urlTerakhirBerbatas(LIMIT_TABEL) ?? "").page === "2",
      "tabel di halaman 2",
    );

    await tungguSampai(
      () =>
        cari(
          'select[aria-label="Filter departemen pelaku"] option[value="dept-teknik"]',
        ) !== null,
      "pilihan departemen dimuat",
    );
    await isiMedan('select[aria-label="Filter peran pelaku"]', "NON_SALES");
    await isiMedan(
      'select[aria-label="Filter departemen pelaku"]',
      "dept-teknik",
    );
    await tungguSampai(
      () =>
        paramDari(urlTerakhirBerbatas(LIMIT_TABEL) ?? "").departemenId ===
        "dept-teknik",
      "tabel meminta daftar berfilter departemen",
    );
    expect(paramDari(urlTerakhirBerbatas(LIMIT_TABEL))).toEqual({
      page: "1",
      limit: LIMIT_TABEL,
      peran: "NON_SALES",
      departemenId: "dept-teknik",
    });

    await klikTombol("Peta kunjungan");
    await tungguSampai(
      () => urlTerakhirBerbatas(LIMIT_PETA) !== undefined,
      "himpunan peta diminta",
    );
    expect(paramDari(urlTerakhirBerbatas(LIMIT_PETA))).toEqual({
      page: "1",
      limit: LIMIT_PETA,
      peran: "NON_SALES",
      departemenId: "dept-teknik",
    });
  });
});

describe("KegiatanClient — filter peran dan departemen menurut cakupan", () => {
  it("tampil bagi pemegang presurvei:read", async () => {
    await renderLayar();

    expect(cari(SELEKTOR_FILTER_PERAN)).not.toBeNull();
    expect(cari(SELEKTOR_FILTER_DEPARTEMEN)).not.toBeNull();
    expect(palsu.hasPermission).toHaveBeenCalledWith(IZIN_BACA_TENANT);
  });

  it("tersembunyi bagi pemanggil yang terikat ke kegiatannya sendiri", async () => {
    // Tanpa `presurvei:read` route mengikat daftar ke `userId` sesi, jadi
    // filter peran tak bermakna, dan endpoint departemen menolaknya dengan 403
    // sehingga dropdown-nya kosong tanpa penjelasan.
    palsu.hasPermission.mockReturnValue(false);
    await renderLayar();

    expect(cari(SELEKTOR_FILTER_PERAN)).toBeNull();
    expect(cari(SELEKTOR_FILTER_DEPARTEMEN)).toBeNull();
    expect(cari('select[aria-label="Filter jenis kegiatan"]')).not.toBeNull();
  });
});

describe("KegiatanClient — modal catat kegiatan", () => {
  it("tidak menawarkan tombol catat tanpa izin create", async () => {
    palsu.hasAnyPermission.mockReturnValue(false);
    await renderLayar();

    expect(tombolBukaModal()).toBeUndefined();
    expect(palsu.hasAnyPermission).toHaveBeenCalledWith([
      "presurvei:create",
      "m_presurvei:create",
    ]);
  });

  it("membuka modal dari tombol, mengirim medan ke tempatnya, lalu menyegarkan daftar", async () => {
    await renderLayar();
    expect(cari('[role="dialog"]')).toBeNull();

    await klikElemen(tombolBukaModal(), "tombol buka modal");
    expect(cari('[role="dialog"]')).not.toBeNull();

    await isiMedan("#kegiatan-hasil", "TERTARIK");
    await isiMedan("#kegiatan-waktu-mulai", "2025-01-15T10:00");
    await isiMedan("#kegiatan-ditemui", "Pak Joko");
    await isiMedan("#kegiatan-alamat", "Jl. Kenari 7");
    await isiMedan("#kegiatan-iklan", "iklan-5");
    await isiMedan("#kegiatan-prospek", "prospek-8");
    await isiMedan("#kegiatan-catatan", "Minta brosur");
    const jumlahDaftarSebelum = urlDaftarDiminta().length;
    await klikElemen(tombolKirimModal(), "tombol kirim modal");
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
      // Bergantung TZ: `tests/setup.ts:5` memaku Asia/Jakarta, jadi medan
      // `datetime-local` 10:00 menjadi instan 03:00Z.
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
    await klikElemen(tombolBukaModal(), "tombol buka modal");

    await isiMedan("#kegiatan-jenis", "KUNJUNGAN");
    await isiMedan("#kegiatan-waktu-mulai", "2025-01-15T10:00");
    await klikElemen(tombolKirimModal(), "tombol kirim modal");

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
