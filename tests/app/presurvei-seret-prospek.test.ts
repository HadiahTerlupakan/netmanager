import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Keputusan seret dipegang hook, bukan komponen: menguji handler DOM lewat
 * render jsdom jauh lebih mahal daripada menguji keputusannya langsung.
 *
 * Kabel JSX-nya (kartu `draggable`, kolom yang menolak `dragover`) dikunci
 * terpisah di `presurvei-prospek-papan.test.tsx`.
 */

import type { KartuDiangkat } from "@/app/admin/presurvei/prospek/useSeretProspek";
import {
  PROSPEK_STATUSES,
  type ProspekStatus,
} from "@/modules/presurvei/client";

const palsu = vi.hoisted(() => ({ useState: vi.fn() }));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: ((initial: unknown) =>
      palsu.useState(initial)) as typeof actual.useState,
  };
});

import {
  isKartuDapatDiseret,
  putuskanSeret,
  tampilanKolomSaatSeret,
  useSeretProspek,
} from "@/app/admin/presurvei/prospek/useSeretProspek";

describe("putuskanSeret", () => {
  it("tidak melakukan apa pun tanpa kartu yang diangkat", () => {
    const aksi = putuskanSeret(null, "DIHUBUNGI");

    expect(aksi).toBeNull();
  });

  it("menolak kolom yang tidak sah menurut aturan domain", () => {
    expect(putuskanSeret({ id: "p1", dari: "BARU" }, "DEAL")).toBeNull();
  });

  it("meminta ubah status untuk perpindahan biasa", () => {
    expect(putuskanSeret({ id: "p1", dari: "BARU" }, "DIHUBUNGI")).toEqual({
      prospekId: "p1",
      aksi: { jenis: "ubah-status", tujuan: "DIHUBUNGI" },
    });
  });

  it("meminta form konversi saat tujuannya DEAL", () => {
    expect(putuskanSeret({ id: "p9", dari: "NEGOSIASI" }, "DEAL")).toEqual({
      prospekId: "p9",
      aksi: { jenis: "buka-konversi" },
    });
  });

  it("membawa id kartu yang benar, bukan id kolomnya", () => {
    // `prospekId` dan status sama-sama string yang diteruskan bersebelahan;
    // tertukarnya akan memindahkan kartu yang salah tanpa ditolak compiler.
    const hasil = putuskanSeret(
      { id: "prospek-42", dari: "TERTARIK" },
      "NEGOSIASI",
    );

    expect(hasil?.prospekId).toBe("prospek-42");
  });
});

describe("tampilanKolomSaatSeret", () => {
  const dariTertarik: KartuDiangkat = { id: "p3", dari: "TERTARIK" };

  it("netral selama tidak ada kartu diangkat", () => {
    expect(tampilanKolomSaatSeret(null, "DIHUBUNGI")).toBe("netral");
  });

  it("menyalakan kolom yang sah menerima kartu", () => {
    expect(tampilanKolomSaatSeret(dariTertarik, "NEGOSIASI")).toBe("tujuan");
  });

  it("meredupkan kolom yang tidak sah menerima kartu", () => {
    // TERTARIK tidak boleh mundur ke BARU (`prospek-rules.ts:31`).
    expect(tampilanKolomSaatSeret(dariTertarik, "BARU")).toBe("redup");
  });

  it("tidak meredupkan kolom asal kartu", () => {
    // Kolom asal bukan tujuan sah, tapi meredupkannya membuat kartu yang
    // baru saja diangkat tampak ditolak dari kolomnya sendiri.
    expect(tampilanKolomSaatSeret(dariTertarik, "TERTARIK")).toBe("netral");
  });
});

describe("isKartuDapatDiseret", () => {
  // Seluruh enum, bukan contoh: `Record` memaksa status baru dijawab di sini.
  // Asimetris — hanya status tanpa transisi sah yang dikunci; TIDAK_MINAT
  // masih bisa kembali ke DIHUBUNGI (`prospek-rules.ts:34`).
  const HARAPAN: Record<ProspekStatus, boolean> = {
    BARU: true,
    DIHUBUNGI: true,
    TERTARIK: true,
    NEGOSIASI: true,
    DEAL: false,
    TIDAK_MINAT: true,
    TIDAK_LAYAK: false,
  };

  it.each([...PROSPEK_STATUSES])(
    "mengikuti aturan final untuk %s bila pemakai boleh mengubah",
    (status) => {
      expect(isKartuDapatDiseret(status, true)).toBe(HARAPAN[status]);
    },
  );

  it.each([...PROSPEK_STATUSES])(
    "mengunci %s bila pemakai tidak boleh mengubah",
    (status) => {
      expect(isKartuDapatDiseret(status, false)).toBe(false);
    },
  );
});

describe("useSeretProspek", () => {
  let diangkatTersimpan: KartuDiangkat | null;
  const onUbahStatus = vi.fn();
  const onBukaKonversi = vi.fn();

  beforeEach(() => {
    diangkatTersimpan = null;
    onUbahStatus.mockReset();
    onBukaKonversi.mockReset();
    palsu.useState.mockReset();
    palsu.useState.mockImplementation(() => [
      diangkatTersimpan,
      (berikutnya: KartuDiangkat | null) => {
        diangkatTersimpan = berikutnya;
      },
    ]);
  });

  /** Satu "render": hook dipanggil ulang supaya membaca state terbaru. */
  function useRenderSeret() {
    return useSeretProspek({ onUbahStatus, onBukaKonversi });
  }

  it("mengingat kartu yang diangkat", () => {
    useRenderSeret().mulaiSeret({ id: "p5", dari: "DIHUBUNGI" });

    expect(useRenderSeret().diangkat).toEqual({ id: "p5", dari: "DIHUBUNGI" });
  });

  it("menilai kolom tujuan terhadap kartu yang sedang diangkat", () => {
    useRenderSeret().mulaiSeret({ id: "p5", dari: "DIHUBUNGI" });
    const seret = useRenderSeret();

    expect(seret.tampilanKolom("TERTARIK")).toBe("tujuan");
    expect(seret.tampilanKolom("NEGOSIASI")).toBe("redup");
    expect(seret.tampilanKolom("DIHUBUNGI")).toBe("netral");
  });

  it("mengubah status dengan id, asal, dan tujuan yang benar", () => {
    // Asal ikut diteruskan: kolom asal wajib di-invalidate, dan hanya hook
    // ini yang masih tahu dari mana kartu diangkat.
    useRenderSeret().mulaiSeret({ id: "p5", dari: "DIHUBUNGI" });
    useRenderSeret().jatuhkan("TIDAK_LAYAK");

    expect(onUbahStatus).toHaveBeenCalledWith({
      prospekId: "p5",
      dari: "DIHUBUNGI",
      tujuan: "TIDAK_LAYAK",
    });
    expect(onBukaKonversi).not.toHaveBeenCalled();
  });

  it("membuka konversi alih-alih mengubah status saat dijatuhkan ke DEAL", () => {
    useRenderSeret().mulaiSeret({ id: "p8", dari: "NEGOSIASI" });
    useRenderSeret().jatuhkan("DEAL");

    expect(onBukaKonversi).toHaveBeenCalledWith("p8");
    expect(onUbahStatus).not.toHaveBeenCalled();
  });

  it("tidak memanggil apa pun saat dijatuhkan ke kolom tidak sah", () => {
    useRenderSeret().mulaiSeret({ id: "p5", dari: "BARU" });
    useRenderSeret().jatuhkan("NEGOSIASI");

    expect(onUbahStatus).not.toHaveBeenCalled();
    expect(onBukaKonversi).not.toHaveBeenCalled();
  });

  it("melepas kartu setelah dijatuhkan", () => {
    // Tanpa ini kolom tetap menyala/redup setelah seretan selesai, dan
    // jatuhan berikutnya tanpa mengangkat apa pun memindahkan kartu lama.
    useRenderSeret().mulaiSeret({ id: "p5", dari: "BARU" });
    useRenderSeret().jatuhkan("DIHUBUNGI");
    onUbahStatus.mockReset();

    expect(useRenderSeret().diangkat).toBeNull();
    useRenderSeret().jatuhkan("DIHUBUNGI");
    expect(onUbahStatus).not.toHaveBeenCalled();
  });

  it("melepas kartu saat seretan dibatalkan", () => {
    useRenderSeret().mulaiSeret({ id: "p5", dari: "BARU" });
    useRenderSeret().selesaiSeret();

    expect(useRenderSeret().diangkat).toBeNull();
  });
});
