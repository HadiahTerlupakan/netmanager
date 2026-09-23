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
  isError?: boolean;
  error?: unknown;
};

const hasilQuery = vi.hoisted(() => ({ nilai: undefined as unknown }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (konfig: unknown) => {
    konfigQuery(konfig);
    return hasilQuery.nilai;
  },
}));

import {
  useDaftarSalesPresurvei,
  useKeadaanDaftarSalesPresurvei,
} from "@/app/admin/presurvei/useDaftarSalesPresurvei";

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

describe("useKeadaanDaftarSalesPresurvei", () => {
  beforeEach(() => {
    konfigQuery.mockReset();
  });

  it("membedakan gagal dari daftar yang memang kosong", () => {
    // Layar target menahan tombol simpan saat gagal; tanpa pembeda ini modal
    // hanya menampilkan pemilih kosong tanpa penjelasan.
    const gagal: HasilQueryPalsu = { data: undefined, isError: true };
    hasilQuery.nilai = gagal;

    expect(useKeadaanDaftarSalesPresurvei()).toEqual({
      status: "gagal",
      daftar: [],
    });
  });

  it("melaporkan memuat selama data belum tiba", () => {
    const memuat: HasilQueryPalsu = { data: undefined, isError: false };
    hasilQuery.nilai = memuat;

    expect(useKeadaanDaftarSalesPresurvei().status).toBe("memuat");
  });

  it("melaporkan siap beserta daftarnya, termasuk daftar kosong", () => {
    const kosong: HasilQueryPalsu = { data: { data: [] }, isError: false };
    hasilQuery.nilai = kosong;
    expect(useKeadaanDaftarSalesPresurvei()).toEqual({
      status: "siap",
      daftar: [],
    });

    const tiba: HasilQueryPalsu = {
      data: { data: [{ id: "sales-2", nama: "Budi" }] },
      isError: false,
    };
    hasilQuery.nilai = tiba;
    expect(useKeadaanDaftarSalesPresurvei()).toEqual({
      status: "siap",
      daftar: [{ id: "sales-2", nama: "Budi" }],
    });
  });

  it("tetap siap memakai data lama saat muat ulang di latar gagal", () => {
    // React Query v5 menyimpan `data` lama walau `isError` true setelah
    // refetch gagal; daftar yang sudah ada tetap sah untuk dipilih.
    const basi: HasilQueryPalsu = {
      data: { data: [{ id: "sales-3", nama: "Sari" }] },
      isError: true,
    };
    hasilQuery.nilai = basi;

    expect(useKeadaanDaftarSalesPresurvei().status).toBe("siap");
  });

  it("memakai kunci cache yang sama dengan hook daftar lama", () => {
    // Satu permintaan untuk kedua pemakai; kunci berbeda berarti dua fetch
    // dan dua salinan cache untuk data yang sama.
    useKeadaanDaftarSalesPresurvei();
    useDaftarSalesPresurvei();

    const [pertama, kedua] = konfigQuery.mock.calls.map(
      ([konfig]) => (konfig as { queryKey: unknown }).queryKey,
    );
    expect(pertama).toEqual(["presurvei-daftar-sales"]);
    expect(kedua).toEqual(["presurvei-daftar-sales"]);
  });
});

describe("useKeadaanDaftarSalesPresurvei — prospek acuan", () => {
  beforeEach(() => {
    konfigQuery.mockReset();
    vi.unstubAllGlobals();
    const kosong: HasilQueryPalsu = { data: undefined };
    hasilQuery.nilai = kosong;
  });

  const queryFnPertama = () =>
    (konfigQuery.mock.calls[0][0] as { queryFn: () => Promise<unknown> })
      .queryFn;

  it("meminta daftar sales tenant prospek lewat ?prospekId=", async () => {
    const amplopKosong: { data: SalesPresurveiDto[] } = { data: [] };
    const ambil = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => amplopKosong,
    });
    vi.stubGlobal("fetch", ambil);

    useKeadaanDaftarSalesPresurvei("prospek 9/x");
    await queryFnPertama()();

    expect(ambil).toHaveBeenCalledWith(
      "/api/admin/presurvei/sales?prospekId=prospek%209%2Fx",
    );
  });

  it("memuat prospekId di kunci cache, supaya daftar antar-tenant tidak tercampur", () => {
    useKeadaanDaftarSalesPresurvei("prospek-a");
    useKeadaanDaftarSalesPresurvei("prospek-b");

    expect(
      konfigQuery.mock.calls.map(
        ([konfig]) => (konfig as { queryKey: unknown }).queryKey,
      ),
    ).toEqual([
      ["presurvei-daftar-sales", "prospek", "prospek-a"],
      ["presurvei-daftar-sales", "prospek", "prospek-b"],
    ]);
  });

  it("menandai prospek tanpa tenant dari penolakan 422 PROSPEK_TANPA_TENANT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ success: false, code: "PROSPEK_TANPA_TENANT" }),
      }),
    );
    useKeadaanDaftarSalesPresurvei("prospek-yatim");
    const galat = await queryFnPertama()().then(
      (): unknown => null,
      (alasan: unknown): unknown => alasan,
    );

    konfigQuery.mockReset();
    const ditolak: HasilQueryPalsu = {
      data: undefined,
      isError: true,
      error: galat,
    };
    hasilQuery.nilai = ditolak;

    expect(useKeadaanDaftarSalesPresurvei("prospek-yatim")).toEqual({
      status: "tanpa-tenant",
      daftar: [],
    });
  });

  it("tetap 'gagal' untuk 422 berkode lain", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ success: false, code: "VALIDATION_ERROR" }),
      }),
    );
    useKeadaanDaftarSalesPresurvei("prospek-a");
    const galat = await queryFnPertama()().then(
      (): unknown => null,
      (alasan: unknown): unknown => alasan,
    );

    const ditolak: HasilQueryPalsu = {
      data: undefined,
      isError: true,
      error: galat,
    };
    hasilQuery.nilai = ditolak;

    expect(useKeadaanDaftarSalesPresurvei("prospek-a").status).toBe("gagal");
  });
});
