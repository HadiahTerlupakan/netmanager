// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel jalur ubah kegiatan di halaman rincian: tombol "Ubah" bergerbang
 * izin, modal berisi TIGA medan saja, pilihan hasil sekelompok, muatan hanya
 * medan yang berubah, invalidasi rincian + daftar, pesan 400 server di form,
 * penutupan ditahan saat menyimpan, dan riwayat tampil.
 *
 * `useApi` dan React Query berjalan sungguhan; hanya `fetch`, izin, toast,
 * dan peta yang dipalsukan. Teks waktu riwayat bergantung pada pemakuan TZ
 * Asia/Jakarta di `tests/setup.ts`.
 */

const palsu = vi.hoisted(() => ({
  hasAnyPermission: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({ hasAnyPermission: palsu.hasAnyPermission }),
}));

vi.mock("react-hot-toast", async () =>
  (await import("./presurvei-jsdom-harness")).modulToastPalsu(
    palsu.toastSuccess,
    palsu.toastError,
  ),
);

vi.mock("next/dynamic", async () => {
  const { createElement } = await import("react");
  return { default: () => () => createElement("div") };
});

import { KegiatanDetailClient } from "@/app/admin/presurvei/kegiatan/[id]/KegiatanDetailClient";
import type { KegiatanRincianDto } from "@/modules/presurvei/client";

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

/** Ditulis literal, dicocokkan ke route dan gerbang PATCH-nya. */
const URL_RINCIAN = "/api/presurvei/kegiatan/kg-7";
const IZIN_UBAH_ROUTE = ["presurvei:update", "m_presurvei:update"];
/** Awalan kunci daftar kegiatan (`kegiatanFormState.ts`), ditulis literal. */
const KUNCI_DAFTAR = "presurvei-kegiatan-list";

const kegiatanDasar: KegiatanRincianDto = {
  id: "kg-7",
  jenis: "TELEPON",
  userId: "sales-1",
  namaSales: "Andi",
  peranPelaku: null,
  departemenPelaku: null,
  prospekId: null,
  waktuMulai: "2026-09-10T02:00:00.000Z",
  waktuSelesai: null,
  alamatDikunjungi: null,
  ditemuiNama: "Bu Rina",
  latitude: null,
  longitude: null,
  hasil: "TERTARIK",
  jumlahFoto: 0,
  iklanId: null,
  catatan: "Catatan lama",
  fotoUrls: [],
  dataTeknis: null,
  createdAt: "2026-09-10T02:05:00.000Z",
  updatedAt: "2026-09-10T03:25:00.000Z",
  riwayat: [],
};

let panggung: Panggung;
let mockFetch: ReturnType<typeof vi.fn>;
let responsPatch: () => Response | Promise<Response>;
let badanPatch: unknown[];

beforeEach(() => {
  panggung = pasangPanggung();
  palsu.hasAnyPermission.mockReset().mockReturnValue(true);
  palsu.toastSuccess.mockReset();
  palsu.toastError.mockReset();
  badanPatch = [];
  responsPatch = () =>
    responsJson(200, {
      success: true,
      data: { ...kegiatanDasar, catatan: "Catatan baru" },
    });
  // Implementasinya dipasang `renderRincian` per kegiatan.
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(async () => {
  await bongkarPanggung(panggung);
  vi.unstubAllGlobals();
});

const jumlahGet = () =>
  mockFetch.mock.calls.filter(
    ([url, init]) => url === URL_RINCIAN && init?.method !== "PATCH",
  ).length;

async function renderRincian(kegiatan: KegiatanRincianDto = kegiatanDasar) {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      badanPatch.push(JSON.parse(init.body as string));
      return responsPatch();
    }
    return url === URL_RINCIAN
      ? responsJson(200, { success: true, data: kegiatan })
      : responsJson(404, { success: false, error: "Rute tidak dikenal" });
  });
  await render(panggung, <KegiatanDetailClient kegiatanId="kg-7" />);
  await tungguSampai(
    () => document.body.textContent.includes("Riwayat perubahan"),
    "rincian tampil",
  );
}

async function bukaModal() {
  await renderRincian();
  await klikTombol("Ubah");
  await tungguSampai(() => cari('[role="dialog"]') !== null, "modal terbuka");
}

describe("tombol Ubah", () => {
  it("tampil untuk pemegang izin update, dengan izin yang sama dengan route", async () => {
    await renderRincian();

    expect(tombolBerteks("Ubah")).toBeDefined();
    expect(palsu.hasAnyPermission).toHaveBeenCalledWith(IZIN_UBAH_ROUTE);
  });

  it("tersembunyi tanpa izin update", async () => {
    palsu.hasAnyPermission.mockReturnValue(false);

    await renderRincian();

    expect(tombolBerteks("Ubah")).toBeUndefined();
  });
});

describe("modal ubah", () => {
  it("hanya berisi tiga medan, berisi nilai tersimpan", async () => {
    await bukaModal();

    const dialog = cari('[role="dialog"]');
    const medan = [...dialog.querySelectorAll("input, select, textarea")].map(
      (el) => el.id,
    );
    expect(medan).toEqual([
      "ubah-kegiatan-hasil",
      "ubah-kegiatan-ditemui",
      "ubah-kegiatan-catatan",
    ]);
    expect(cari<HTMLInputElement>("#ubah-kegiatan-ditemui").value).toBe(
      "Bu Rina",
    );
    expect(cari<HTMLTextAreaElement>("#ubah-kegiatan-catatan").value).toBe(
      "Catatan lama",
    );
  });

  it("menawarkan hanya hasil sekelompok", async () => {
    await bukaModal();

    const pilihan = [
      ...cari<HTMLSelectElement>("#ubah-kegiatan-hasil").options,
    ].map((opsi) => opsi.value);
    expect(pilihan).toEqual(["TERTARIK", "DEAL"]);
  });

  it("mengirim PATCH hanya berisi medan yang berubah, lalu menutup dan menyegarkan", async () => {
    // Kueri daftar tiruan di bawah awalan yang sama dengan layar daftar dan
    // dashboard; invalidasinya dibaca dari status cache.
    panggung.queryClient.setQueryData([KUNCI_DAFTAR, "/api/x"], { isi: 1 });
    await bukaModal();
    const getSebelum = jumlahGet();

    await isiMedan("#ubah-kegiatan-catatan", "Catatan baru");
    await klikTombol("Simpan Perubahan");
    await tungguSampai(
      () => cari('[role="dialog"]') === null,
      "modal tertutup",
    );

    // `versi` = `updatedAt` rincian yang ditampilkan, dikirim apa adanya.
    expect(badanPatch).toEqual([
      { catatan: "Catatan baru", versi: "2026-09-10T03:25:00.000Z" },
    ]);
    expect(palsu.toastSuccess).toHaveBeenCalledWith(
      "Perubahan kegiatan tersimpan",
    );
    await tungguSampai(() => jumlahGet() > getSebelum, "rincian diambil ulang");
    expect(
      panggung.queryClient.getQueryState([KUNCI_DAFTAR, "/api/x"])
        .isInvalidated,
    ).toBe(true);
  });

  it("tidak mengirim apa pun bila tidak ada yang diubah", async () => {
    await bukaModal();

    await klikTombol("Simpan Perubahan");

    expect(badanPatch).toEqual([]);
    expect(cari('[role="alert"]').textContent).toBe("Belum ada yang diubah.");
  });

  it("menampilkan pesan penolakan server di form dan tetap terbuka", async () => {
    responsPatch = () =>
      responsJson(400, {
        success: false,
        error:
          "Hasil ini mengubah apakah kegiatan melahirkan prospek; catat kegiatan baru.",
      });
    await bukaModal();

    await isiMedan("#ubah-kegiatan-hasil", "DEAL");
    await klikTombol("Simpan Perubahan");
    await tungguSampai(() => cari('[role="alert"]') !== null, "pesan tampil");

    expect(cari('[role="alert"]').textContent).toBe(
      "Hasil ini mengubah apakah kegiatan melahirkan prospek; catat kegiatan baru.",
    );
    expect(cari('[role="dialog"]')).not.toBeNull();
    expect(palsu.toastSuccess).not.toHaveBeenCalled();
  });

  it("pada 409 menampilkan pesan versi basi di form dan memuat ulang rincian", async () => {
    responsPatch = () =>
      responsJson(409, { success: false, error: "Pesan server apa pun" });
    await bukaModal();
    const getSebelum = jumlahGet();

    await isiMedan("#ubah-kegiatan-catatan", "Catatan baru");
    await klikTombol("Simpan Perubahan");
    await tungguSampai(() => cari('[role="alert"]') !== null, "pesan tampil");

    expect(cari('[role="alert"]').textContent).toBe(
      "Kegiatan ini sudah diubah orang lain. Muat ulang lalu coba lagi.",
    );
    expect(cari('[role="dialog"]')).not.toBeNull();
    await tungguSampai(() => jumlahGet() > getSebelum, "rincian dimuat ulang");
  });

  it("menahan penutupan selama PATCH berjalan", async () => {
    let selesaikan: (respons: Response) => void;
    responsPatch = () =>
      new Promise<Response>((selesai) => {
        selesaikan = selesai;
      });
    await bukaModal();

    await isiMedan("#ubah-kegiatan-catatan", "Catatan baru");
    await klikTombol("Simpan Perubahan");
    await tungguSampai(() => badanPatch.length === 1, "PATCH terkirim");
    await klikTombol("Batal");

    expect(cari('[role="dialog"]')).not.toBeNull();

    selesaikan(responsJson(200, { success: true, data: kegiatanDasar }));
    await tungguSampai(
      () => cari('[role="dialog"]') === null,
      "modal tertutup",
    );
  });
});

describe("riwayat perubahan", () => {
  it("menampilkan siapa, kapan, dan medan dari → ke", async () => {
    await renderRincian({
      ...kegiatanDasar,
      riwayat: [
        {
          id: "riwayat-1",
          diubahOlehId: "admin-3",
          namaPengubah: "Admin Tiga",
          diubahPada: "2026-09-23T02:30:00.000Z",
          perubahan: { hasil: { dari: "TERTARIK", ke: "DEAL" } },
        },
      ],
    });

    const baris = cari('[data-riwayat="riwayat-1"]');
    expect(baris.textContent).toContain("Admin Tiga · 23 Sep 2026 09:30");
    expect(baris.textContent).toContain("Hasil: Tertarik → Deal");
    expect(document.body.textContent).not.toContain("Belum pernah diubah.");
  });

  it("menyatakan belum pernah diubah bila riwayat kosong", async () => {
    await renderRincian();

    expect(document.body.textContent).toContain("Belum pernah diubah.");
  });
});
