import { describe, expect, it } from "vitest";

import {
  catatanStatusRencana,
  isRencanaTerbuka,
  lebarBilahRealisasi,
  RENCANA_STATUS_TAMPIL_CONFIG,
  RENCANA_SUMBER_CONFIG,
  tautanPeta,
  TEKS_TANPA_PERSEN,
  TEKS_TERLAMBAT,
  teksNama,
  teksPembuatRencana,
  teksPersenRealisasi,
} from "@/app/admin/presurvei/rencana/tampilanRencana";
import { RENCANA_STATUS_TAMPIL } from "@/modules/presurvei/client";

describe("badge status rencana", () => {
  it("setiap status tampil punya label dan warna", () => {
    for (const status of RENCANA_STATUS_TAMPIL) {
      expect(RENCANA_STATUS_TAMPIL_CONFIG[status].label.length).toBeGreaterThan(
        0,
      );
    }
  });

  it("memakai warna yang disepakati: terlewat merah, direncanakan biru, selesai hijau, batal abu", () => {
    expect(RENCANA_STATUS_TAMPIL_CONFIG.TERLEWAT.warna).toContain("red");
    expect(RENCANA_STATUS_TAMPIL_CONFIG.DIRENCANAKAN.warna).toContain("blue");
    expect(RENCANA_STATUS_TAMPIL_CONFIG.SELESAI.warna).toContain("emerald");
    expect(RENCANA_STATUS_TAMPIL_CONFIG.BATAL.warna).toContain("gray");
  });

  it("catatan terlambat hanya untuk SELESAI yang terlambat", () => {
    expect(
      catatanStatusRencana({ statusTampil: "SELESAI", isTerlambat: true }),
    ).toBe(TEKS_TERLAMBAT);
    expect(
      catatanStatusRencana({ statusTampil: "SELESAI", isTerlambat: false }),
    ).toBeNull();
    // `isTerlambat` hanya bermakna untuk rencana yang sudah dilaporkan.
    expect(
      catatanStatusRencana({ statusTampil: "BATAL", isTerlambat: true }),
    ).toBeNull();
  });

  it("rencana terbuka: direncanakan dan terlewat, bukan selesai/batal", () => {
    expect(isRencanaTerbuka("DIRENCANAKAN")).toBe(true);
    expect(isRencanaTerbuka("TERLEWAT")).toBe(true);
    expect(isRencanaTerbuka("SELESAI")).toBe(false);
    expect(isRencanaTerbuka("BATAL")).toBe(false);
  });
});

describe("sumber rencana", () => {
  it("label Mandiri dan Penugasan", () => {
    expect(RENCANA_SUMBER_CONFIG.MANDIRI.label).toBe("Mandiri");
    expect(RENCANA_SUMBER_CONFIG.PENUGASAN.label).toBe("Penugasan");
  });

  it("nama pembuat hanya untuk penugasan", () => {
    expect(
      teksPembuatRencana({ sumber: "PENUGASAN", namaPembuat: "Bu Rina" }),
    ).toBe("oleh Bu Rina");
    expect(
      teksPembuatRencana({ sumber: "MANDIRI", namaPembuat: "Budi" }),
    ).toBeNull();
  });

  it("nama null diganti label netral", () => {
    expect(teksNama(null)).toBe("Tanpa nama");
    expect(teksPembuatRencana({ sumber: "PENUGASAN", namaPembuat: null })).toBe(
      "oleh Tanpa nama",
    );
  });
});

describe("realisasi & peta", () => {
  it("persen null tampil sebagai tanda pisah, nol tetap 0%", () => {
    expect(teksPersenRealisasi(null)).toBe(TEKS_TANPA_PERSEN);
    expect(teksPersenRealisasi(0)).toBe("0%");
    expect(teksPersenRealisasi(75)).toBe("75%");
  });

  it("lebar bilah dijepit 0–100", () => {
    expect(lebarBilahRealisasi(null)).toBe(0);
    expect(lebarBilahRealisasi(40)).toBe(40);
    expect(lebarBilahRealisasi(140)).toBe(100);
    expect(lebarBilahRealisasi(-5)).toBe(0);
  });

  it("tautan peta memakai lat,lng dan menerima lintang 0", () => {
    expect(tautanPeta(-6.2, 106.8)).toBe(
      "https://maps.google.com/?q=-6.2,106.8",
    );
    expect(tautanPeta(0, 106.8)).toBe("https://maps.google.com/?q=0,106.8");
    expect(tautanPeta(null, 106.8)).toBeNull();
  });
});
