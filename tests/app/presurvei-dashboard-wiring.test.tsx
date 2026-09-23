// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel dashboard presurvei (Task 17) yang hanya terlihat saat dirender.
 *
 * `tentukanBagianDashboard`, `teksJumlahKartu`, `hitungCorong`, dan
 * `ringkasHasilKolom` sudah diuji tanpa DOM (`presurvei-ringkasan-dashboard.test.ts`),
 * ketiga hook datanya di `presurvei-dashboard-hook.test.ts`. Yang dikunci di
 * sini, kandidat Task 19 di ledger Task 17:
 *
 * - `DashboardClient`: bagian dipasang bersyarat menurut izin — dan query
 *   bagian yang tidak dipasang tidak pernah dikirim — serta judul corong dan
 *   kegiatan diteruskan ke bagian yang benar;
 * - `CorongDashboard` memakai `teksJumlahKartu`, jadi kolom gagal/memuat tidak
 *   pernah tampil sebagai angka;
 * - cabang memuat/gagal/kosong/berisi di ketiga bagian berdaftar;
 * - tautan tiap bagian;
 * - gerbang `page.tsx`.
 *
 * Hook data berjalan sungguhan di atas `QueryClient` nyata dengan `fetch`
 * distub; hanya izin, `next/link`, dan `@/lib/rbac` yang dipalsukan.
 */

const palsu = vi.hoisted(() => ({
  izin: new Set<string>(),
  ensureAnyPermission: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({
    hasPermission: (izin: string) => palsu.izin.has(izin),
  }),
}));

vi.mock("react-hot-toast", async () =>
  (await import("./presurvei-jsdom-harness")).modulToastPalsu(
    palsu.toastSuccess,
    palsu.toastError,
  ),
);

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      href,
      children,
    }: {
      href: string;
      children: import("react").ReactNode;
    }) => createElement("a", { href }, children),
  };
});

vi.mock("@/lib/rbac", () => ({
  ensureAnyPermission: palsu.ensureAnyPermission,
}));

import {
  CorongDashboard,
  KegiatanTerbaru,
  ProspekTakBertuan,
  RingkasanPencapaian,
} from "@/app/admin/presurvei/BagianDashboard";
import { DashboardClient } from "@/app/admin/presurvei/DashboardClient";
import HalamanDashboard from "@/app/admin/presurvei/page";
import type {
  BarisLaporanDto,
  KegiatanListItemDto,
  ProspekListItemDto,
  ProspekStatus,
  SalesPresurveiDto,
} from "@/modules/presurvei/client";

import {
  bongkarPanggung,
  pasangPanggung,
  render,
  responsJson,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

/** Ditulis literal: test harus merah bila izin, rute, atau teksnya diganti. */
const IZIN_TENANT = "presurvei:read";
const IZIN_MOBILE = "m_presurvei:read";
const IZIN_LAPORAN = "presurvei_laporan:read";
const URL_PROSPEK = "/api/presurvei/prospek?";
const PENANDA_TAK_BERTUAN = "tanpaPemilik=true";
const URL_KEGIATAN = "/api/presurvei/kegiatan?";
const URL_LAPORAN = "/api/admin/presurvei/laporan?";
const URL_SALES = "/api/admin/presurvei/sales";
const MEMUAT = "Memuat…";

const SEKARANG = new Date("2026-09-15T05:00:00.000Z");

/** Total tiap kolom hidup; berbeda semua supaya tertukarnya terbaca. */
const TOTAL_KOLOM: Record<string, number> = {
  BARU: 11,
  DIHUBUNGI: 7,
  TERTARIK: 5,
  NEGOSIASI: 3,
  DEAL: 2,
};

const prospekTakBertuan: ProspekListItemDto = {
  id: "pr-1",
  nama: "Pak Harun",
  noTelp: "081200001111",
  alamat: "Jl. Cempaka 3",
  sumber: "IKLAN",
  status: "BARU",
  pemilikId: null,
  namaPemilik: null,
  paketDiminati: null,
  canvasingId: null,
  createdAt: "2026-09-14T03:00:00.000Z",
};

const kegiatan: KegiatanListItemDto = {
  id: "kg-1",
  jenis: "KUNJUNGAN",
  userId: "sales-andi",
  namaSales: "Andi",
  prospekId: null,
  waktuMulai: "2026-09-14T02:00:00.000Z",
  alamatDikunjungi: "Jl. Melati 1",
  ditemuiNama: null,
  latitude: -6.2,
  longitude: 106.8,
  hasil: "TERTARIK",
  jumlahFoto: 0,
};

const laporan: BarisLaporanDto[] = [
  {
    userId: "sales-budi",
    periodeTahun: 2026,
    periodeBulan: 9,
    kunjungan: { target: 10, tercapai: 6, persen: 60 },
    prospek: { target: 4, tercapai: 1, persen: 25 },
    konversi: { target: 2, tercapai: 1, persen: 50 },
  },
  {
    userId: "sales-cici",
    periodeTahun: 2026,
    periodeBulan: 9,
    kunjungan: { target: 0, tercapai: 3, persen: 100 },
    prospek: { target: 0, tercapai: 0, persen: 100 },
    konversi: { target: 0, tercapai: 0, persen: 100 },
  },
];

const daftarSales: SalesPresurveiDto[] = [
  { id: "sales-budi", nama: "Budi" },
  { id: "sales-cici", nama: "Cici" },
];

type Penjawab = (url: string) => Response | Promise<Response>;

/** Janji yang tak pernah selesai: bagian tetap dalam keadaan memuat. */
const TAK_PERNAH_SELESAI: Penjawab = () =>
  new Promise<Response>(() => undefined);
const DITOLAK: Penjawab = () =>
  responsJson(500, { success: false, error: "rusak" });

function amplop<T>(data: T[], total: number) {
  return {
    success: true,
    data,
    meta: { page: 1, limit: 20, total, totalPages: 1 },
  };
}

let panggung: Panggung;
let mockFetch: ReturnType<typeof vi.fn>;
let jawabKolom: (status: ProspekStatus) => Response | Promise<Response>;
let jawabTakBertuan: Penjawab;
let jawabKegiatan: Penjawab;
let jawabLaporan: Penjawab;

/** Seluruh URL yang diminta, berurutan. */
function urlDiminta(): string[] {
  return mockFetch.mock.calls.map(([url]) => String(url));
}

/** Judul `<h2>` tiap bagian, urut tampil. */
function judulBagian(): string[] {
  return [...document.body.querySelectorAll("section h2")].map((h2) =>
    h2.textContent.trim(),
  );
}

/** Bagian yang judulnya diawali `awalan`. */
function bagian(awalan: string): HTMLElement {
  const section = [...document.body.querySelectorAll("section")].find((el) =>
    el.querySelector("h2")?.textContent.startsWith(awalan),
  );
  expect(section, `bagian "${awalan}"`).toBeDefined();
  return section;
}

/** Label kartu corong → teks angkanya. */
function kartuCorong(): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const isi of document.body.querySelectorAll(".flex-1")) {
    const [label, nilai] = [...isi.children];
    hasil[label.textContent] = nilai.textContent;
  }
  return hasil;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SEKARANG);
  panggung = pasangPanggung();
  palsu.izin = new Set([IZIN_TENANT, IZIN_LAPORAN]);
  palsu.ensureAnyPermission.mockReset();
  palsu.ensureAnyPermission.mockResolvedValue(undefined);

  jawabKolom = (status) =>
    responsJson(200, amplop<ProspekListItemDto>([], TOTAL_KOLOM[status]));
  jawabTakBertuan = () => responsJson(200, amplop([prospekTakBertuan], 7));
  jawabKegiatan = () => responsJson(200, amplop([kegiatan], 1));
  jawabLaporan = () => responsJson(200, { success: true, data: laporan });

  mockFetch = vi.fn(async (url: string) => {
    if (url.startsWith(URL_PROSPEK) && url.includes(PENANDA_TAK_BERTUAN)) {
      return jawabTakBertuan(url);
    }
    if (url.startsWith(URL_PROSPEK)) {
      const status = new URL(url, "http://x").searchParams.get("status");
      return jawabKolom(status as ProspekStatus);
    }
    if (url.startsWith(URL_KEGIATAN)) return jawabKegiatan(url);
    if (url.startsWith(URL_LAPORAN)) return jawabLaporan(url);
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

describe("DashboardClient — bagian menurut izin", () => {
  /** Render lalu tunggu sampai bagian kegiatan (selalu ada) selesai dimuat. */
  async function renderDashboard() {
    await render(panggung, <DashboardClient />);
    await tungguSampai(
      () => document.body.textContent.includes("Andi"),
      "kegiatan terbaru tampil",
    );
  }

  it("pemegang izin tenant dan laporan melihat keempat bagian berjudul tenant", async () => {
    await renderDashboard();

    expect(judulBagian()).toEqual([
      "Prospek tenant",
      "Prospek tanpa pemilik",
      "Pencapaian September 2026",
      "Kegiatan tenant — 7 hari terakhir",
    ]);
  });

  it("pemegang izin mobile saja tidak memasang bagian tenant maupun laporan, dan tak memintanya", async () => {
    palsu.izin = new Set([IZIN_MOBILE]);
    await renderDashboard();

    expect(judulBagian()).toEqual([
      "Prospek Anda",
      "Kegiatan Anda — 7 hari terakhir",
    ]);
    expect(urlDiminta().some((url) => url.includes(PENANDA_TAK_BERTUAN))).toBe(
      false,
    );
    expect(urlDiminta().some((url) => url.startsWith(URL_LAPORAN))).toBe(false);
  });

  it("izin tenant tanpa izin laporan memasang daftar tak bertuan saja", async () => {
    palsu.izin = new Set([IZIN_TENANT]);
    await renderDashboard();

    expect(judulBagian()).toEqual([
      "Prospek tenant",
      "Prospek tanpa pemilik",
      "Kegiatan tenant — 7 hari terakhir",
    ]);
    expect(urlDiminta().some((url) => url.startsWith(URL_LAPORAN))).toBe(false);
  });

  it("izin laporan tanpa izin tenant memasang pencapaian saja", async () => {
    palsu.izin = new Set([IZIN_MOBILE, IZIN_LAPORAN]);
    await renderDashboard();

    expect(judulBagian()).toEqual([
      "Prospek Anda",
      "Pencapaian September 2026",
      "Kegiatan Anda — 7 hari terakhir",
    ]);
    expect(urlDiminta().some((url) => url.includes(PENANDA_TAK_BERTUAN))).toBe(
      false,
    );
  });

  it("menautkan tiap bagian ke layarnya", async () => {
    await renderDashboard();

    const tautan = [...document.body.querySelectorAll("a")].map((a) => [
      a.textContent,
      a.getAttribute("href"),
    ]);
    expect(tautan).toEqual([
      ["Buka papan", "/admin/presurvei/prospek"],
      ["Buka papan prospek", "/admin/presurvei/prospek"],
      ["Laporan lengkap", "/admin/presurvei/laporan"],
      ["Semua kegiatan", "/admin/presurvei/kegiatan"],
    ]);
  });
});

describe("CorongDashboard", () => {
  it("menampilkan angka kolom termuat, '—' untuk yang gagal, '…' untuk yang memuat", async () => {
    jawabKolom = (status) => {
      if (status === "DEAL") return DITOLAK("");
      if (status === "NEGOSIASI") return TAK_PERNAH_SELESAI("");
      return responsJson(
        200,
        amplop<ProspekListItemDto>([], TOTAL_KOLOM[status]),
      );
    };
    await render(panggung, <CorongDashboard judul="Prospek tenant" />);

    await tungguSampai(
      () => kartuCorong().Deal === "—" && kartuCorong().Baru === "11",
      "kartu termuat dan gagal",
    );
    expect(kartuCorong()).toEqual({
      Baru: "11",
      Dihubungi: "7",
      Tertarik: "5",
      Negosiasi: "…",
      Deal: "—",
    });
  });
});

describe("ProspekTakBertuan", () => {
  const isiBagian = () => bagian("Prospek tanpa pemilik").textContent;

  it("menyebut memuat selama daftar belum tiba", async () => {
    jawabTakBertuan = TAK_PERNAH_SELESAI;
    await render(panggung, <ProspekTakBertuan />);

    expect(isiBagian()).toContain(MEMUAT);
    expect(isiBagian()).not.toContain("Semua prospek sudah punya pemilik.");
  });

  it("menyebut gagal, bukan 'semua sudah bertuan', saat GET ditolak", async () => {
    jawabTakBertuan = DITOLAK;
    await render(panggung, <ProspekTakBertuan />);

    await tungguSampai(
      () => isiBagian().includes("Prospek tak bertuan gagal dimuat."),
      "pesan gagal",
    );
    expect(isiBagian()).not.toContain("Semua prospek sudah punya pemilik.");
  });

  it("menyebut semua prospek sudah bertuan saat daftarnya kosong", async () => {
    jawabTakBertuan = () => responsJson(200, amplop([], 0));
    await render(panggung, <ProspekTakBertuan />);

    await tungguSampai(
      () => isiBagian().includes("Semua prospek sudah punya pemilik."),
      "pesan kosong",
    );
  });

  it("mendaftar prospek beserta jumlah seluruhnya dari meta.total", async () => {
    await render(panggung, <ProspekTakBertuan />);

    await tungguSampai(
      () => isiBagian().includes("Pak Harun"),
      "prospek tampil",
    );
    expect(isiBagian()).toContain("081200001111 · Iklan");
    expect(isiBagian()).toContain("Menampilkan 1 dari 7 prospek tak bertuan.");
  });
});

describe("KegiatanTerbaru", () => {
  const isiBagian = () => bagian("Kegiatan tenant").textContent;

  it("menyebut memuat selama daftar belum tiba", async () => {
    jawabKegiatan = TAK_PERNAH_SELESAI;
    await render(panggung, <KegiatanTerbaru judul="Kegiatan tenant" />);

    expect(isiBagian()).toContain(MEMUAT);
    expect(isiBagian()).not.toContain("Belum ada kegiatan pada rentang ini.");
  });

  it("menyebut gagal, bukan kosong, saat GET ditolak", async () => {
    jawabKegiatan = DITOLAK;
    await render(panggung, <KegiatanTerbaru judul="Kegiatan tenant" />);

    await tungguSampai(
      () => isiBagian().includes("Kegiatan gagal dimuat."),
      "pesan gagal",
    );
    expect(isiBagian()).not.toContain("Belum ada kegiatan pada rentang ini.");
  });

  it("menyebut rentang kosong saat tidak ada kegiatan", async () => {
    jawabKegiatan = () => responsJson(200, amplop([], 0));
    await render(panggung, <KegiatanTerbaru judul="Kegiatan tenant" />);

    await tungguSampai(
      () => isiBagian().includes("Belum ada kegiatan pada rentang ini."),
      "pesan kosong",
    );
  });

  it("mendaftar jenis, hasil, dan pelaku kegiatan", async () => {
    await render(panggung, <KegiatanTerbaru judul="Kegiatan tenant" />);

    await tungguSampai(() => isiBagian().includes("Andi"), "kegiatan tampil");
    expect(isiBagian()).toContain("Kunjungan · Tertarik");
  });
});

describe("RingkasanPencapaian", () => {
  const isiBagian = () => bagian("Pencapaian").textContent;

  it("menyebut memuat selama laporan belum tiba", async () => {
    jawabLaporan = TAK_PERNAH_SELESAI;
    await render(panggung, <RingkasanPencapaian />);

    expect(isiBagian()).toContain(MEMUAT);
    expect(isiBagian()).not.toContain("Belum ada target untuk periode ini.");
  });

  it("menyebut laporan gagal, bukan belum ada target, saat GET ditolak", async () => {
    jawabLaporan = DITOLAK;
    await render(panggung, <RingkasanPencapaian />);

    await tungguSampai(
      () => isiBagian().includes("Laporan gagal dimuat."),
      "pesan gagal",
    );
    expect(isiBagian()).not.toContain("Belum ada target untuk periode ini.");
  });

  it("menyebut belum ada target saat laporannya kosong", async () => {
    jawabLaporan = () => responsJson(200, { success: true, data: [] });
    await render(panggung, <RingkasanPencapaian />);

    await tungguSampai(
      () => isiBagian().includes("Belum ada target untuk periode ini."),
      "pesan kosong",
    );
  });

  it("meringkas pencapaian per sales dan menandai yang tanpa target", async () => {
    await render(panggung, <RingkasanPencapaian />);

    await tungguSampai(() => isiBagian().includes("Budi"), "baris Budi");
    const baris = [...bagian("Pencapaian").querySelectorAll("li")].map(
      (li) => li.textContent,
    );
    expect(baris).toEqual([
      "BudiKunjungan 6/10 · Prospek 1/4 · Konversi 1/2",
      "CiciBelum ada target",
    ]);
  });
});

describe("page.tsx dashboard", () => {
  it("menjaga halaman dengan izin baca web atau mobile yang persis", async () => {
    const elemen = await HalamanDashboard();

    expect(palsu.ensureAnyPermission).toHaveBeenCalledWith([
      IZIN_TENANT,
      IZIN_MOBILE,
    ]);
    expect(elemen.type).toBe(DashboardClient);
  });

  it("tidak merender apa pun bila gerbang izin menolak", async () => {
    palsu.ensureAnyPermission.mockRejectedValue(new Error("403"));

    await expect(HalamanDashboard()).rejects.toThrow("403");
  });
});
