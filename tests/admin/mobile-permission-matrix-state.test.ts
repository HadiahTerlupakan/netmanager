import { describe, expect, it } from "vitest";
import { PERMISSION_GROUPS_MOBILE } from "@/lib/permission-config";
import {
  getKunciKelompokMobile,
  getPeringatanMatriksMobile,
  pilahKelompokMobile,
} from "@/app/admin/settings/roles/[id]/mobile-permission-matrix-state";
import { PERSONA_KARYAWAN } from "@/modules/roles/client";

/** Pemilahan matriks Mobile App di form role menurut persona terpilih. */

describe("pilahKelompokMobile", () => {
  it("teknisi memakai seluruh kelompok; tidak ada bagian terlipat", () => {
    const { relevan, tidakRelevan } = pilahKelompokMobile("TEKNISI");
    expect(relevan.map((k) => k.groupName)).toEqual(
      Object.keys(PERMISSION_GROUPS_MOBILE),
    );
    expect(tidakRelevan).toEqual([]);
  });

  it("sales: Kehadiran terbelah — Lembur pindah ke bagian tak tampil", () => {
    const { relevan, tidakRelevan } = pilahKelompokMobile("SALES");
    expect(relevan.find((k) => k.groupName === "KEHADIRAN")?.resources).toEqual(
      ["m_absensi", "m_izin", "m_holidays"],
    );
    expect(
      tidakRelevan.find((k) => k.groupName === "KEHADIRAN")?.resources,
    ).toEqual(["m_lembur"]);
    expect(tidakRelevan.map((k) => k.groupName)).toEqual(
      expect.arrayContaining(["BERANDA", "INVENTORY", "NETWORK", "PELANGGAN"]),
    );
  });

  it("tiap resource muncul tepat sekali di salah satu bagian", () => {
    const semua = Object.values(PERMISSION_GROUPS_MOBILE).flat().sort();
    for (const persona of PERSONA_KARYAWAN) {
      const { relevan, tidakRelevan } = pilahKelompokMobile(persona);
      const terpilah = [...relevan, ...tidakRelevan]
        .flatMap((k) => k.resources)
        .sort();
      expect(terpilah).toEqual(semua);
    }
  });
});

describe("getPeringatanMatriksMobile", () => {
  it("menghitung izin tak terlihat dan izin inti hilang", () => {
    const peringatan = getPeringatanMatriksMobile("TEKNISI", [
      "m_dashboard:read",
      "m_absensi:read",
    ]);
    expect(peringatan.izinTakTerlihat).toEqual([]);
    expect(peringatan.peringatanIntiHilang).toEqual([
      "Tampilan Teknisi tanpa izin Work Order: Beranda teknisi akan kosong.",
    ]);

    const staff = getPeringatanMatriksMobile("STAFF", [
      "m_dashboard:read",
      "m_absensi:read",
      "m_work_order:read",
      "m_barang:read",
    ]);
    expect(staff.izinTakTerlihat).toEqual(["m_work_order:read", "m_barang:read"]);
    expect(staff.peringatanIntiHilang).toEqual([]);
  });
});

describe("getKunciKelompokMobile", () => {
  it("bagian relevan memakai kunci lama; bagian terlipat kunci terpisah", () => {
    expect(getKunciKelompokMobile("KEHADIRAN", true)).toBe("employee-KEHADIRAN");
    expect(getKunciKelompokMobile("KEHADIRAN", false)).not.toBe(
      getKunciKelompokMobile("KEHADIRAN", true),
    );
  });
});
