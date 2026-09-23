import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel pemanggilan `useProspekKolom`.
 *
 * Fungsi murninya sudah diuji di `presurvei-prospek-kolom-query.test.ts`. Yang
 * dikunci di sini adalah baris yang MEMANGGIL mereka: kunci cache tiap halaman,
 * URL yang benar-benar di-fetch, dan "muat lebih" yang menambah halaman alih-
 * alih menukarnya.
 *
 * Hook dipanggil sebagai fungsi biasa dengan `useState`/`useEffect` distub —
 * pola yang sama dengan `tests/app/presurvei-kegiatan-hook.test.ts`.
 */

import type { MuatanKolom } from "@/app/admin/presurvei/prospek/prospekKolomQuery";
import type { ProspekListItemDto } from "@/modules/presurvei/client";

/**
 * Bentuk minimal hasil satu query yang dibaca hook ini.
 *
 * Dianotasi eksplisit: dengan `strictNullChecks: false`, object literal
 * ber-`null`/`undefined` tanpa tipe kontekstual memicu TS7018.
 */
type HasilQueryPalsu = {
  data:
    | {
        data: ProspekListItemDto[];
        meta: { total: number; totalPages: number };
      }
    | undefined;
  error: Error | null;
  isPending: boolean;
  isFetching: boolean;
  dataUpdatedAt: number;
  refetch: () => Promise<unknown>;
};

type KonfigQueries = {
  queries: { queryKey: unknown[]; queryFn: () => Promise<unknown> }[];
};

const palsu = vi.hoisted(() => ({
  useState: vi.fn(),
  /** Menangkap argumen `useQueries`; mock yang membuangnya tak menjaga apa pun. */
  konfigQueries: vi.fn(),
  toastError: vi.fn(),
  /** Hasil per nomor halaman; halaman yang tak terdaftar dianggap sedang dimuat. */
  hasilPerHalaman: new Map<number, unknown>(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: ((initial: unknown) =>
      palsu.useState(initial)) as typeof actual.useState,
    // Effect dijalankan seketika supaya kabel toast ikut teruji.
    useEffect: ((efek: () => void) => efek()) as typeof actual.useEffect,
  };
});

vi.mock("react-hot-toast", () => ({
  toast: { error: palsu.toastError },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueries: (konfig: KonfigQueries): HasilQueryPalsu[] => {
    palsu.konfigQueries(konfig);
    return konfig.queries.map(({ queryKey }): HasilQueryPalsu => {
      const halaman = queryKey[2] as number;
      const sedangDimuat: HasilQueryPalsu = {
        data: undefined,
        error: null,
        isPending: true,
        isFetching: true,
        dataUpdatedAt: 0,
        refetch: async () => undefined,
      };
      return (
        (palsu.hasilPerHalaman.get(halaman) as HasilQueryPalsu) ?? sedangDimuat
      );
    });
  },
}));

import { useProspekKolom } from "@/app/admin/presurvei/prospek/useProspekKolom";

function kartu(id: string): ProspekListItemDto {
  return {
    id,
    nama: `Nama ${id}`,
    noTelp: "0812",
    alamat: "Jl. Mawar",
    sumber: "IKLAN",
    status: "TERTARIK",
    pemilikId: null,
    paketDiminati: null,
    createdAt: "2026-09-22T00:00:00.000Z",
  };
}

function halamanTiba(
  ids: string[],
  meta: { total: number; totalPages: number },
  dataUpdatedAt = 1000,
): HasilQueryPalsu {
  return {
    data: { data: ids.map(kartu), meta },
    error: null,
    isPending: false,
    isFetching: false,
    dataUpdatedAt,
    refetch: async () => undefined,
  };
}

/** Halaman yang ditolak server; `refetch` bisa diamati. */
function halamanGagal(
  refetch: () => Promise<unknown> = async () => undefined,
): HasilQueryPalsu {
  return {
    data: undefined,
    error: new Error("500"),
    isPending: false,
    isFetching: false,
    dataUpdatedAt: 0,
    refetch,
  };
}

let muatanTersimpan: MuatanKolom;

/** Kunci yang diminta pada panggilan `useQueries` terakhir. */
function kunciTerakhir(): unknown[][] {
  const [konfig] = palsu.konfigQueries.mock.lastCall as [KonfigQueries];
  return konfig.queries.map((query) => query.queryKey);
}

describe("useProspekKolom", () => {
  beforeEach(() => {
    muatanTersimpan = undefined;
    palsu.hasilPerHalaman.clear();
    palsu.konfigQueries.mockReset();
    palsu.toastError.mockReset();
    palsu.useState.mockReset();
    // Nilai awal hanya dipakai pada panggilan pertama; render berikutnya
    // membaca state tersimpan, seperti render ulang sungguhan.
    palsu.useState.mockImplementation((awal: MuatanKolom) => {
      if (muatanTersimpan === undefined) muatanTersimpan = awal;
      const setMuatan = (
        berikutnya: MuatanKolom | ((lama: MuatanKolom) => MuatanKolom),
      ) => {
        muatanTersimpan =
          typeof berikutnya === "function"
            ? berikutnya(muatanTersimpan)
            : berikutnya;
      };
      return [muatanTersimpan, setMuatan];
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("meminta halaman pertama kolomnya sendiri saja", () => {
    useProspekKolom("NEGOSIASI");

    expect(kunciTerakhir()).toEqual([
      ["presurvei-prospek-kolom", "NEGOSIASI", 1],
    ]);
  });

  it("mempertahankan halaman lama saat memuat lebih", () => {
    // Inilah beda "menambah" dan "menukar": render berikutnya harus meminta
    // halaman satu DAN dua, bukan hanya dua.
    useProspekKolom("TERTARIK").muatLebih();
    useProspekKolom("TERTARIK");

    expect(kunciTerakhir()).toEqual([
      ["presurvei-prospek-kolom", "TERTARIK", 1],
      ["presurvei-prospek-kolom", "TERTARIK", 2],
    ]);
  });

  it("terus maju tiap kali memuat lebih", () => {
    // Dua klik, bukan satu: setter yang memaku `{ halaman: 2 }` lolos test
    // satu-klik di atas, lalu tombolnya mati diam-diam sejak klik kedua.
    useProspekKolom("TERTARIK").muatLebih();
    useProspekKolom("TERTARIK").muatLebih();
    useProspekKolom("TERTARIK");

    expect(kunciTerakhir()).toEqual([
      ["presurvei-prospek-kolom", "TERTARIK", 1],
      ["presurvei-prospek-kolom", "TERTARIK", 2],
      ["presurvei-prospek-kolom", "TERTARIK", 3],
    ]);
  });

  it("kembali ke halaman pertama saat statusnya berganti", () => {
    useProspekKolom("TERTARIK").muatLebih();
    useProspekKolom("DEAL");

    expect(kunciTerakhir()).toEqual([["presurvei-prospek-kolom", "DEAL", 1]]);
  });

  it("mengambil URL milik status dan halaman query-nya", async () => {
    const fetchPalsu = vi.fn(async () => ({
      ok: true,
      json: async (): Promise<unknown> => ({
        data: [],
        meta: { total: 0, totalPages: 0 },
      }),
    }));
    vi.stubGlobal("fetch", fetchPalsu);

    useProspekKolom("DIHUBUNGI").muatLebih();
    useProspekKolom("DIHUBUNGI");
    const [konfig] = palsu.konfigQueries.mock.lastCall as [KonfigQueries];
    await konfig.queries[1].queryFn();

    expect(fetchPalsu).toHaveBeenCalledWith(
      "/api/presurvei/prospek?status=DIHUBUNGI&page=2&limit=20",
    );
  });

  it("menolak respons gagal alih-alih menganggapnya kolom kosong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    useProspekKolom("BARU");
    const [konfig] = palsu.konfigQueries.mock.lastCall as [KonfigQueries];

    await expect(konfig.queries[0].queryFn()).rejects.toThrow(
      "Gagal memuat papan prospek",
    );
  });

  it("menggabungkan kartu seluruh halaman berikut jumlah dari server", () => {
    palsu.hasilPerHalaman.set(
      1,
      halamanTiba(["p1", "p2"], { total: 45, totalPages: 3 }),
    );
    palsu.hasilPerHalaman.set(
      2,
      halamanTiba(["p2", "p3"], { total: 47, totalPages: 3 }, 2000),
    );

    useProspekKolom("TERTARIK").muatLebih();
    const kolom = useProspekKolom("TERTARIK");

    expect(kolom.kartu.map((item) => item.id)).toEqual(["p1", "p2", "p3"]);
    expect(kolom.total).toBe(47);
    expect(kolom.adaLagi).toBe(true);
    expect(kolom.isLoading).toBe(false);
    expect(kolom.isMemuatLebih).toBe(false);
  });

  it("membedakan muatan awal dari memuat lebih", () => {
    // Halaman pertama belum tiba: seluruh kolom masih memuat.
    expect(useProspekKolom("BARU").isLoading).toBe(true);

    palsu.hasilPerHalaman.set(
      1,
      halamanTiba(["p1"], { total: 30, totalPages: 2 }),
    );
    useProspekKolom("BARU").muatLebih();
    const kolom = useProspekKolom("BARU");

    // Halaman dua sedang dimuat: kartu halaman satu tetap tampil.
    expect(kolom.isLoading).toBe(false);
    expect(kolom.isMemuatLebih).toBe(true);
    expect(kolom.kartu.map((item) => item.id)).toEqual(["p1"]);
  });

  it("memberi tahu pemakai dengan satu toast bersama saat gagal", () => {
    palsu.hasilPerHalaman.set(1, halamanGagal());

    useProspekKolom("NEGOSIASI");

    expect(palsu.toastError).toHaveBeenCalledWith(
      "Gagal memuat papan prospek",
      { id: "presurvei-prospek-kolom-gagal" },
    );
  });

  it("tidak menampilkan toast selama tidak ada yang gagal", () => {
    palsu.hasilPerHalaman.set(
      1,
      halamanTiba(["p1"], { total: 1, totalPages: 1 }),
    );

    useProspekKolom("NEGOSIASI");

    expect(palsu.toastError).not.toHaveBeenCalled();
  });

  it("memberi tahu pemakai saat hanya halaman berikutnya yang gagal", () => {
    // Halaman satu sukses: pemeriksaan yang hanya membaca halaman pertama,
    // atau yang menuntut SEMUA halaman gagal, diam di sini.
    palsu.hasilPerHalaman.set(
      1,
      halamanTiba(["p1"], { total: 30, totalPages: 2 }),
    );
    palsu.hasilPerHalaman.set(2, halamanGagal());

    useProspekKolom("DEAL").muatLebih();
    const kolom = useProspekKolom("DEAL");

    expect(kolom.halamanGagal).toBe(2);
    expect(palsu.toastError).toHaveBeenCalledWith(
      "Gagal memuat papan prospek",
      { id: "presurvei-prospek-kolom-gagal" },
    );
  });

  it("mencoba ulang halaman gagal alih-alih maju ke halaman berikutnya", () => {
    const refetchHalamanDua = vi.fn(async () => undefined);
    palsu.hasilPerHalaman.set(
      1,
      halamanTiba(["p1"], { total: 47, totalPages: 3 }),
    );
    palsu.hasilPerHalaman.set(2, halamanGagal(refetchHalamanDua));

    useProspekKolom("DEAL").muatLebih();
    // Halaman dua gagal; klik berikutnya harus mengambil ulang halaman dua.
    useProspekKolom("DEAL").muatLebih();
    useProspekKolom("DEAL");

    expect(refetchHalamanDua).toHaveBeenCalledTimes(1);
    expect(kunciTerakhir()).toEqual([
      ["presurvei-prospek-kolom", "DEAL", 1],
      ["presurvei-prospek-kolom", "DEAL", 2],
    ]);
  });

  it("mencoba ulang halaman pertama kolom yang gagal dari awal", () => {
    const refetchHalamanSatu = vi.fn(async () => undefined);
    palsu.hasilPerHalaman.set(1, halamanGagal(refetchHalamanSatu));

    useProspekKolom("BARU").muatLebih();
    useProspekKolom("BARU");

    expect(refetchHalamanSatu).toHaveBeenCalledTimes(1);
    expect(kunciTerakhir()).toEqual([["presurvei-prospek-kolom", "BARU", 1]]);
  });

  it("menandai tombol sibuk selama halaman gagal diambil ulang", () => {
    palsu.hasilPerHalaman.set(1, { ...halamanGagal(), isFetching: true });

    expect(useProspekKolom("BARU").isMemuatLebih).toBe(true);
  });
});
