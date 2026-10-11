// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
} from "../presurvei-jsdom-harness";

/**
 * Peta Leaflet diganti komponen palsu yang menyimpan props-nya.
 *
 * Leaflet butuh kanvas sungguhan, dan yang diuji di sini bukan
 * penggambarannya melainkan keputusan di sekelilingnya: koordinat hasil
 * tautan, rasio splitter wajib, angka pesanan, penjaga klik ganda, dan pesan
 * saat titik sudah terbit. Props yang tertangkap dipakai memanggil kembali
 * aksi yang di produksi dipicu dari popup di atas peta.
 */
const petaPalsu = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));

vi.mock("next/dynamic", async () => {
  const react = await import("react");
  return {
    default:
      () =>
      (props: Record<string, unknown>): React.ReactElement => {
        petaPalsu.props = props;
        return react.createElement("div", { "data-peta-palsu": "" });
      },
  };
});

import PlanningPetaTab from "@/app/admin/planning/[id]/peta/PlanningPetaTab";
import type { TitikRencanaDTO } from "@/modules/planning/client";

const ID_RENCANA = "plan-1";
const URL_PETA = `/api/planning/${ID_RENCANA}/peta/titik?lingkup=semua`;
const URL_TITIK = `/api/planning/${ID_RENCANA}/peta/titik`;
const URL_MATERIAL = `/api/planning/${ID_RENCANA}/peta/material`;
const URL_URAIKAN = "/api/planning/tautan-peta/uraikan";

const titikRencana: TitikRencanaDTO = {
  nodeId: "node-1",
  planningId: ID_RENCANA,
  type: "odp",
  name: "ODP-CPN-01",
  latitude: -6.2,
  longitude: 106.8,
  splitter: "1:8",
  notes: null,
  isPlanned: true,
};

/** Rekap material tiruan; 200 m terukur dengan cadangan 10% berarti 220 m dipesan. */
function rekapAwal(jalurDiabaikan = 0) {
  return {
    kabel: [{ jenisFiber: "feeder", meterTerukur: 200, meterDipesan: 220 }],
    splitter: [{ rasio: "1:8", jumlah: 1 }],
    jumlahTitik: { odp: 1, odc: 0 },
    jalurDiabaikan,
    spareKabelPersen: 10,
  };
}

function responsTautanBerhasil(): Response {
  return responsJson(200, {
    success: true,
    data: { status: "berhasil", latitude: -6.21, longitude: 106.81 },
  });
}

interface SkenarioFetch {
  uraikan: () => Response;
  hapusTitik: () => Response;
  terbitkan: () => Response | Promise<Response>;
  rekap: () => Response;
}

interface PermintaanTercatat {
  url: string;
  metode: string;
  badan: unknown;
}

let panggung: Panggung;
let skenario: SkenarioFetch;
let permintaan: PermintaanTercatat[];

/** Permintaan yang tercatat ke satu URL dengan metode tertentu. */
function permintaanKe(url: string, metode: string): PermintaanTercatat[] {
  return permintaan.filter(
    (satu) => satu.url === url && satu.metode === metode,
  );
}

function pasangFetch(): void {
  permintaan = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (
        masukan: string | URL | Request,
        opsi?: RequestInit,
      ): Promise<Response> => {
        const url = typeof masukan === "string" ? masukan : String(masukan);
        const metode = (opsi?.method ?? "GET").toUpperCase();
        permintaan.push({
          url,
          metode,
          badan: opsi?.body ? JSON.parse(String(opsi.body)) : null,
        });

        if (url === URL_PETA) {
          return responsJson(200, {
            success: true,
            data: { titik: [titikRencana], jalur: [], nodeNyata: [] },
          });
        }
        if (url === URL_MATERIAL) {
          return metode === "POST" ? skenario.terbitkan() : skenario.rekap();
        }
        if (url === URL_URAIKAN) {
          return skenario.uraikan();
        }
        if (url === `${URL_TITIK}/${titikRencana.nodeId}`) {
          return skenario.hapusTitik();
        }
        if (url === URL_TITIK && metode === "POST") {
          return responsJson(201, { success: true, data: titikRencana });
        }
        return responsJson(200, { success: true, data: {} });
      },
    ),
  );
}

/** Merender tab dan menunggu panel kebutuhan material tersaji. */
async function renderTab(): Promise<void> {
  await render(
    panggung,
    <PlanningPetaTab
      planningId={ID_RENCANA}
      koordinatPlanning={{ latitude: -6.2, longitude: 106.8 }}
      dapatDiubah
    />,
  );
  await tungguSampai(
    () => cari("#cadangan-kabel-persen") !== null,
    "panel kebutuhan material tersaji",
  );
}

/** Angka pada kolom "Dipesan (m)" untuk satu jenis fiber. */
function angkaDipesan(jenisFiber: string): string {
  return cari(`[data-dipesan="${jenisFiber}"]`)?.textContent?.trim() ?? "";
}

/** Teks spanduk pesan di atas peta. */
function teksPesan(): string {
  return cari('[role="status"]')?.textContent ?? "";
}

/** Gabungan teks semua elemen beralih peran alert (galat form dan peringatan). */
function teksPeringatan(): string {
  return [...document.body.querySelectorAll('[role="alert"]')]
    .map((elemen) => elemen.textContent ?? "")
    .join(" ");
}

describe("tab Peta planning OSP", () => {
  beforeEach(() => {
    petaPalsu.props = null;
    skenario = {
      uraikan: responsTautanBerhasil,
      hapusTitik: () => responsJson(200, { success: true, data: {} }),
      terbitkan: () => responsJson(200, { success: true, data: [] }),
      rekap: () => responsJson(200, { success: true, data: rekapAwal() }),
    };
    pasangFetch();
    panggung = pasangPanggung();
  });

  afterEach(async () => {
    await bongkarPanggung(panggung);
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("menampilkan latitude dan longitude dari tautan yang ditempel", async () => {
    await renderTab();

    await isiMedan("#titik-tautan", "https://maps.app.goo.gl/contoh");
    await klikTombol("Ambil koordinat");

    await tungguSampai(
      () => cari<HTMLInputElement>("#titik-latitude")?.value === "-6.21",
      "latitude terisi dari tautan",
    );
    expect(cari<HTMLInputElement>("#titik-longitude")?.value).toBe("106.81");
  });

  it("menampilkan pesan dan tidak mengisi koordinat saat tautan gagal diurai", async () => {
    skenario.uraikan = () =>
      responsJson(200, {
        success: true,
        data: { status: "gagal", alasan: "Tautan tidak memuat koordinat" },
      });
    await renderTab();

    await isiMedan("#titik-tautan", "https://maps.google.com/tanpa-koordinat");
    await klikTombol("Ambil koordinat");

    await tungguSampai(
      () => teksPeringatan().includes("Tautan tidak memuat koordinat"),
      "alasan kegagalan tautan tersaji",
    );
    expect(teksPeringatan()).toContain("Buka tautan itu di browser");
    expect(cari<HTMLInputElement>("#titik-latitude")?.value).toBe("");
    expect(cari<HTMLInputElement>("#titik-longitude")?.value).toBe("");
  });

  it("mewajibkan rasio splitter dipilih sebelum titik bisa disimpan", async () => {
    await renderTab();

    await isiMedan("#titik-nama", "ODP-CPN-02");
    await isiMedan("#titik-latitude", "-6.22");
    await isiMedan("#titik-longitude", "106.82");
    await klikTombol("Simpan titik");

    expect(teksPeringatan()).toContain("Rasio splitter wajib dipilih");
    expect(permintaanKe(URL_TITIK, "POST")).toHaveLength(0);

    await isiMedan("#titik-splitter", "1:16");
    await klikTombol("Simpan titik");

    await tungguSampai(
      () => permintaanKe(URL_TITIK, "POST").length === 1,
      "titik dikirim setelah rasio dipilih",
    );
    expect(permintaanKe(URL_TITIK, "POST")[0].badan).toMatchObject({
      splitter: "1:16",
    });
  });

  it("memperbarui angka pesanan saat persentase cadangan diubah", async () => {
    await renderTab();

    await tungguSampai(
      () => angkaDipesan("feeder") !== "",
      "tabel kabel tersaji",
    );
    expect(angkaDipesan("feeder")).toMatch(/^220[.,]0$/);
    expect(cari('[data-terukur="feeder"]')?.textContent?.trim()).toMatch(
      /^200[.,]0$/,
    );

    await isiMedan("#cadangan-kabel-persen", "25");

    await tungguSampai(
      () => /^250[.,]0$/.test(angkaDipesan("feeder")),
      "angka pesanan mengikuti cadangan baru",
    );
    // Pratinjau tidak boleh menulis apa pun sebelum tombol ditekan.
    expect(permintaanKe(URL_MATERIAL, "POST")).toHaveLength(0);
  });

  it("menonaktifkan tombol perbarui material selama permintaan berjalan", async () => {
    const penahan: { lepaskan: (() => void) | null } = { lepaskan: null };
    skenario.terbitkan = () =>
      new Promise<Response>((selesai) => {
        penahan.lepaskan = () =>
          selesai(responsJson(200, { success: true, data: [] }));
      });
    await renderTab();

    await klikTombol("Perbarui kebutuhan material");
    await tungguSampai(
      () => tombolBerteks("Perbarui kebutuhan material")?.disabled === true,
      "tombol dinonaktifkan selama permintaan berjalan",
    );

    // Klik kedua selama permintaan berjalan tidak boleh menggandakan material:
    // lapisan data belum punya kunci konkurensi, dan duplikatnya menetap.
    await act(async () => {
      tombolBerteks("Perbarui kebutuhan material")?.click();
    });
    expect(permintaanKe(URL_MATERIAL, "POST")).toHaveLength(1);

    await act(async () => {
      penahan.lepaskan?.();
    });
    await tungguSampai(
      () => tombolBerteks("Perbarui kebutuhan material")?.disabled === false,
      "tombol aktif kembali setelah permintaan selesai",
    );
    expect(permintaanKe(URL_MATERIAL, "POST")).toHaveLength(1);
  });

  it("mengirim persentase cadangan yang dipilih saat material diterbitkan", async () => {
    await renderTab();

    await isiMedan("#cadangan-kabel-persen", "25");
    await klikTombol("Perbarui kebutuhan material");

    await tungguSampai(
      () => permintaanKe(URL_MATERIAL, "POST").length === 1,
      "penerbitan material terkirim",
    );
    expect(permintaanKe(URL_MATERIAL, "POST")[0].badan).toEqual({
      spareKabelPersen: 25,
    });
  });

  it("menjelaskan titik sudah terbit, bukan tidak ditemukan, saat API membalas 404", async () => {
    skenario.hapusTitik = () =>
      responsJson(404, { success: false, error: "Titik tidak ditemukan" });
    await renderTab();

    await tungguSampai(
      () => petaPalsu.props !== null,
      "peta menerima titik rencana",
    );
    const hapus = petaPalsu.props?.onHapusTitik as (
      titik: TitikRencanaDTO,
    ) => Promise<void>;
    await act(async () => {
      await hapus(titikRencana);
    });

    await tungguSampai(
      () => teksPesan().includes("sudah terbit menjadi node jaringan nyata"),
      "pesan titik sudah terbit tersaji",
    );
    expect(teksPesan()).toContain("ODP-CPN-01");
    expect(teksPesan()).not.toContain("tidak ditemukan");
    // Peta disegarkan, bukan dibiarkan menampilkan keadaan lama.
    expect(permintaanKe(URL_PETA, "GET").length).toBeGreaterThan(1);
  });

  it("memberi tahu jumlah jalur yang panjangnya tidak bisa dihitung", async () => {
    skenario.rekap = () =>
      responsJson(200, { success: true, data: rekapAwal(2) });
    await renderTab();

    await tungguSampai(
      () => teksPeringatan().includes("2 jalur tidak bisa dihitung"),
      "peringatan jalur diabaikan tersaji",
    );
    expect(teksPeringatan()).toContain("lebih kecil dari kenyataan");
  });
});
