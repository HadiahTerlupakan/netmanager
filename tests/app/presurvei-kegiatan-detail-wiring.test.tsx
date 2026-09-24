// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel halaman rincian kegiatan (`KegiatanDetailClient` dan `page.tsx`-nya).
 *
 * `blokYangTampil`, `teksRentangWaktu`, dan `teksEstimasiKabel` sudah diuji
 * sebagai fungsi murni di `presurvei-kegiatan-detail-blok.test.ts`. Sebelum
 * berkas ini, NOL test mengimpor `KegiatanDetailClient.tsx`, dan review Task 9
 * membuktikan tujuh mutasi lolos hijau: URL `useApi`, tertukarnya nilai
 * `Alamat`/`Ditemui`, urutan guard `error`/`!kegiatan`, kedua pemformat yang
 * dilepas dari JSX, `??` → `||` di `BarisRingkasan`, pemasangan
 * `blokYangTampil` ke JSX — ditambah gerbang permission `page.tsx`.
 *
 * `useApi` berjalan sungguhan di atas `QueryClient` nyata dengan `fetch`
 * distub, sehingga URL yang diminta adalah URL yang benar-benar dikirim.
 * `next/dynamic` dipalsukan menjadi penangkap props peta, `next/image` menjadi
 * `<img>` biasa, dan `@/lib/rbac` dipalsukan untuk gerbang `page.tsx`.
 */

const palsu = vi.hoisted(() => ({
  propsPeta: [] as Array<Record<string, unknown>>,
  ensureAnyPermission: vi.fn(),
  hasAnyPermission: vi.fn(),
}));

// `usePermission` melempar di luar `PermissionProvider`
// (`contexts/PermissionContext.tsx`); halaman ini kini memakainya untuk
// tombol "Ubah". Kabel tombol itu diuji di presurvei-kegiatan-ubah-wiring.
vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({ hasAnyPermission: palsu.hasAnyPermission }),
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

vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ src, alt }: { src: string; alt: string }) =>
      createElement("img", { src, alt }),
  };
});

vi.mock("@/lib/rbac", () => ({
  ensureAnyPermission: palsu.ensureAnyPermission,
}));

import { KegiatanDetailClient } from "@/app/admin/presurvei/kegiatan/[id]/KegiatanDetailClient";
import HalamanDetailKegiatan from "@/app/admin/presurvei/kegiatan/[id]/page";
import type { KegiatanRincianDto } from "@/modules/presurvei/client";

import {
  bongkarPanggung,
  cari,
  nilaiBerlabel,
  pasangPanggung,
  render,
  responsJson,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

/** Ditulis literal, dicocokkan ke `app/api/presurvei/kegiatan/[id]/route.ts`. */
const URL_RINCIAN = "/api/presurvei/kegiatan/kg-7";
const IZIN_BACA_ROUTE = ["presurvei:read", "m_presurvei:read"];

/** Nilai berbeda di setiap field bersebelahan supaya pertukaran terlihat. */
const kegiatanDasar: KegiatanRincianDto = {
  id: "kg-7",
  jenis: "SURVEI_LOKASI",
  userId: "sales-1",
  namaSales: "Andi",
  peranPelaku: "NON_SALES",
  departemenPelaku: "Teknik",
  prospekId: null,
  waktuMulai: "2026-09-10T02:00:00.000Z",
  waktuSelesai: "2026-09-10T03:15:00.000Z",
  alamatDikunjungi: "Jl. Melati 1",
  ditemuiNama: "Bu Rina",
  latitude: -6.2,
  longitude: 106.8,
  hasil: "TERTARIK",
  jumlahFoto: 0,
  iklanId: null,
  catatan: "Tiang di depan rumah",
  fotoUrls: [],
  dataTeknis: {
    odpTerdekat: "ODP-JKT-12",
    estimasiKabelMeter: 120,
    catatanTeknis: "Lewat gang",
  },
  createdAt: "2026-09-10T03:20:00.000Z",
  updatedAt: "2026-09-10T03:25:00.000Z",
  riwayat: [],
};

let panggung: Panggung;
let mockFetch: ReturnType<typeof vi.fn>;
let responsRincian: () => Response;

function judulKartu(): string[] {
  return [...document.body.querySelectorAll("section > h2")].map((h2) =>
    h2.textContent.trim(),
  );
}

beforeEach(() => {
  panggung = pasangPanggung();
  palsu.propsPeta.length = 0;
  palsu.ensureAnyPermission.mockReset();
  palsu.hasAnyPermission.mockReset().mockReturnValue(false);
  responsRincian = () =>
    responsJson(200, { success: true, data: kegiatanDasar });
  mockFetch = vi.fn(async (url: string) =>
    url === URL_RINCIAN
      ? responsRincian()
      : responsJson(404, { success: false, error: "Rute tidak dikenal" }),
  );
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(async () => {
  await bongkarPanggung(panggung);
  vi.unstubAllGlobals();
});

/** Merender halaman untuk `kegiatan` lalu menunggu sampai keadaannya final. */
async function renderRincian(kegiatan: KegiatanRincianDto = kegiatanDasar) {
  responsRincian = () => responsJson(200, { success: true, data: kegiatan });
  await render(panggung, <KegiatanDetailClient kegiatanId="kg-7" />);
  await tungguSampai(
    () => judulKartu().includes("Ringkasan"),
    "ringkasan kegiatan tampil",
  );
}

describe("KegiatanDetailClient — pengambilan", () => {
  it("meminta rincian dari endpoint kegiatan itu", async () => {
    await renderRincian();

    expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([URL_RINCIAN]);
  });

  it("menampilkan pesan gagal beserta sebabnya, bukan 'tidak ditemukan'", async () => {
    // Pesan server sengaja berbeda dari teks cadangan cabang `!kegiatan`
    // ("Kegiatan tidak ditemukan"), supaya kedua cabang tak bisa tertukar
    // tanpa terlihat.
    responsRincian = () =>
      responsJson(404, {
        success: false,
        error: "Kegiatan kg-7 sudah dihapus",
      });
    await render(panggung, <KegiatanDetailClient kegiatanId="kg-7" />);

    await tungguSampai(
      () =>
        document.body.textContent.includes("Gagal memuat kegiatan") ||
        document.body.textContent.includes("Kegiatan tidak ditemukan"),
      "salah satu pesan keadaan akhir tampil",
    );
    expect(document.body.textContent).toContain(
      "Gagal memuat kegiatan: Kegiatan kg-7 sudah dihapus",
    );
    expect(document.body.textContent).not.toContain("Kegiatan tidak ditemukan");
  });
});

describe("KegiatanDetailClient — ringkasan", () => {
  it("menempatkan alamat dan nama yang ditemui di barisnya masing-masing", async () => {
    await renderRincian();

    expect(nilaiBerlabel("Alamat")).toBe("Jl. Melati 1");
    expect(nilaiBerlabel("Ditemui")).toBe("Bu Rina");
  });

  it("menampilkan rentang waktu terformat, bukan ISO mentah", async () => {
    await renderRincian();

    // `formatDateTimeDisplay`, TZ test dipaku Asia/Jakarta (UTC+7).
    expect(nilaiBerlabel("Waktu")).toBe(
      "10 Sep 2026 09:00 – 10 Sep 2026 10:15",
    );
  });

  it("menampilkan peran dan departemen pelaku di sebelah namanya", async () => {
    await renderRincian();

    expect(nilaiBerlabel("Sales")).toBe("Andi");
    expect(nilaiBerlabel("Peran")).toBe("Non-sales · Teknik");
  });

  it("mengganti peran yang tidak diketahui dengan '-'", async () => {
    await renderRincian({
      ...kegiatanDasar,
      peranPelaku: null,
      departemenPelaku: null,
    });

    expect(nilaiBerlabel("Peran")).toBe("-");
  });

  it("menampilkan estimasi kabel beserta satuannya", async () => {
    await renderRincian();

    expect(nilaiBerlabel("Estimasi kabel")).toBe("120 m");
    expect(nilaiBerlabel("ODP terdekat")).toBe("ODP-JKT-12");
  });

  it("mengganti hanya nilai null dengan '-', bukan string kosong yang sah", async () => {
    await renderRincian({
      ...kegiatanDasar,
      alamatDikunjungi: "",
      ditemuiNama: null,
    });

    expect(nilaiBerlabel("Alamat")).toBe("");
    expect(nilaiBerlabel("Ditemui")).toBe("-");
  });
});

describe("KegiatanDetailClient — blok opsional", () => {
  it("memasang peta untuk kegiatan berkoordinat tanpa foto, dengan titiknya", async () => {
    await renderRincian();

    expect(judulKartu()).toEqual([
      "Ringkasan",
      "Catatan",
      "Data teknis",
      "Titik lokasi",
      "Riwayat perubahan",
    ]);
    expect(cari("[data-peta-palsu]")).not.toBeNull();
    const props = palsu.propsPeta.at(-1);
    expect((props.titik as Array<{ id: string }>).map((t) => t.id)).toEqual([
      "kg-7",
    ]);
    // Keduanya 0 secara STRUKTURAL, bukan pilihan fixture: blok peta hanya
    // dipasang bila lintang dan bujur terisi (`blokDetail.ts:23`), sehingga
    // `keTitikPeta` tak mungkin menghitung yang tanpa koordinat
    // (`titikPeta.ts:57`), dan `diLuarBatas` adalah konstanta
    // `TAK_ADA_YANG_TERPOTONG` (`KegiatanDetailClient.tsx:47`). Tertukarnya
    // kedua props di halaman ini karena itu tak teramati DAN tak berdampak;
    // yang dijaga di sini adalah nilainya, bukan urutannya.
    expect(props).toMatchObject({ tanpaKoordinat: 0, diLuarBatas: 0 });
  });

  it("memasang galeri foto untuk kegiatan berfoto tanpa koordinat dan data teknis", async () => {
    await renderRincian({
      ...kegiatanDasar,
      jenis: "TELEPON",
      latitude: null,
      longitude: null,
      dataTeknis: null,
      fotoUrls: ["https://cdn.contoh/a.jpg", "https://cdn.contoh/b.jpg"],
      jumlahFoto: 2,
    });

    expect(judulKartu()).toEqual([
      "Ringkasan",
      "Catatan",
      "Foto (2)",
      "Riwayat perubahan",
    ]);
    expect(cari("[data-peta-palsu]")).toBeNull();
    expect(
      [...document.body.querySelectorAll("img")].map((img) =>
        img.getAttribute("src"),
      ),
    ).toEqual(["https://cdn.contoh/a.jpg", "https://cdn.contoh/b.jpg"]);
  });
});

describe("page.tsx rincian kegiatan", () => {
  it("menjaga halaman dengan izin yang sama dengan route GET-nya", async () => {
    const elemen = await HalamanDetailKegiatan({
      params: Promise.resolve({ id: "kg-7" }),
    });

    expect(palsu.ensureAnyPermission).toHaveBeenCalledWith(IZIN_BACA_ROUTE);
    expect(elemen.props).toEqual({ kegiatanId: "kg-7" });
  });

  it("tidak merender apa pun bila gerbang izin menolak", async () => {
    palsu.ensureAnyPermission.mockRejectedValue(new Error("403"));

    await expect(
      HalamanDetailKegiatan({ params: Promise.resolve({ id: "kg-7" }) }),
    ).rejects.toThrow("403");
  });
});
