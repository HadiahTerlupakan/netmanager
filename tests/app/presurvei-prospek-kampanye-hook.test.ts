import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel `useKampanyeBerjalan`: izin diteruskan sebagai `enabled`, permintaan
 * menuju URL pemilih, dan ringkasan dibentuk dari amplop utuh (dengan `meta`).
 * `ringkasPilihanKampanye` sendiri diuji di
 * `presurvei-prospek-form-state.test.ts`.
 */

import type { IklanListItemDto } from "@/modules/presurvei/client";

const konfigQuery = vi.fn();

/** Hasil `useQuery` palsu; dianotasi eksplisit karena TS7018. */
type HasilQueryPalsu = {
  data: { data: IklanListItemDto[]; meta: { total: number } } | undefined;
  error: Error | null;
  isLoading: boolean;
};

const hasilQuery = vi.hoisted(() => ({ nilai: undefined as unknown }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (konfig: unknown) => {
    konfigQuery(konfig);
    return hasilQuery.nilai;
  },
}));

import { useKampanyeBerjalan } from "@/app/admin/presurvei/prospek/useKampanyeBerjalan";

const iklanBerjalan: IklanListItemDto = {
  id: "iklan-jalan",
  nama: "Promo September",
  kode: "promo-sep",
  channel: "META",
  tanggalMulai: "2026-09-01T00:00:00.000Z",
  tanggalSelesai: null,
  isAktif: true,
  isBerjalan: true,
};

describe("useKampanyeBerjalan", () => {
  beforeEach(() => {
    konfigQuery.mockReset();
    const kosong: HasilQueryPalsu = {
      data: undefined,
      error: null,
      isLoading: false,
    };
    hasilQuery.nilai = kosong;
  });

  it("tidak mengirim permintaan tanpa izin membaca kampanye", () => {
    useKampanyeBerjalan(false);

    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("mengirim permintaan bila diizinkan", () => {
    useKampanyeBerjalan(true);

    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it("mengambil URL pemilih kampanye", async () => {
    const amplopKosong: HasilQueryPalsu["data"] = {
      data: [],
      meta: { total: 0 },
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => amplopKosong,
    });
    vi.stubGlobal("fetch", mockFetch);
    useKampanyeBerjalan(true);
    const { queryFn } = konfigQuery.mock.calls[0][0] as {
      queryFn: () => Promise<unknown>;
    };

    await queryFn();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/presurvei/iklan?isAktif=true&limit=100",
    );
    vi.unstubAllGlobals();
  });

  it("meringkas amplop utuh, termasuk pemotongan dari meta", () => {
    const tiba: HasilQueryPalsu = {
      data: { data: [iklanBerjalan], meta: { total: 150 } },
      error: null,
      isLoading: false,
    };
    hasilQuery.nilai = tiba;

    expect(useKampanyeBerjalan(true).ringkasan).toEqual({
      pilihan: [iklanBerjalan],
      isTerpotong: true,
    });
  });

  it("melaporkan kegagalan supaya form jatuh ke isian manual", () => {
    const gagal: HasilQueryPalsu = {
      data: undefined,
      error: new Error("403"),
      isLoading: false,
    };
    hasilQuery.nilai = gagal;

    expect(useKampanyeBerjalan(true).isGagal).toBe(true);
  });
});
