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
import { usePetaRencana } from "@/app/admin/planning/[id]/peta/usePetaRencana";
import type {
  BuatTitikRencanaInput,
  TitikRencanaDTO,
} from "@/modules/planning/client";

const ID_RENCANA = "plan-1";
const URL_PETA = `/api/planning/${ID_RENCANA}/peta/titik?lingkup=semua`;
const URL_TITIK = `/api/planning/${ID_RENCANA}/peta/titik`;
const URL_MATERIAL = `/api/planning/${ID_RENCANA}/peta/material`;
const URL_URAIKAN = "/api/planning/tautan-peta/uraikan";
const URL_TERBITKAN_PETA = `/api/planning/${ID_RENCANA}/peta/terbitkan`;
const URL_DOKUMEN = `/api/planning/${ID_RENCANA}/documents`;

/**
 * Badan permintaan apa adanya: JSON diurai, multipart dibiarkan sebagai
 * `FormData` supaya unggah foto bisa diperiksa tanpa mengurainya paksa.
 */
function bacaBadan(badan: BodyInit | null | undefined): unknown {
  if (!badan) return null;
  if (badan instanceof FormData) return badan;
  return JSON.parse(String(badan));
}

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

/** Node jaringan nyata yang jauh dari lokasi rencana, untuk menguji pusat peta. */
const nodeNyataJauh: TitikRencanaDTO = {
  nodeId: "node-nyata-jauh",
  planningId: null,
  type: "odc",
  name: "ODC-SBY-01",
  latitude: -7.25,
  longitude: 112.75,
  splitter: null,
  notes: null,
  isPlanned: false,
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
  peta: () => Response;
  uraikan: () => Response;
  hapusTitik: () => Response;
  ubahTitik: () => Response;
  terbitkan: () => Response | Promise<Response>;
  terbitkanPeta: () => Response | Promise<Response>;
  unggahFoto: () => Response;
  rekap: () => Response;
}

/** Respons peta rencana; `latarDisembunyikanKarenaIzin` bisa ditimpa per tes. */
function responsPeta(latarDisembunyikanKarenaIzin = false): Response {
  return responsJson(200, {
    success: true,
    data: {
      titik: [titikRencana],
      jalur: [],
      nodeNyata: [],
      latarDisembunyikanKarenaIzin,
    },
  });
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
        permintaan.push({ url, metode, badan: bacaBadan(opsi?.body) });

        if (url === URL_PETA) {
          return skenario.peta();
        }
        if (url === URL_MATERIAL) {
          return metode === "POST" ? skenario.terbitkan() : skenario.rekap();
        }
        if (url === URL_URAIKAN) {
          return skenario.uraikan();
        }
        if (url === `${URL_TITIK}/${titikRencana.nodeId}`) {
          return metode === "PUT"
            ? skenario.ubahTitik()
            : skenario.hapusTitik();
        }
        if (url === URL_TERBITKAN_PETA) {
          return skenario.terbitkanPeta();
        }
        if (url === URL_DOKUMEN) {
          return skenario.unggahFoto();
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
async function renderTab(
  timpa: Partial<React.ComponentProps<typeof PlanningPetaTab>> = {},
): Promise<void> {
  await render(
    panggung,
    <PlanningPetaTab
      planningId={ID_RENCANA}
      koordinatPlanning={{ latitude: -6.2, longitude: 106.8 }}
      dapatDiubah
      statusPlanning="BACKLOG"
      dapatUbahPlanning
      {...timpa}
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
      peta: () => responsPeta(),
      uraikan: responsTautanBerhasil,
      hapusTitik: () => responsJson(200, { success: true, data: {} }),
      ubahTitik: () => responsJson(200, { success: true, data: titikRencana }),
      terbitkan: () => responsJson(200, { success: true, data: [] }),
      terbitkanPeta: () =>
        responsJson(200, {
          success: true,
          data: { titikTerbit: 2, jalurTerbit: 1 },
        }),
      unggahFoto: () =>
        responsJson(201, { success: true, data: { id: "doc-1" } }),
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

  it("menjelaskan titik sudah tidak ada tanpa mengklaim satu sebab saat API membalas 404", async () => {
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
      () => teksPesan().includes("sudah tidak ada di rencana ini"),
      "pesan titik sudah tidak ada tersaji",
    );
    expect(teksPesan()).toContain("ODP-CPN-01");
    expect(teksPesan()).not.toContain("tidak ditemukan");
    // 404 juga timbul dari klik hapus kedua, jadi pesannya tidak boleh
    // menyatakan titik itu pasti sudah terbit menjadi node jaringan.
    expect(teksPesan()).toContain("atau sudah dihapus");
    // Peta disegarkan, bukan dibiarkan menampilkan keadaan lama.
    expect(permintaanKe(URL_PETA, "GET").length).toBeGreaterThan(1);
  });

  it("memusatkan peta ke koordinat rencana, bukan ke node nyata yang jauh", async () => {
    // Rencana belum punya titik. Node nyata tertua milik tenant bisa ratusan
    // kilometer dari lokasi rencana, dan itu layar pertama yang dilihat
    // perencana — jadi koordinat rencana wajib menang.
    skenario.peta = () =>
      responsJson(200, {
        success: true,
        data: {
          titik: [],
          jalur: [],
          nodeNyata: [nodeNyataJauh],
          latarDisembunyikanKarenaIzin: false,
        },
      });
    await renderTab();

    await tungguSampai(() => petaPalsu.props !== null, "peta terpasang");
    expect(petaPalsu.props?.pusat).toEqual([-6.2, 106.8]);
  });

  it("mengatakan latar jaringan disembunyikan karena izin, bukan membiarkannya tampak kosong", async () => {
    // Degradasi senyap di sini berarti perencana menyimpulkan tidak ada
    // jaringan di lokasi itu, lalu menggambar ODC kedua di atas yang sudah
    // berdiri. Jadi penanda dari server wajib dikatakan.
    skenario.peta = () => responsPeta(true);
    await renderTab();

    await tungguSampai(
      () => teksPeringatan().includes("tidak ditampilkan sebagai latar"),
      "alasan latar disembunyikan tersaji",
    );
    expect(teksPeringatan()).toContain("map:read");
    // Titik rencana tetap tersaji: endpoint tidak di-403-kan.
    expect(petaPalsu.props?.titikRencana).toHaveLength(1);
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

  /**
   * Tiga kemampuan backend yang sebelumnya tidak punya pintu masuk mana pun:
   * penerbitan titik ke topologi operasional, koreksi titik, dan unggah foto
   * titik. Rencana bisa digambar, dihitung, dan disetujui — lalu hanya `curl`
   * yang bisa menerbitkannya.
   */
  describe("penerbitan titik rencana ke peta jaringan", () => {
    it("tidak menawarkan tombol saat status rencana belum mengizinkan", async () => {
      await renderTab({ statusPlanning: "BACKLOG" });

      expect(tombolBerteks("Terbitkan titik rencana")).toBeUndefined();
      expect(document.body.textContent).toContain("belum bisa diterbitkan");
    });

    it("menawarkan tombol pada status yang diizinkan service", async () => {
      // Daftar statusnya dibaca dari domain (`STATUS_BOLEH_TERBIT`), jadi
      // tombol ini tidak bisa menyimpang dari gerbang yang ditegakkan server.
      await renderTab({ statusPlanning: "APPROVED", dapatDiubah: false });

      expect(tombolBerteks("Terbitkan titik rencana")).toBeDefined();
    });

    it("mengirim penerbitan hanya setelah konfirmasi, lalu menyegarkan peta", async () => {
      await renderTab({ statusPlanning: "IN_PROGRESS", dapatDiubah: false });
      const jumlahAmbilPetaAwal = permintaanKe(URL_PETA, "GET").length;

      await klikTombol("Terbitkan titik rencana");
      // Konfirmasi wajib: tindakan ini memasukkan baris ke topologi
      // operasional dan tidak punya tombol pembatal.
      expect(permintaanKe(URL_TERBITKAN_PETA, "POST")).toHaveLength(0);
      expect(document.body.textContent).toContain("Terbitkan titik rencana?");

      await klikTombol("Terbitkan");

      await tungguSampai(
        () => permintaanKe(URL_TERBITKAN_PETA, "POST").length === 1,
        "penerbitan peta terkirim",
      );
      await tungguSampai(
        () => teksPesan().includes("masuk ke peta jaringan"),
        "hasil penerbitan dilaporkan",
      );
      expect(permintaanKe(URL_PETA, "GET").length).toBeGreaterThan(
        jumlahAmbilPetaAwal,
      );
    });

    it("tidak mengirim apa pun bila konfirmasi dibatalkan", async () => {
      await renderTab({ statusPlanning: "APPROVED", dapatDiubah: false });

      await klikTombol("Terbitkan titik rencana");
      await klikTombol("Batal");

      expect(permintaanKe(URL_TERBITKAN_PETA, "POST")).toHaveLength(0);
    });

    it("menonaktifkan tombol selama penerbitan berjalan", async () => {
      const penahan: { lepaskan: (() => void) | null } = { lepaskan: null };
      skenario.terbitkanPeta = () =>
        new Promise<Response>((selesai) => {
          penahan.lepaskan = () =>
            selesai(
              responsJson(200, {
                success: true,
                data: { titikTerbit: 1, jalurTerbit: 0 },
              }),
            );
        });
      await renderTab({ statusPlanning: "APPROVED", dapatDiubah: false });

      await klikTombol("Terbitkan titik rencana");
      await klikTombol("Terbitkan");

      await tungguSampai(
        () => tombolBerteks("Terbitkan titik rencana")?.disabled === true,
        "tombol dinonaktifkan selama permintaan berjalan",
      );
      expect(permintaanKe(URL_TERBITKAN_PETA, "POST")).toHaveLength(1);

      await act(async () => {
        penahan.lepaskan?.();
      });
      await tungguSampai(
        () => tombolBerteks("Terbitkan titik rencana")?.disabled === false,
        "tombol aktif kembali",
      );
    });

    it("menjelaskan 403 tanpa menggemakan galat API", async () => {
      skenario.terbitkanPeta = () =>
        responsJson(403, {
          success: false,
          error: "Menerbitkan peta rencana memerlukan izin map:create",
        });
      await renderTab({ statusPlanning: "APPROVED", dapatDiubah: false });

      await klikTombol("Terbitkan titik rencana");
      await klikTombol("Terbitkan");

      await tungguSampai(
        () => teksPesan().includes("map:create"),
        "alasan penolakan dijelaskan",
      );
      expect(teksPesan()).toContain("Minta administrator");
      expect(teksPesan()).not.toContain("memerlukan izin map:create");
    });
  });

  describe("koreksi dan foto titik rencana", () => {
    /** Props peta tiruan setelah titik rencana tersaji. */
    async function propsPeta(): Promise<Record<string, unknown>> {
      await tungguSampai(
        () => petaPalsu.props !== null,
        "peta menerima titik rencana",
      );
      return petaPalsu.props!;
    }

    /**
     * Tanpa jalur ubah ini, titik dengan rasio splitter salah DAN satu kabel
     * menempel tidak bisa dikoreksi sama sekali dari layar: `hapusTitik`
     * menolak titik yang masih punya jalur. Rasio itu persis angka yang
     * menjadi jumlah barang yang dibeli.
     */
    it("mengirim PUT dengan rasio splitter yang diperbaiki", async () => {
      await renderTab();
      const ubah = (await propsPeta()).onUbahTitik as (
        titik: TitikRencanaDTO,
      ) => void;

      await act(async () => {
        ubah(titikRencana);
      });

      await tungguSampai(
        () => tombolBerteks("Simpan perubahan") !== undefined,
        "form koreksi terbuka",
      );
      // Nilai awal diambil dari titiknya, bukan dari form kosong.
      expect(cari<HTMLInputElement>("#titik-nama")?.value).toBe("ODP-CPN-01");
      expect(cari<HTMLSelectElement>("#titik-splitter")?.value).toBe("1:8");
      expect(cari<HTMLInputElement>("#titik-latitude")?.value).toBe("-6.2");
      // Jenis titik tidak bisa diganti (`ubahTitik` menolaknya), jadi
      // medannya dimatikan alih-alih menawarkan pilihan yang akan ditolak.
      expect(cari<HTMLSelectElement>("#titik-jenis")?.disabled).toBe(true);

      await isiMedan("#titik-splitter", "1:16");
      await klikTombol("Simpan perubahan");

      const urlTitikIni = `${URL_TITIK}/${titikRencana.nodeId}`;
      await tungguSampai(
        () => permintaanKe(urlTitikIni, "PUT").length === 1,
        "koreksi titik terkirim",
      );
      expect(permintaanKe(urlTitikIni, "PUT")[0].badan).toMatchObject({
        type: "odp",
        name: "ODP-CPN-01",
        splitter: "1:16",
      });
      expect(permintaanKe(URL_TITIK, "POST")).toHaveLength(0);
    });

    it("menutup form koreksi setelah berhasil", async () => {
      await renderTab();
      const ubah = (await propsPeta()).onUbahTitik as (
        titik: TitikRencanaDTO,
      ) => void;

      await act(async () => {
        ubah(titikRencana);
      });
      await klikTombol("Simpan perubahan");

      await tungguSampai(
        () => tombolBerteks("Simpan titik") !== undefined,
        "form kembali ke mode tambah",
      );
      expect(cari<HTMLInputElement>("#titik-nama")?.value).toBe("");
    });

    it("mengunggah foto titik sebagai multipart ber-nodeId", async () => {
      await renderTab();
      const unggah = (await propsPeta()).onUnggahFotoTitik as (
        nodeId: string,
        file: File,
      ) => void;

      await act(async () => {
        unggah(
          titikRencana.nodeId,
          new File(["x"], "odp.jpg", { type: "image/jpeg" }),
        );
      });

      await tungguSampai(
        () => permintaanKe(URL_DOKUMEN, "POST").length === 1,
        "unggah foto terkirim",
      );
      const badan = permintaanKe(URL_DOKUMEN, "POST")[0].badan as FormData;
      expect(badan.get("nodeId")).toBe(titikRencana.nodeId);
      expect((badan.get("file") as File).name).toBe("odp.jpg");
      await tungguSampai(
        () => teksPesan().includes("ditautkan ke titik ini"),
        "hasil unggah dilaporkan",
      );
    });
  });

  /**
   * Penjaga konkurensi diuji langsung di hook, bukan lewat tombol.
   *
   * Lewat tombol, atribut `disabled` yang menahan klik kedua — jadi penjaga di
   * dalam hook tidak pernah terbukti. Yang perlu dijaga justru jalur
   * non-klik: dua pemanggilan dalam satu tick, yang sebelumnya lolos karena
   * penjaganya membaca state dari closure yang sama.
   */
  describe("penjaga klik ganda di dalam hook", () => {
    let api: ReturnType<typeof usePetaRencana> | null = null;

    function Penyelidik(): null {
      api = usePetaRencana(ID_RENCANA);
      return null;
    }

    it("hanya mengirim satu POST untuk dua pemanggilan dalam satu tick", async () => {
      api = null;
      await render(panggung, <Penyelidik />);
      await tungguSampai(() => api !== null, "hook terpasang");

      await act(async () => {
        await Promise.all([
          api!.terbitkanMaterial(10),
          api!.terbitkanMaterial(10),
        ]);
      });

      expect(permintaanKe(URL_MATERIAL, "POST")).toHaveLength(1);
    });

    it("hanya mengirim satu DELETE untuk dua penghapusan titik yang sama", async () => {
      api = null;
      await render(panggung, <Penyelidik />);
      await tungguSampai(() => api !== null, "hook terpasang");

      await act(async () => {
        await Promise.all([
          api!.hapusTitik(titikRencana),
          api!.hapusTitik(titikRencana),
        ]);
      });

      expect(
        permintaanKe(`${URL_TITIK}/${titikRencana.nodeId}`, "DELETE"),
      ).toHaveLength(1);
    });

    /**
     * Penerbitan peta tidak punya kunci unik di basis data yang bisa
     * menolak permintaan kedua: `tandaiTerbit` memakai `updateMany` yang
     * idempoten, tetapi dua permintaan tetap menulis dua entri audit
     * "diterbitkan" dan dua jejak aktivitas. Penjaga di hook ini yang
     * mencegahnya, dan ia tidak terbukti lewat tombol karena atribut
     * `disabled` sudah menahan klik kedua.
     */
    it("hanya mengirim satu POST penerbitan peta untuk dua pemanggilan sekaligus", async () => {
      api = null;
      await render(panggung, <Penyelidik />);
      await tungguSampai(() => api !== null, "hook terpasang");

      await act(async () => {
        await Promise.all([api!.terbitkanPeta(), api!.terbitkanPeta()]);
      });

      expect(permintaanKe(URL_TERBITKAN_PETA, "POST")).toHaveLength(1);
    });

    it("hanya mengirim satu PUT untuk dua koreksi titik yang sama", async () => {
      api = null;
      await render(panggung, <Penyelidik />);
      await tungguSampai(() => api !== null, "hook terpasang");

      const masukan: BuatTitikRencanaInput = {
        type: "odp",
        name: "ODP-CPN-01",
        latitude: -6.2,
        longitude: 106.8,
        splitter: "1:16",
        notes: null,
      };
      await act(async () => {
        await Promise.all([
          api!.ubahTitik(titikRencana.nodeId, masukan),
          api!.ubahTitik(titikRencana.nodeId, masukan),
        ]);
      });

      expect(
        permintaanKe(`${URL_TITIK}/${titikRencana.nodeId}`, "PUT"),
      ).toHaveLength(1);
    });
  });
});
