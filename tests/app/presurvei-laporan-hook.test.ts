import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel `useLaporanPeriode`: kunci cache memuat periode, dan pengambilannya
 * memakai URL dari pembentuk yang sama (`buildLaporanUrl`). Pola
 * `presurvei-target-hook.test.ts`.
 */

import type { Periode } from "@/app/admin/presurvei/periode";

const mockUseState = vi.fn();
const konfigQuery = vi.fn();

/** Hasil `useQuery` palsu; dianotasi eksplisit karena TS7018. */
type HasilQueryPalsu = {
  data: { data: unknown[] } | undefined;
  error: Error | null;
  isError: boolean;
  isPending: boolean;
};

const HASIL_MEMUAT: HasilQueryPalsu = {
  data: undefined,
  error: null,
  isError: false,
  isPending: true,
};

const hasilQuery = vi.hoisted(() => ({ nilai: undefined as unknown }));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: ((initial: unknown) =>
      mockUseState(initial)) as typeof actual.useState,
    // Effect dijalankan langsung supaya kabel toast gagal ikut teruji.
    useEffect: ((efek: () => void) => efek()) as typeof actual.useEffect,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: (konfig: unknown): HasilQueryPalsu => {
    konfigQuery(konfig);
    return hasilQuery.nilai as HasilQueryPalsu;
  },
}));

// Dievaluasi saat factory `vi.mock` berjalan, jadi wajib ikut di-hoist.
const { toastGagal } = vi.hoisted(() => ({ toastGagal: vi.fn() }));

vi.mock("react-hot-toast", () => ({ toast: { error: toastGagal } }));

import { useLaporanPeriode } from "@/app/admin/presurvei/laporan/useLaporanPeriode";

let periodeTersimpan: Periode;

describe("useLaporanPeriode", () => {
  beforeEach(() => {
    periodeTersimpan = undefined;
    hasilQuery.nilai = HASIL_MEMUAT;
    toastGagal.mockReset();
    konfigQuery.mockReset();
    mockUseState.mockReset();
    mockUseState.mockImplementation((awal: Periode | (() => Periode)) => {
      if (periodeTersimpan === undefined) {
        periodeTersimpan = typeof awal === "function" ? awal() : awal;
      }
      const setPeriode = vi.fn(
        (berikutnya: Periode | ((lama: Periode) => Periode)) => {
          periodeTersimpan =
            typeof berikutnya === "function"
              ? berikutnya(periodeTersimpan)
              : berikutnya;
        },
      );
      return [periodeTersimpan, setPeriode];
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("memulai dari periode bulan berjalan", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-04-20T05:00:00.000Z"));

    expect(useLaporanPeriode().periode).toEqual({ tahun: 2026, bulan: 4 });
  });

  it("memakai URL laporan periode sebagai kunci cache", () => {
    periodeTersimpan = { tahun: 2025, bulan: 11 };

    useLaporanPeriode();

    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "presurvei-laporan-periode",
          "/api/admin/presurvei/laporan?tahun=2025&bulan=11",
        ],
      }),
    );
  });

  it("mengubah kunci cache saat tahun diganti tanpa menghapus bulannya", () => {
    periodeTersimpan = { tahun: 2025, bulan: 11 };

    useLaporanPeriode().ubahPeriode({ tahun: 2024 });
    konfigQuery.mockClear();
    useLaporanPeriode();

    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "presurvei-laporan-periode",
          "/api/admin/presurvei/laporan?tahun=2024&bulan=11",
        ],
      }),
    );
  });

  it("mengambil dari URL laporan yang sama dengan kunci cachenya", async () => {
    periodeTersimpan = { tahun: 2024, bulan: 7 };
    const amplop: { data: unknown[] } = { data: [] };
    const ambil = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => amplop,
    });
    vi.stubGlobal("fetch", ambil);

    useLaporanPeriode();
    const { queryFn } = konfigQuery.mock.calls[0][0] as {
      queryFn: () => Promise<unknown>;
    };
    await queryFn();

    expect(ambil).toHaveBeenCalledWith(
      "/api/admin/presurvei/laporan?tahun=2024&bulan=7",
    );
  });

  it("melempar saat server menolak, supaya React Query mencatatnya gagal", async () => {
    periodeTersimpan = { tahun: 2024, bulan: 7 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    useLaporanPeriode();
    const { queryFn } = konfigQuery.mock.calls[0][0] as {
      queryFn: () => Promise<unknown>;
    };

    await expect(queryFn()).rejects.toThrow("Gagal memuat laporan");
  });

  it("melaporkan memuat selama GET belum selesai", () => {
    expect(useLaporanPeriode().isLoading).toBe(true);
  });

  it("memberi tahu pemakai lewat toast saat GET gagal, dan diam saat tidak", () => {
    useLaporanPeriode();
    expect(toastGagal).not.toHaveBeenCalled();

    const gagal: HasilQueryPalsu = {
      data: undefined,
      error: new Error("jaringan putus"),
      isError: true,
      isPending: false,
    };
    hasilQuery.nilai = gagal;
    useLaporanPeriode();

    expect(toastGagal).toHaveBeenCalledWith("Gagal memuat laporan");
  });

  it("meneruskan kegagalan GET dan membuka amplop data", () => {
    const gagal: HasilQueryPalsu = {
      data: undefined,
      error: new Error("Gagal memuat laporan"),
      isError: true,
      isPending: false,
    };
    hasilQuery.nilai = gagal;
    expect(useLaporanPeriode().isError).toBe(true);

    const tiba: HasilQueryPalsu = {
      data: { data: [{ userId: "sales-1" }] },
      error: null,
      isError: false,
      isPending: false,
    };
    hasilQuery.nilai = tiba;
    const hook = useLaporanPeriode();
    expect(hook.isError).toBe(false);
    expect(hook.daftarLaporan).toEqual([{ userId: "sales-1" }]);
  });
});
