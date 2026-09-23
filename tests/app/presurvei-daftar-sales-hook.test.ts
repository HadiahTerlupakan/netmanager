import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel `useDaftarSalesPresurvei`: permintaannya menuju endpoint daftar sales
 * presurvei — bukan `/api/admin/users` atau `/api/admin/marketing/sales`, yang
 * menuntut permission yang belum tentu dipegang pemakai layar presurvei — dan
 * amplopnya dibuka jadi array.
 */

import type { SalesPresurveiDto } from "@/modules/presurvei/client";

const konfigQuery = vi.fn();

/** Hasil `useQuery` palsu; dianotasi eksplisit karena TS7018. */
type HasilQueryPalsu = {
  data: { data: SalesPresurveiDto[] } | undefined;
};

const hasilQuery = vi.hoisted(() => ({ nilai: undefined as unknown }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (konfig: unknown) => {
    konfigQuery(konfig);
    return hasilQuery.nilai;
  },
}));

import { useDaftarSalesPresurvei } from "@/app/admin/presurvei/useDaftarSalesPresurvei";

describe("useDaftarSalesPresurvei", () => {
  beforeEach(() => {
    konfigQuery.mockReset();
    vi.unstubAllGlobals();
    const kosong: HasilQueryPalsu = { data: undefined };
    hasilQuery.nilai = kosong;
  });

  it("mengambil dari endpoint daftar sales presurvei", async () => {
    const amplopKosong: { data: SalesPresurveiDto[] } = { data: [] };
    const ambil = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => amplopKosong,
    });
    vi.stubGlobal("fetch", ambil);

    useDaftarSalesPresurvei();
    const { queryFn } = konfigQuery.mock.calls[0][0] as {
      queryFn: () => Promise<unknown>;
    };
    await queryFn();

    expect(ambil).toHaveBeenCalledWith("/api/admin/presurvei/sales");
  });

  it("melempar saat server menolak, supaya React Query mencatatnya gagal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    useDaftarSalesPresurvei();
    const { queryFn } = konfigQuery.mock.calls[0][0] as {
      queryFn: () => Promise<unknown>;
    };

    await expect(queryFn()).rejects.toThrow("Gagal memuat daftar sales");
  });

  it("membuka amplop menjadi array sales", () => {
    const tiba: HasilQueryPalsu = {
      data: { data: [{ id: "sales-1", nama: "Rina" }] },
    };
    hasilQuery.nilai = tiba;

    expect(useDaftarSalesPresurvei()).toEqual([
      { id: "sales-1", nama: "Rina" },
    ]);
  });

  it("mengembalikan daftar kosong selama data belum tiba", () => {
    expect(useDaftarSalesPresurvei()).toEqual([]);
  });
});
