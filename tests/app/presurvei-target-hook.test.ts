import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel `useTargetPeriode` dan `useSimpanTarget`.
 *
 * Fungsi murninya (`buildTargetUrl`, `kunciQueryTarget`) diuji di
 * `presurvei-periode-query.test.ts`. Yang dikunci di sini adalah baris yang
 * MEMANGGIL keduanya: kunci cache yang tidak memuat periode membuat pemilih
 * bulan mengubah teks di layar tanpa pernah mengubah datanya, dan invalidasi
 * yang meleset dari kunci itu membuat target yang baru disimpan tidak muncul.
 *
 * Hook dipanggil sebagai fungsi biasa dengan `useState` distub — pola
 * `presurvei-iklan-hook.test.ts`.
 */

import type { Periode } from "@/app/admin/presurvei/periode";
import type { MuatanTarget } from "@/app/admin/presurvei/target/targetFormState";

const mockUseState = vi.fn();
const konfigQuery = vi.fn();
const invalidateQueries = vi.fn();
// Dievaluasi saat factory `vi.mock` berjalan, jadi wajib ikut di-hoist.
const { toastSukses, toastGagal } = vi.hoisted(() => ({
  toastSukses: vi.fn(),
  toastGagal: vi.fn(),
}));

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
    useMemo: ((factory: () => unknown) => factory()) as typeof actual.useMemo,
    // Effect dijalankan langsung supaya kabel toast gagal ikut teruji.
    useEffect: ((efek: () => void) => efek()) as typeof actual.useEffect,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: (konfig: unknown): HasilQueryPalsu => {
    konfigQuery(konfig);
    return hasilQuery.nilai as HasilQueryPalsu;
  },
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("react-hot-toast", () => ({
  toast: { success: toastSukses, error: toastGagal },
}));

import { useSimpanTarget } from "@/app/admin/presurvei/target/useSimpanTarget";
import { useTargetPeriode } from "@/app/admin/presurvei/target/useTargetPeriode";

let periodeTersimpan: Periode;

describe("useTargetPeriode", () => {
  beforeEach(() => {
    periodeTersimpan = undefined;
    hasilQuery.nilai = HASIL_MEMUAT;
    toastGagal.mockReset();
    konfigQuery.mockReset();
    mockUseState.mockReset();
    // Nilai awal (lazy initializer) hanya dipakai pada panggilan pertama,
    // seperti render ulang sungguhan.
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
    vi.setSystemTime(new Date("2026-03-10T05:00:00.000Z"));

    expect(useTargetPeriode().periode).toEqual({ tahun: 2026, bulan: 3 });
  });

  it("memakai URL periode sebagai kunci cache", () => {
    periodeTersimpan = { tahun: 2025, bulan: 11 };

    useTargetPeriode();

    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "presurvei-target-periode",
          "/api/admin/presurvei/target?tahun=2025&bulan=11",
        ],
      }),
    );
  });

  it("mengubah kunci cache saat bulan diganti tanpa menghapus tahunnya", () => {
    periodeTersimpan = { tahun: 2025, bulan: 11 };

    useTargetPeriode().ubahPeriode({ bulan: 4 });
    konfigQuery.mockClear();
    useTargetPeriode();

    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "presurvei-target-periode",
          "/api/admin/presurvei/target?tahun=2025&bulan=4",
        ],
      }),
    );
  });

  it("meneruskan kegagalan GET supaya tabel tidak menyebutnya kosong", () => {
    const gagal: HasilQueryPalsu = {
      data: undefined,
      error: new Error("Gagal memuat target"),
      isError: true,
      isPending: false,
    };
    hasilQuery.nilai = gagal;

    expect(useTargetPeriode().isError).toBe(true);
    hasilQuery.nilai = HASIL_MEMUAT;
    expect(useTargetPeriode().isError).toBe(false);
  });

  it("melaporkan memuat selama GET belum selesai", () => {
    expect(useTargetPeriode().isLoading).toBe(true);
  });

  it("memberi tahu pemakai lewat toast saat GET gagal, dan diam saat tidak", () => {
    useTargetPeriode();
    expect(toastGagal).not.toHaveBeenCalled();

    const gagal: HasilQueryPalsu = {
      data: undefined,
      error: new Error("jaringan putus"),
      isError: true,
      isPending: false,
    };
    hasilQuery.nilai = gagal;
    useTargetPeriode();

    expect(toastGagal).toHaveBeenCalledWith("Gagal memuat target");
  });

  it("mengambil dari URL periode yang sama dengan kunci cachenya", async () => {
    periodeTersimpan = { tahun: 2024, bulan: 7 };
    const amplop: { data: unknown[] } = { data: [] };
    const ambil = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => amplop,
    });
    vi.stubGlobal("fetch", ambil);

    useTargetPeriode();
    const { queryFn } = konfigQuery.mock.calls[0][0] as {
      queryFn: () => Promise<unknown>;
    };
    await queryFn();

    expect(ambil).toHaveBeenCalledWith(
      "/api/admin/presurvei/target?tahun=2024&bulan=7",
    );
  });
});

describe("useSimpanTarget", () => {
  const MUATAN: MuatanTarget = Object.freeze({
    userId: "user-rina-000111",
    periodeTahun: 2025,
    periodeBulan: 11,
    targetKunjungan: 40,
    targetProspek: 12,
    targetKonversi: 3,
  });

  beforeEach(() => {
    mockUseState.mockReset();
    mockUseState.mockImplementation((awal: unknown) => [awal, vi.fn()]);
    invalidateQueries.mockReset();
    toastSukses.mockReset();
    toastGagal.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mengirim POST lalu membuang cache periode yang disimpan", async () => {
    const ambil = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    });
    vi.stubGlobal("fetch", ambil);
    const onBerhasil = vi.fn();

    await useSimpanTarget(onBerhasil).simpan(MUATAN);

    expect(ambil).toHaveBeenCalledWith("/api/admin/presurvei/target", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MUATAN),
    });
    // Kedua kunci: laporan disusun dari daftar target
    // (`modules/presurvei/services/TargetService.ts:53-54,64`), jadi laporan
    // periode yang sama basi begitu targetnya berubah.
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "presurvei-target-periode",
        "/api/admin/presurvei/target?tahun=2025&bulan=11",
      ],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "presurvei-laporan-periode",
        "/api/admin/presurvei/laporan?tahun=2025&bulan=11",
      ],
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(onBerhasil).toHaveBeenCalledTimes(1);
    expect(toastGagal).not.toHaveBeenCalled();
  });

  it("menampilkan pesan server saat ditolak dan tidak menutup modal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        // Bentuk yang dibaca `formatApiError` (`lib/utils/api-response-parser.ts`).
        json: async () => ({ error: "Anda tidak berhak menetapkan target" }),
      }),
    );
    const onBerhasil = vi.fn();

    await useSimpanTarget(onBerhasil).simpan(MUATAN);

    expect(toastGagal).toHaveBeenCalledWith(
      "Anda tidak berhak menetapkan target",
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(onBerhasil).not.toHaveBeenCalled();
  });
});
