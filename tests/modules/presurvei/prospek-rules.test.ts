import { describe, expect, it } from "vitest";

/**
 * Aturan "kapan prospek boleh pindah status" hanya boleh punya satu definisi.
 * Kalau tersebar di service dan UI, prospek bisa berpindah lewat jalur yang
 * tidak diizinkan — misalnya langsung dari BARU ke DEAL tanpa pernah dihubungi.
 */

import {
  canPromosikanKeCanvasing,
  getStatusLanjutan,
  isStatusFinal,
  isTransisiStatusSah,
} from "@/modules/presurvei/domain/prospek-rules";

describe("isTransisiStatusSah", () => {
  it("mengizinkan alur maju satu langkah", () => {
    expect(isTransisiStatusSah("BARU", "DIHUBUNGI")).toBe(true);
    expect(isTransisiStatusSah("DIHUBUNGI", "TERTARIK")).toBe(true);
    expect(isTransisiStatusSah("TERTARIK", "NEGOSIASI")).toBe(true);
    expect(isTransisiStatusSah("NEGOSIASI", "DEAL")).toBe(true);
  });

  it("menolak lompatan yang melewati tahap", () => {
    expect(isTransisiStatusSah("BARU", "DEAL")).toBe(false);
    expect(isTransisiStatusSah("BARU", "NEGOSIASI")).toBe(false);
    expect(isTransisiStatusSah("DIHUBUNGI", "DEAL")).toBe(false);
  });

  it("mengizinkan penolakan dari tahap mana pun sebelum DEAL", () => {
    expect(isTransisiStatusSah("BARU", "TIDAK_MINAT")).toBe(true);
    expect(isTransisiStatusSah("DIHUBUNGI", "TIDAK_LAYAK")).toBe(true);
    expect(isTransisiStatusSah("NEGOSIASI", "TIDAK_MINAT")).toBe(true);
  });

  it("belum menganggap prospek baru tidak layak sebelum dihubungi", () => {
    expect(isTransisiStatusSah("BARU", "TIDAK_LAYAK")).toBe(false);
  });

  it("mengizinkan prospek yang menolak dibuka kembali", () => {
    expect(isTransisiStatusSah("TIDAK_MINAT", "DIHUBUNGI")).toBe(true);
  });

  it("mengunci status final", () => {
    expect(isTransisiStatusSah("DEAL", "NEGOSIASI")).toBe(false);
    expect(isTransisiStatusSah("TIDAK_LAYAK", "DIHUBUNGI")).toBe(false);
  });

  it("menolak transisi ke status yang sama", () => {
    expect(isTransisiStatusSah("TERTARIK", "TERTARIK")).toBe(false);
  });
});

describe("isStatusFinal", () => {
  it("menandai DEAL dan TIDAK_LAYAK sebagai final", () => {
    expect(isStatusFinal("DEAL")).toBe(true);
    expect(isStatusFinal("TIDAK_LAYAK")).toBe(true);
  });

  it("tidak menandai TIDAK_MINAT sebagai final karena bisa dibuka lagi", () => {
    expect(isStatusFinal("TIDAK_MINAT")).toBe(false);
  });
});

describe("getStatusLanjutan", () => {
  it("mengembalikan daftar kosong untuk status final", () => {
    expect(getStatusLanjutan("DEAL")).toEqual([]);
    expect(getStatusLanjutan("TIDAK_LAYAK")).toEqual([]);
  });

  it("mengembalikan semua tujuan yang sah dari NEGOSIASI", () => {
    expect(getStatusLanjutan("NEGOSIASI").sort()).toEqual(
      ["DEAL", "TIDAK_LAYAK", "TIDAK_MINAT"].sort(),
    );
  });
});

describe("canPromosikanKeCanvasing", () => {
  const prospekSiap = {
    status: "DEAL" as const,
    canvasingId: null,
    noTelp: "081234567890",
    alamat: "Jl. Merdeka 10",
  };

  it("mengizinkan prospek DEAL yang datanya lengkap", () => {
    expect(canPromosikanKeCanvasing(prospekSiap)).toBe(true);
  });

  it("menolak prospek yang belum DEAL", () => {
    expect(
      canPromosikanKeCanvasing({ ...prospekSiap, status: "NEGOSIASI" }),
    ).toBe(false);
  });

  it("menolak prospek yang sudah pernah dipromosikan", () => {
    expect(
      canPromosikanKeCanvasing({ ...prospekSiap, canvasingId: "canvasing-1" }),
    ).toBe(false);
  });

  it("menolak prospek tanpa nomor telepon atau alamat", () => {
    expect(canPromosikanKeCanvasing({ ...prospekSiap, noTelp: "" })).toBe(
      false,
    );
    expect(canPromosikanKeCanvasing({ ...prospekSiap, alamat: "  " })).toBe(
      false,
    );
  });
});
