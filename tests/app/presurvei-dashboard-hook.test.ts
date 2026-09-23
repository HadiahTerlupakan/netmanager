import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel hook dashboard presurvei.
 *
 * Fungsi murninya diuji di `presurvei-ringkasan-dashboard.test.ts`. Yang
 * dikunci di sini adalah baris yang memanggilnya: kunci cache (yang menentukan
 * apakah invalidasi papan dan form kegiatan ikut menyegarkan dashboard), URL
 * yang benar-benar di-fetch, dan hasil query yang diteruskan ke corong.
 *
 * Hook dipanggil sebagai fungsi biasa dengan `useState` distub — pola
 * `presurvei-prospek-kolom-hook.test.ts`.
 */

type KonfigQuery = { queryKey: unknown[]; queryFn: () => Promise<unknown> };

/** Hasil satu query palsu; dianotasi eksplisit karena TS7018. */
type HasilQueryPalsu = {
  data: { data: unknown[]; meta: { total: number } } | undefined;
  isError: boolean;
  isPending: boolean;
};

const palsu = vi.hoisted(() => ({
  /** Menangkap argumen; mock yang membuangnya tak menjaga apa pun. */
  konfigQueries: vi.fn(),
  konfigQuery: vi.fn(),
  hasilPerKunci: new Map<string, unknown>(),
}));

const HASIL_MEMUAT: HasilQueryPalsu = {
  data: undefined,
  isError: false,
  isPending: true,
};

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: ((awal: unknown) => [
      typeof awal === "function" ? (awal as () => unknown)() : awal,
      vi.fn(),
    ]) as unknown as typeof actual.useState,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueries: (konfig: { queries: KonfigQuery[] }): HasilQueryPalsu[] => {
    palsu.konfigQueries(konfig);
    return konfig.queries.map(
      ({ queryKey }) =>
        (palsu.hasilPerKunci.get(
          JSON.stringify(queryKey),
        ) as HasilQueryPalsu) ?? HASIL_MEMUAT,
    );
  },
  useQuery: (konfig: KonfigQuery): HasilQueryPalsu => {
    palsu.konfigQuery(konfig);
    return (
      (palsu.hasilPerKunci.get(
        JSON.stringify(konfig.queryKey),
      ) as HasilQueryPalsu) ?? HASIL_MEMUAT
    );
  },
}));

import {
  useCorongDashboard,
  useKegiatanTerbaru,
  useProspekTakBertuan,
} from "@/app/admin/presurvei/useDashboardPresurvei";
import { KUNCI_KOLOM_PROSPEK } from "@/app/admin/presurvei/prospek/prospekKolomQuery";
import { KUNCI_DAFTAR_KEGIATAN } from "@/app/admin/presurvei/kegiatan/kegiatanFormState";

/** Nilai literal, bukan impor konstanta: salah ketik di konstanta ikut tertangkap. */
const KUNCI_KOLOM_LITERAL = "presurvei-prospek-kolom";
const KUNCI_KEGIATAN_LITERAL = "presurvei-kegiatan-list";

const fetchBerhasil = () =>
  vi.fn(async () => ({
    ok: true,
    json: async (): Promise<unknown> => ({ data: [], meta: { total: 0 } }),
  }));

function tiba(total: number): HasilQueryPalsu {
  return {
    data: { data: [], meta: { total } },
    isError: false,
    isPending: false,
  };
}

beforeEach(() => {
  palsu.konfigQueries.mockReset();
  palsu.konfigQuery.mockReset();
  palsu.hasilPerKunci.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCorongDashboard", () => {
  it("memakai kunci cache halaman pertama papan untuk tiap kolom hidup", () => {
    useCorongDashboard();

    expect(palsu.konfigQueries).toHaveBeenCalledTimes(1);
    const [{ queries }] = palsu.konfigQueries.mock.calls[0] as [
      { queries: KonfigQuery[] },
    ];
    // Kunci yang sama persis dengan `useProspekKolom`: tanpa itu invalidasi
    // papan setelah seret/konversi tidak menyegarkan angka dashboard.
    expect(queries.map((q) => q.queryKey)).toEqual([
      [KUNCI_KOLOM_LITERAL, "BARU", 1],
      [KUNCI_KOLOM_LITERAL, "DIHUBUNGI", 1],
      [KUNCI_KOLOM_LITERAL, "TERTARIK", 1],
      [KUNCI_KOLOM_LITERAL, "NEGOSIASI", 1],
      [KUNCI_KOLOM_LITERAL, "DEAL", 1],
    ]);
    expect(KUNCI_KOLOM_PROSPEK).toBe(KUNCI_KOLOM_LITERAL);
  });

  it("mengambil URL kolom papan, bukan URL buatan sendiri", async () => {
    const fetchPalsu = fetchBerhasil();
    vi.stubGlobal("fetch", fetchPalsu);

    useCorongDashboard();
    const [{ queries }] = palsu.konfigQueries.mock.calls[0] as [
      { queries: KonfigQuery[] },
    ];
    await queries[3].queryFn();

    expect(fetchPalsu).toHaveBeenCalledWith(
      "/api/presurvei/prospek?status=NEGOSIASI&page=1&limit=20",
    );
  });

  it("meneruskan meta.total, kegagalan, dan muatan tiap kolom ke kartu", () => {
    palsu.hasilPerKunci.set(
      JSON.stringify([KUNCI_KOLOM_LITERAL, "BARU", 1]),
      tiba(12),
    );
    palsu.hasilPerKunci.set(
      JSON.stringify([KUNCI_KOLOM_LITERAL, "DIHUBUNGI", 1]),
      { data: undefined, isError: true, isPending: false },
    );
    palsu.hasilPerKunci.set(
      JSON.stringify([KUNCI_KOLOM_LITERAL, "NEGOSIASI", 1]),
      tiba(0),
    );
    palsu.hasilPerKunci.set(
      JSON.stringify([KUNCI_KOLOM_LITERAL, "DEAL", 1]),
      tiba(3),
    );

    const kartu = useCorongDashboard();

    expect(kartu.map((k) => [k.status, k.jumlah, k.keadaan])).toEqual([
      ["BARU", 12, "termuat"],
      ["DIHUBUNGI", null, "gagal"],
      ["TERTARIK", null, "memuat"],
      ["NEGOSIASI", 0, "termuat"],
      ["DEAL", 3, "termuat"],
    ]);
  });
});

describe("useKegiatanTerbaru", () => {
  it("memakai awalan kunci daftar kegiatan dan URL berbatas tanggal", async () => {
    // Jam dipaku: batas tanggalnya dihitung dari "sekarang".
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T10:15:00.000Z"));
    const fetchPalsu = fetchBerhasil();
    vi.stubGlobal("fetch", fetchPalsu);
    const url = "/api/presurvei/kegiatan?page=1&limit=5&dariTanggal=2026-09-17";

    useKegiatanTerbaru();

    expect(palsu.konfigQuery).toHaveBeenCalledTimes(1);
    const [konfig] = palsu.konfigQuery.mock.calls[0] as [KonfigQuery];
    // Awalan yang sama dengan invalidasi `KegiatanFormModal` — kegiatan yang
    // baru dicatat ikut muncul di dashboard.
    expect(konfig.queryKey).toEqual([KUNCI_KEGIATAN_LITERAL, url]);
    expect(KUNCI_DAFTAR_KEGIATAN).toBe(KUNCI_KEGIATAN_LITERAL);

    await konfig.queryFn();
    expect(fetchPalsu).toHaveBeenCalledWith(url);
  });

  it("membedakan gagal dari kosong", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T10:15:00.000Z"));
    palsu.hasilPerKunci.set(
      JSON.stringify([
        KUNCI_KEGIATAN_LITERAL,
        "/api/presurvei/kegiatan?page=1&limit=5&dariTanggal=2026-09-17",
      ]),
      { data: undefined, isError: true, isPending: false },
    );

    expect(useKegiatanTerbaru()).toEqual({
      daftar: [],
      isLoading: false,
      isError: true,
    });
  });
});

describe("useProspekTakBertuan", () => {
  it("mengambil halaman pertama prospek tak bertuan dan membawa totalnya", async () => {
    const fetchPalsu = fetchBerhasil();
    vi.stubGlobal("fetch", fetchPalsu);
    const url = "/api/presurvei/prospek?tanpaPemilik=true&page=1&limit=5";
    palsu.hasilPerKunci.set(
      JSON.stringify(["presurvei-prospek-tak-bertuan", url]),
      tiba(9),
    );

    const hasil = useProspekTakBertuan();

    const [konfig] = palsu.konfigQuery.mock.calls[0] as [KonfigQuery];
    expect(konfig.queryKey).toEqual(["presurvei-prospek-tak-bertuan", url]);
    expect(hasil).toEqual({
      daftar: [],
      total: 9,
      isLoading: false,
      isError: false,
    });

    await konfig.queryFn();
    expect(fetchPalsu).toHaveBeenCalledWith(url);
  });

  it("melempar saat server menolak supaya kegagalan tidak dibaca sebagai kosong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    useProspekTakBertuan();
    const [konfig] = palsu.konfigQuery.mock.calls[0] as [KonfigQuery];

    await expect(konfig.queryFn()).rejects.toThrow(
      "Gagal memuat prospek tak bertuan",
    );
  });
});
