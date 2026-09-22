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
  useQuery: (): HasilQueryPalsu => ({
    data: undefined,
    error: null,
    isPending: true,
  }),
}));

import { useIklanListQuery } from "@/app/admin/presurvei/iklan/useIklanListQuery";

let filterTersimpan: FilterIklan;

describe("useIklanListQuery", () => {
  beforeEach(() => {
    mockUseState.mockReset();
    mockUseState.mockImplementation((awal: FilterIklan) => {
      filterTersimpan = awal;
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
