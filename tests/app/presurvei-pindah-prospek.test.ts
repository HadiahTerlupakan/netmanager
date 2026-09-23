import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pemindahan status prospek dari papan: PATCH, invalidasi dua kolom, dan
 * pemberitahuan ke pemakai.
 *
 * Fungsi murninya diuji langsung; kabel hook-nya diuji dengan `useState`,
 * `useQueryClient`, dan toast distub — pola `presurvei-prospek-kolom-hook.test.ts`.
 */

import type { ProspekListItemDto } from "@/modules/presurvei/client";

type AmplopPalsu = { data: ProspekListItemDto[] };

const palsu = vi.hoisted(() => ({
  useState: vi.fn(),
  invalidateQueries: vi.fn(),
  /** Menangkap filter `getQueriesData`; mock yang membuangnya tak menjaga apa pun. */
  getQueriesData: vi.fn(),
  toast: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: ((initial: unknown) =>
      palsu.useState(initial)) as typeof actual.useState,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: palsu.invalidateQueries,
    getQueriesData: palsu.getQueriesData,
  }),
}));

vi.mock("react-hot-toast", () => ({
  toast: Object.assign(palsu.toast, {
    success: palsu.toastSuccess,
    error: palsu.toastError,
  }),
}));

import {
  buildUbahProspekUrl,
  isKartuTermuat,
  pesanSetelahPindah,
} from "@/app/admin/presurvei/prospek/pindahProspek";
import { usePindahProspek } from "@/app/admin/presurvei/prospek/usePindahProspek";

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

describe("buildUbahProspekUrl", () => {
  it("menunjuk ke prospek yang dipindah", () => {
    expect(buildUbahProspekUrl("prospek-7")).toBe(
      "/api/presurvei/prospek/prospek-7",
    );
  });
});

describe("isKartuTermuat", () => {
  it("menemukan kartu di halaman mana pun yang sudah dimuat", () => {
    expect(isKartuTermuat([[kartu("a")], [kartu("b"), kartu("c")]], "c")).toBe(
      true,
    );
  });

  it("tidak menemukan kartu yang berada di halaman belum dimuat", () => {
    expect(isKartuTermuat([[kartu("a")], [kartu("b")]], "z")).toBe(false);
  });

  it("melewati halaman yang belum tiba", () => {
    expect(isKartuTermuat([undefined, [kartu("b")]], "b")).toBe(true);
  });
});

describe("pesanSetelahPindah", () => {
  it("menyebut kolom tujuan dengan labelnya", () => {
    expect(pesanSetelahPindah("NEGOSIASI", true)).toBe(
      "Prospek dipindah ke Negosiasi",
    );
  });

  it("memberi tahu bila kartunya tidak tampil di kolom tujuan", () => {
    // Kolom diurutkan `createdAt desc`, bukan waktu pindah, jadi prospek lama
    // bisa mendarat di halaman yang belum dimuat dan lenyap dari kedua kolom.
    const pesan = pesanSetelahPindah("TIDAK_MINAT", false);

    expect(pesan).toContain("Tidak minat");
    expect(pesan).not.toBe(pesanSetelahPindah("TIDAK_MINAT", true));
  });
});

describe("usePindahProspek", () => {
  let dipindahTersimpan: ReadonlySet<string>;
  const fetchPalsu = vi.fn();

  beforeEach(() => {
    dipindahTersimpan = new Set();
    palsu.useState.mockReset();
    // State disimpan di luar hook supaya "render" berikutnya membacanya,
    // seperti render ulang sungguhan.
    palsu.useState.mockImplementation(() => {
      return [
        dipindahTersimpan,
        (berikutnya: (lama: ReadonlySet<string>) => ReadonlySet<string>) => {
          dipindahTersimpan = berikutnya(dipindahTersimpan);
        },
      ];
    });
    palsu.invalidateQueries.mockReset();
    palsu.invalidateQueries.mockResolvedValue(undefined);
    palsu.getQueriesData.mockReset();
    palsu.getQueriesData.mockReturnValue([]);
    palsu.toast.mockReset();
    palsu.toastSuccess.mockReset();
    palsu.toastError.mockReset();
    fetchPalsu.mockReset();
    fetchPalsu.mockResolvedValue({
      ok: true,
      json: async (): Promise<unknown> => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchPalsu);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Isi cache aktif kolom tujuan, dalam bentuk `getQueriesData`. */
  function kolomTujuanBerisi(...ids: string[]) {
    const amplop: AmplopPalsu = { data: ids.map(kartu) };
    palsu.getQueriesData.mockReturnValue([
      [["presurvei-prospek-kolom", "NEGOSIASI", 1], amplop],
    ]);
  }

  const perpindahan = {
    prospekId: "prospek-7",
    dari: "TERTARIK",
    tujuan: "NEGOSIASI",
  } as const;

  it("mengirim status tujuan ke prospek yang benar", async () => {
    await usePindahProspek().pindahkan(perpindahan);

    expect(fetchPalsu).toHaveBeenCalledWith(
      "/api/presurvei/prospek/prospek-7",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "NEGOSIASI" }),
      },
    );
  });

  it("mengambil ulang kolom asal dan kolom tujuan saja", async () => {
    await usePindahProspek().pindahkan(perpindahan);

    // Awalan per kolom, bukan seluruh `[KUNCI_KOLOM_PROSPEK]`: yang terakhir
    // mengambil ulang tujuh kolom × N halaman untuk satu seretan.
    expect(palsu.invalidateQueries.mock.calls).toEqual([
      [{ queryKey: ["presurvei-prospek-kolom", "TERTARIK"] }],
      [{ queryKey: ["presurvei-prospek-kolom", "NEGOSIASI"] }],
    ]);
  });

  it("mencari kartu hanya di halaman kolom tujuan yang sedang tampil", async () => {
    await usePindahProspek().pindahkan(perpindahan);

    // `type: "active"`: cache kolom tersembunyi atau halaman yang sudah tidak
    // dirender tidak diperbarui invalidasi, jadi membacanya berbohong.
    expect(palsu.getQueriesData).toHaveBeenCalledWith({
      queryKey: ["presurvei-prospek-kolom", "NEGOSIASI"],
      type: "active",
    });
  });

  it("mencari kartu setelah kolom tujuan selesai diambil ulang", async () => {
    // Sebelum invalidasi selesai, cache tujuan masih versi sebelum pindah dan
    // kartunya pasti tidak ada di sana.
    let isInvalidasiSelesai = false;
    palsu.invalidateQueries.mockImplementation(async () => {
      await Promise.resolve();
      isInvalidasiSelesai = true;
    });
    let isSelesaiSaatDibaca = false;
    palsu.getQueriesData.mockImplementation(() => {
      isSelesaiSaatDibaca = isInvalidasiSelesai;
      return [];
    });

    await usePindahProspek().pindahkan(perpindahan);

    expect(isSelesaiSaatDibaca).toBe(true);
  });

  it("mengabarkan sukses biasa bila kartunya tampil di kolom tujuan", async () => {
    kolomTujuanBerisi("lain-1", "prospek-7");

    await usePindahProspek().pindahkan(perpindahan);

    expect(palsu.toastSuccess).toHaveBeenCalledWith(
      pesanSetelahPindah("NEGOSIASI", true),
    );
    expect(palsu.toast).not.toHaveBeenCalled();
  });

  it("memberi tahu di mana kartunya bila tidak tampil di kolom tujuan", async () => {
    kolomTujuanBerisi("lain-1", "lain-2");

    await usePindahProspek().pindahkan(perpindahan);

    expect(palsu.toast).toHaveBeenCalledWith(
      pesanSetelahPindah("NEGOSIASI", false),
      expect.objectContaining({ duration: expect.any(Number) }),
    );
    expect(palsu.toastSuccess).not.toHaveBeenCalled();
  });

  it("menampilkan pesan penolakan dari server apa adanya", async () => {
    fetchPalsu.mockResolvedValue({
      ok: false,
      json: async (): Promise<unknown> => ({
        success: false,
        error:
          "Prospek berstatus TERTARIK tidak bisa langsung dipindah ke DEAL",
        code: "INVALID_STATE",
      }),
    });

    await usePindahProspek().pindahkan(perpindahan);

    expect(palsu.toastError).toHaveBeenCalledWith(
      "Prospek berstatus TERTARIK tidak bisa langsung dipindah ke DEAL",
    );
    expect(palsu.invalidateQueries).not.toHaveBeenCalled();
    expect(palsu.toastSuccess).not.toHaveBeenCalled();
  });

  it("tetap memberi tahu saat jaringan gagal", async () => {
    fetchPalsu.mockRejectedValue(new TypeError("Failed to fetch"));

    await usePindahProspek().pindahkan(perpindahan);

    expect(palsu.toastError).toHaveBeenCalledWith("Gagal memindahkan prospek");
  });

  it("menandai kartu selama dipindah lalu melepasnya", async () => {
    let isDitandaiSaatFetch = false;
    fetchPalsu.mockImplementation(async () => {
      isDitandaiSaatFetch = usePindahProspek().isSedangDipindah("prospek-7");
      return { ok: true, json: async (): Promise<unknown> => ({}) };
    });

    await usePindahProspek().pindahkan(perpindahan);

    expect(isDitandaiSaatFetch).toBe(true);
    expect(usePindahProspek().isSedangDipindah("prospek-7")).toBe(false);
  });

  it("melepas tanda kartu walau pemindahan gagal", async () => {
    fetchPalsu.mockRejectedValue(new TypeError("Failed to fetch"));

    await usePindahProspek().pindahkan(perpindahan);

    expect(usePindahProspek().isSedangDipindah("prospek-7")).toBe(false);
  });

  it("tidak melepas tanda kartu lain yang masih dipindah", async () => {
    dipindahTersimpan = new Set(["prospek-lain"]);

    await usePindahProspek().pindahkan(perpindahan);

    expect(usePindahProspek().isSedangDipindah("prospek-lain")).toBe(true);
  });
});
