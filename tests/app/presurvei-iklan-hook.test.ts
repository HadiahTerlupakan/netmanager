import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel pemanggilan `useIklanListQuery`.
 *
 * Kedua transisi filternya sudah diuji sebagai fungsi murni di
 * `presurvei-iklan-list-query.test.ts`. Yang dikunci di sini adalah baris yang
 * MEMANGGIL keduanya: menukar `filterSetelahPindahHalaman` dengan
 * `filterSetelahUbah(lama, {})` lolos kompilasi (objek kosong sah sebagai
 * `Partial<...>`) dan membuat tombol pindah halaman diam-diam selalu kembali
 * ke halaman satu.
 *
 * Repo ini tidak punya DOM palsu, jadi hook dipanggil sebagai fungsi biasa
 * dengan `useState` distub — pola yang sama dengan
 * `tests/lib/useRadiusDashboardData.test.ts`.
 */

import type { FilterIklan } from "@/app/admin/presurvei/iklan/iklanListQuery";

const mockUseState = vi.fn();

/**
 * Menangkap objek konfigurasi yang diteruskan hook ke `useQuery`.
 *
 * Mock yang membuang argumennya tidak memeriksa SATU PUN konfigurasi, dan
 * membuat `queryKey: [..., url]` → `queryKey: [...]` lolos hijau: state dan URL
 * tetap berubah tiap filter diubah, tapi cache tidak pernah berubah, sehingga
 * layar menampilkan halaman pertama tanpa filter selamanya dan seluruh filter
 * jadi dekorasi.
 */
const konfigQuery = vi.fn();

/**
 * Bentuk minimal hasil `useQuery` yang dibaca hook ini.
 *
 * Dianotasi eksplisit: dengan `strictNullChecks: false`, object literal
 * ber-`null`/`undefined` tanpa tipe kontekstual memicu TS7018.
 */
type HasilQueryPalsu = {
  data: { data: unknown[]; meta: unknown } | undefined;
  error: Error | null;
  isPending: boolean;
};

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: ((initial: unknown) =>
      mockUseState(initial)) as typeof actual.useState,
    useMemo: ((factory: () => unknown) => factory()) as typeof actual.useMemo,
    useEffect: (() => undefined) as typeof actual.useEffect,
  };
});

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: "keepPreviousData",
  useQuery: (konfig: unknown): HasilQueryPalsu => {
    konfigQuery(konfig);
    return { data: undefined, error: null, isPending: true };
  },
}));

import { useIklanListQuery } from "@/app/admin/presurvei/iklan/useIklanListQuery";

let filterTersimpan: FilterIklan;

describe("useIklanListQuery", () => {
  beforeEach(() => {
    filterTersimpan = undefined;
    konfigQuery.mockReset();
    mockUseState.mockReset();
    // Nilai awal hanya dipakai pada panggilan pertama; panggilan berikutnya
    // mengembalikan state tersimpan, seperti render ulang sungguhan — tanpa itu
    // hook tidak bisa dipanggil dua kali dalam satu test.
    mockUseState.mockImplementation((awal: FilterIklan) => {
      if (filterTersimpan === undefined) filterTersimpan = awal;
      const setFilter = vi.fn(
        (berikutnya: FilterIklan | ((lama: FilterIklan) => FilterIklan)) => {
          filterTersimpan =
            typeof berikutnya === "function"
              ? berikutnya(filterTersimpan)
              : berikutnya;
        },
      );

      return [filterTersimpan, setFilter];
    });
  });

  it("memindahkan halaman tanpa menghapus kriteria yang sedang aktif", () => {
    const hook = useIklanListQuery();

    hook.ubahFilter({ search: "ramadan", channel: "META", isAktif: false });
    hook.ubahHalaman(4);

    expect(filterTersimpan).toEqual({
      page: 4,
      search: "ramadan",
      channel: "META",
      isAktif: false,
    });
  });

  it("mengembalikan ke halaman pertama saat kriteria diubah", () => {
    const hook = useIklanListQuery();

    hook.ubahHalaman(5);
    hook.ubahFilter({ search: "ramadan" });

    expect(filterTersimpan).toEqual({
      page: 1,
      search: "ramadan",
      channel: "",
      isAktif: null,
    });
  });

  it("memakai URL berfilter sebagai kunci cache", () => {
    useIklanListQuery();

    // Bukan `toHaveBeenCalledOnce()`: yang dijaga adalah ISI konfigurasinya.
    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "presurvei-iklan-list",
          "/api/admin/presurvei/iklan?page=1&limit=20",
        ],
        placeholderData: "keepPreviousData",
      }),
    );
  });

  it("mengubah kunci cache saat filter berubah", () => {
    useIklanListQuery().ubahFilter({ search: "ramadan" });
    konfigQuery.mockClear();

    // Render berikutnya harus meminta kunci yang BERBEDA. Tanpa `url` di dalam
    // `queryKey`, kedua render memakai kunci yang sama dan React Query
    // menyajikan hasil lama — filter berubah di layar, data tidak pernah.
    useIklanListQuery();

    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "presurvei-iklan-list",
          "/api/admin/presurvei/iklan?page=1&limit=20&search=ramadan",
        ],
      }),
    );
  });

  it("memulai dari halaman pertama tanpa filter apa pun", () => {
    useIklanListQuery();

    expect(filterTersimpan).toEqual({
      page: 1,
      search: "",
      channel: "",
      isAktif: null,
    });
  });
});
