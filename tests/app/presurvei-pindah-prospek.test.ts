import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pemindahan status prospek dari papan: PATCH, invalidasi dua kolom, dan
 * pemberitahuan ke pemakai.
 *
 * Fungsi murninya diuji langsung; kabel hook-nya diuji dengan `useState`,
 * `useQueryClient`, dan toast distub — pola `presurvei-prospek-kolom-hook.test.ts`.
 */

import type { ProspekListItemDto } from "@/modules/presurvei/client";

/**
 * Bentuk minimal `Query` yang dibaca hook dari `getQueryCache().findAll`.
 * Dianotasi eksplisit: `strictNullChecks: false` + literal ber-`undefined`
 * memicu TS7018.
 */
type QueryPalsu = {
  state: {
    data: { data: ProspekListItemDto[] } | undefined;
    status: "pending" | "success" | "error";
    isInvalidated: boolean;
    fetchStatus: "idle" | "fetching" | "paused";
  };
};

const palsu = vi.hoisted(() => ({
  useState: vi.fn(),
  invalidateQueries: vi.fn(),
  /** Menangkap filter `findAll`; mock yang membuangnya tak menjaga apa pun. */
  findAll: vi.fn(),
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
    getQueryCache: () => ({ findAll: palsu.findAll }),
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
  isHalamanSegar,
  isKartuTermuat,
  nasibKartuSetelahPindah,
  pesanSetelahPindah,
  type StateHalamanKolom,
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

describe("isHalamanSegar", () => {
  const segar: StateHalamanKolom = {
    status: "success",
    isInvalidated: false,
    fetchStatus: "idle",
  };

  it("menerima halaman yang sukses diambil ulang", () => {
    expect(isHalamanSegar(segar)).toBe(true);
  });

  it("menolak halaman yang refetch-nya gagal", () => {
    // Refetch gagal: data lama tetap ada, status `error`, `isInvalidated`
    // true (`query-core/src/query.ts:670-684`).
    expect(
      isHalamanSegar({
        status: "error",
        isInvalidated: true,
        fetchStatus: "idle",
      }),
    ).toBe(false);
  });

  it("menolak halaman yang masih ditandai basi walau berstatus sukses", () => {
    // Refetch tertahan offline: `invalidateQueries` resolve tanpa menunggu
    // (`queryClient.ts:331-333`), data lama tetap `success`.
    expect(isHalamanSegar({ ...segar, isInvalidated: true })).toBe(false);
  });

  it("menolak halaman yang belum selesai diambil", () => {
    expect(isHalamanSegar({ ...segar, fetchStatus: "paused" })).toBe(false);
    expect(isHalamanSegar({ ...segar, status: "pending" })).toBe(false);
  });
});

describe("nasibKartuSetelahPindah", () => {
  it("tampil bila kartunya ada di halaman mana pun", () => {
    expect(
      nasibKartuSetelahPindah(
        [
          { kartu: [kartu("a")], isSegar: true },
          { kartu: [kartu("p7")], isSegar: true },
        ],
        "p7",
      ),
    ).toBe("tampil");
  });

  it("di luar muatan bila seluruh kolom segar dan kartunya tidak ada", () => {
    expect(
      nasibKartuSetelahPindah(
        [
          { kartu: [kartu("a")], isSegar: true },
          { kartu: [kartu("b")], isSegar: true },
        ],
        "p7",
      ),
    ).toBe("di-luar-muatan");
  });

  it("kolom tak termuat bila ada halaman tujuan yang gagal diambil ulang", () => {
    // Satu halaman segar tidak cukup: kartunya bisa saja ada di halaman yang
    // gagal, jadi "di luar muatan" akan menyebut penyebab yang salah.
    expect(
      nasibKartuSetelahPindah(
        [
          { kartu: [kartu("a")], isSegar: true },
          { kartu: [kartu("b")], isSegar: false },
        ],
        "p7",
      ),
    ).toBe("kolom-tak-termuat");
  });

  it("kolom tak termuat bila kolom tujuan tidak dirender sama sekali", () => {
    expect(nasibKartuSetelahPindah([], "p7")).toBe("kolom-tak-termuat");
  });
});

describe("pesanSetelahPindah", () => {
  it("menyebut kolom tujuan dengan labelnya", () => {
    expect(pesanSetelahPindah("NEGOSIASI", "tampil")).toBe(
      "Prospek dipindah ke Negosiasi",
    );
  });

  it("menjelaskan kartu yang berada di luar kartu termuat", () => {
    expect(pesanSetelahPindah("TIDAK_MINAT", "di-luar-muatan")).toBe(
      "Prospek dipindah ke Tidak minat. Kartunya tidak tampil karena berada di luar kartu yang sudah dimuat kolom Tidak minat.",
    );
  });

  it("menyebut kolom yang gagal dimuat, bukan posisi kartunya", () => {
    const pesan = pesanSetelahPindah("NEGOSIASI", "kolom-tak-termuat");

    expect(pesan).toBe(
      "Status prospek sudah dipindah ke Negosiasi, tetapi kolom Negosiasi belum bisa dimuat ulang, jadi kartunya belum tampil.",
    );
    expect(pesan).not.toContain("di luar kartu");
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
    palsu.findAll.mockReset();
    palsu.findAll.mockReturnValue([]);
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

  /** Satu halaman aktif kolom tujuan, dalam bentuk `Query` dari `findAll`. */
  function halamanTujuan(
    ids: string[],
    status: QueryPalsu["state"]["status"] = "success",
  ): QueryPalsu {
    return {
      state: {
        data: { data: ids.map(kartu) },
        status,
        isInvalidated: status !== "success",
        fetchStatus: "idle",
      },
    };
  }

  function kolomTujuanBerisi(...ids: string[]) {
    palsu.findAll.mockReturnValue([halamanTujuan(ids)]);
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
    expect(palsu.findAll).toHaveBeenCalledWith({
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
    palsu.findAll.mockImplementation(() => {
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
      pesanSetelahPindah("NEGOSIASI", "tampil"),
    );
    expect(palsu.toast).not.toHaveBeenCalled();
  });

  it("memberi tahu di mana kartunya bila tidak tampil di kolom tujuan", async () => {
    kolomTujuanBerisi("lain-1", "lain-2");

    await usePindahProspek().pindahkan(perpindahan);

    expect(palsu.toast).toHaveBeenCalledWith(
      pesanSetelahPindah("NEGOSIASI", "di-luar-muatan"),
      expect.objectContaining({ duration: expect.any(Number) }),
    );
    expect(palsu.toastSuccess).not.toHaveBeenCalled();
  });

  it("menyebut kolom yang gagal dimuat ulang, bukan kartu di luar muatan", async () => {
    // `invalidateQueries` tetap resolve walau refetch gagal
    // (`queryClient.ts:328-330`); data lama tanpa kartu itu masih di cache.
    palsu.findAll.mockReturnValue([halamanTujuan(["lain-1"], "error")]);

    await usePindahProspek().pindahkan(perpindahan);

    expect(palsu.toast).toHaveBeenCalledWith(
      pesanSetelahPindah("NEGOSIASI", "kolom-tak-termuat"),
      expect.objectContaining({ duration: expect.any(Number) }),
    );
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
