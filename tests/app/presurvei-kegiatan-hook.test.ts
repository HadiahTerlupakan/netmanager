import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel pemanggilan `useKegiatanListQuery`.
 *
 * Ketiga fungsi murninya sudah diuji sendiri di
 * `presurvei-kegiatan-list-query.test.ts`. Yang dikunci di sini adalah baris
 * yang MEMANGGIL ketiganya — kelas cacat yang di Task 5 lolos `tsc` dan seluruh
 * suite: menukar `filterSetelahPindahHalaman` dengan `filterSetelahUbah(lama, {})`
 * sah sebagai `Partial<...>` dan membuat tombol pindah halaman diam-diam selalu
 * kembali ke halaman satu.
 *
 * Hook dipanggil sebagai fungsi biasa dengan `useState` distub — dua mock,
 * tanpa timer/promise/DOM. Pola yang sama dengan
 * `tests/app/presurvei-iklan-hook.test.ts`.
 */

import type { FilterKegiatan } from "@/app/admin/presurvei/kegiatan/kegiatanListQuery";
import type { KegiatanListItemDto } from "@/modules/presurvei/client";

const mockUseState = vi.fn();

/**
 * Menangkap objek konfigurasi yang diteruskan hook ke `useQuery`.
 *
 * Mock yang membuang argumennya tidak memeriksa SATU PUN konfigurasi, dan
 * membuat `queryKey: [...,  url]` → `queryKey: [...]` lolos hijau: state dan URL
 * tetap berubah tiap filter diubah, tapi cache tidak pernah berubah, sehingga
 * layar menampilkan halaman pertama tanpa filter selamanya dan seluruh filter
 * jadi dekorasi. Itu kelas cacat nomor 1 di batasan global dalam bentuk
 * terparahnya: nol argumen diperiksa.
 */
const konfigQuery = vi.fn();

/**
 * Bentuk minimal hasil `useQuery` yang dibaca hook ini.
 *
 * Dianotasi eksplisit: dengan `strictNullChecks: false`, object literal
 * ber-`null`/`undefined` tanpa tipe kontekstual memicu TS7018.
 */
type HasilQueryPalsu = {
  data: { data: KegiatanListItemDto[]; meta: unknown } | undefined;
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

// Baris ditulis utuh di dalam factory: `vi.mock` dihoist ke atas berkas, jadi
// merujuk konstanta luar dari sini akan meledak sebelum konstanta itu ada.
vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: "keepPreviousData",
  useQuery: (konfig: unknown): HasilQueryPalsu => {
    konfigQuery(konfig);
    return {
      data: {
        data: [
          {
            id: "keg-1",
            jenis: "KUNJUNGAN",
            userId: "sales-9",
            namaSales: "Wati",
            peranPelaku: null,
            departemenPelaku: null,
            prospekId: null,
            waktuMulai: "2026-09-22T01:30:00.000Z",
            alamatDikunjungi: "Jl. Melati 3",
            ditemuiNama: "Bu Ani",
            latitude: -6.2,
            longitude: 106.8,
            hasil: "TERTARIK",
            jumlahFoto: 2,
          },
          {
            id: "keg-2",
            jenis: "TELEPON",
            userId: "sales-2",
            namaSales: "Andi",
            peranPelaku: null,
            departemenPelaku: null,
            prospekId: null,
            waktuMulai: "2026-09-23T04:15:00.000Z",
            alamatDikunjungi: null,
            ditemuiNama: null,
            latitude: null,
            longitude: null,
            hasil: "PERLU_FOLLOWUP",
            jumlahFoto: 0,
          },
        ],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      },
      error: null,
      isPending: false,
    };
  },
}));

// Hook daftar sales punya `useQuery`-nya sendiri; di-stub di sini supaya
// `useQuery` palsu di atas tetap hanya melayani daftar kegiatan. Kabel hook itu
// sendiri diuji di `presurvei-daftar-sales-hook.test.ts`.
vi.mock("@/app/admin/presurvei/useDaftarSalesPresurvei", () => ({
  useDaftarSalesPresurvei: () => [
    { id: "sales-9", nama: "Wati" },
    { id: "sales-5", nama: "Eko" },
  ],
}));

import { useKegiatanListQuery } from "@/app/admin/presurvei/kegiatan/useKegiatanListQuery";

let filterTersimpan: FilterKegiatan;

describe("useKegiatanListQuery", () => {
  beforeEach(() => {
    filterTersimpan = undefined;
    konfigQuery.mockReset();
    mockUseState.mockReset();
    // Nilai awal hanya dipakai pada panggilan pertama; panggilan berikutnya
    // mengembalikan state yang tersimpan, seperti render ulang sungguhan.
    // Tanpa itu, memanggil hook dua kali dalam satu test akan menghapus
    // perubahan filter yang baru saja diuji.
    mockUseState.mockImplementation((awal: FilterKegiatan) => {
      if (filterTersimpan === undefined) filterTersimpan = awal;
      const setFilter = vi.fn(
        (
          berikutnya:
            | FilterKegiatan
            | ((lama: FilterKegiatan) => FilterKegiatan),
        ) => {
          filterTersimpan =
            typeof berikutnya === "function"
              ? berikutnya(filterTersimpan)
              : berikutnya;
        },
      );

      return [filterTersimpan, setFilter];
    });
  });

  it("memulai dari halaman pertama tanpa filter apa pun", () => {
    useKegiatanListQuery();

    expect(filterTersimpan).toEqual({
      page: 1,
      userId: "",
      jenis: "",
      hasil: "",
      dariTanggal: "",
      sampaiTanggal: "",
    });
  });

  it("memindahkan halaman tanpa menghapus kriteria yang sedang aktif", () => {
    const hook = useKegiatanListQuery();

    // Tiap medan diberi nilai berbeda: kalau dua di antaranya kembar,
    // tertukarnya di dalam hook tidak akan terlihat.
    hook.ubahFilter({
      userId: "sales-7",
      jenis: "SURVEI_LOKASI",
      hasil: "DEAL",
      dariTanggal: "2026-09-01",
      sampaiTanggal: "2026-09-30",
    });
    hook.ubahHalaman(4);

    expect(filterTersimpan).toEqual({
      page: 4,
      userId: "sales-7",
      jenis: "SURVEI_LOKASI",
      hasil: "DEAL",
      dariTanggal: "2026-09-01",
      sampaiTanggal: "2026-09-30",
    });
  });

  it("mengembalikan ke halaman pertama saat kriteria diubah", () => {
    const hook = useKegiatanListQuery();

    hook.ubahHalaman(5);
    hook.ubahFilter({ hasil: "TIDAK_MINAT" });

    expect(filterTersimpan).toEqual({
      page: 1,
      userId: "",
      jenis: "",
      hasil: "TIDAK_MINAT",
      dariTanggal: "",
      sampaiTanggal: "",
    });
  });

  it("menggabungkan daftar sales tenant dengan pelaku baris yang sedang tampil", () => {
    // Menembak argumen PERTAMA dan KEDUA `opsiSales`: sales-5 hanya ada di
    // daftar sales, sales-2 hanya ada di baris. Melupakan salah satunya
    // menghapus satu orang dari <select>.
    const hook = useKegiatanListQuery();

    expect(hook.salesTersedia).toEqual([
      { id: "sales-2", nama: "Andi" },
      { id: "sales-5", nama: "Eko" },
      { id: "sales-9", nama: "Wati" },
    ]);
  });

  it("menyertakan sales terpilih pada pilihan walau tidak ada barisnya", () => {
    // Menembak argumen KEDUA `opsiSales`. Memanggilnya dengan `""` — atau lupa
    // meneruskan `filter.userId` sama sekali — lolos `tsc` dan membuat pilihan
    // yang sedang aktif hilang dari <select> begitu barisnya tersaring habis.
    useKegiatanListQuery().ubahFilter({ userId: "sales-404" });

    // Render berikutnya: filter sudah memuat sales-404, sementara baris yang
    // dikembalikan server tetap sales-9 dan sales-2.
    expect(useKegiatanListQuery().salesTersedia).toEqual([
      { id: "sales-2", nama: "Andi" },
      { id: "sales-5", nama: "Eko" },
      { id: "sales-404", nama: "sales-404" },
      { id: "sales-9", nama: "Wati" },
    ]);
  });

  it("memakai URL berfilter sebagai kunci cache", () => {
    useKegiatanListQuery();

    // Bukan `toHaveBeenCalledOnce()`: yang dijaga adalah ISI konfigurasinya.
    // `untukPeta` yang bocor ke sini juga tertangkap — ia mengubah URL-nya
    // jadi `page=1&limit=100`.
    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "presurvei-kegiatan-list",
          "/api/presurvei/kegiatan?page=1&limit=20",
        ],
        placeholderData: "keepPreviousData",
      }),
    );
  });

  it("mengubah kunci cache saat filter berubah", () => {
    useKegiatanListQuery().ubahFilter({ hasil: "DEAL" });
    konfigQuery.mockClear();

    // Render berikutnya harus meminta kunci yang BERBEDA. Tanpa `url` di dalam
    // `queryKey`, kedua render memakai kunci yang sama dan React Query
    // menyajikan hasil lama — filter berubah di layar, data tidak pernah.
    useKegiatanListQuery();

    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "presurvei-kegiatan-list",
          "/api/presurvei/kegiatan?page=1&limit=20&hasil=DEAL",
        ],
      }),
    );
  });

  it("meminta batas peta dan tetap dipakukan ke halaman pertama", () => {
    // Halaman sengaja digeser lebih dulu. Tanpa `untukPeta` sampai ke
    // `buildKegiatanListUrl`, membuka tab peta dari halaman 3 tabel meminta
    // baris 41-60 dengan batas tabel: peta menggambar segelintir titik di
    // sebelah tabel yang penuh, tanpa satu pun pesan.
    useKegiatanListQuery().ubahHalaman(3);
    konfigQuery.mockClear();

    useKegiatanListQuery({ untukPeta: true });

    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "presurvei-kegiatan-list",
          "/api/presurvei/kegiatan?page=1&limit=100",
        ],
      }),
    );
  });

  it("membawa kriteria yang sedang aktif ke URL mode peta", () => {
    // Inilah janji "peta dan daftar menyaring himpunan yang sama". Mode peta
    // yang mengabaikan `filter` akan menggambar seluruh kunjungan semua sales
    // sementara tabel di sebelahnya menampilkan satu orang saja.
    useKegiatanListQuery().ubahFilter({ userId: "sales-7", hasil: "DEAL" });
    konfigQuery.mockClear();

    useKegiatanListQuery({ untukPeta: true });

    expect(konfigQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "presurvei-kegiatan-list",
          "/api/presurvei/kegiatan?page=1&limit=100&userId=sales-7&hasil=DEAL",
        ],
      }),
    );
  });

  it("meneruskan baris dan meta amplop apa adanya", () => {
    const hook = useKegiatanListQuery();

    expect(hook.baris.map((item) => item.id)).toEqual(["keg-1", "keg-2"]);
    expect(hook.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });
});
