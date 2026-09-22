import { describe, expect, it } from "vitest";

/**
 * Jenis kegiatan menentukan kolom mana yang masuk akal terisi. Tanpa aturan
 * terpusat, kegiatan TELEPON bisa menyimpan estimasi kabel dan laporan lapangan
 * jadi tidak bisa dipercaya.
 */

import {
  isButuhDataTeknis,
  isButuhIklan,
  isButuhLokasi,
  isHasilMelahirkanProspek,
} from "@/modules/presurvei/domain/kegiatan-rules";

describe("isButuhLokasi", () => {
  it("menuntut lokasi untuk kegiatan yang terjadi di lapangan", () => {
    expect(isButuhLokasi("KUNJUNGAN")).toBe(true);
    expect(isButuhLokasi("SURVEI_LOKASI")).toBe(true);
  });

  it("tidak menuntut lokasi untuk kegiatan jarak jauh", () => {
    expect(isButuhLokasi("TELEPON")).toBe(false);
    expect(isButuhLokasi("CHAT")).toBe(false);
    expect(isButuhLokasi("IKLAN")).toBe(false);
  });
});

describe("isButuhDataTeknis", () => {
  it("hanya survei lokasi yang membawa data teknis", () => {
    expect(isButuhDataTeknis("SURVEI_LOKASI")).toBe(true);
    expect(isButuhDataTeknis("KUNJUNGAN")).toBe(false);
    expect(isButuhDataTeknis("TELEPON")).toBe(false);
  });
});

describe("isButuhIklan", () => {
  it("hanya kegiatan iklan yang menunjuk ke sebuah iklan", () => {
    expect(isButuhIklan("IKLAN")).toBe(true);
    expect(isButuhIklan("KUNJUNGAN")).toBe(false);
  });
});

describe("isHasilMelahirkanProspek", () => {
  it("menganggap minat nyata sebagai prospek", () => {
    expect(isHasilMelahirkanProspek("TERTARIK")).toBe(true);
    expect(isHasilMelahirkanProspek("DEAL")).toBe(true);
  });

  it("tidak melahirkan prospek dari kunjungan yang belum membuahkan minat", () => {
    expect(isHasilMelahirkanProspek("PERLU_FOLLOWUP")).toBe(false);
    expect(isHasilMelahirkanProspek("TIDAK_MINAT")).toBe(false);
    expect(isHasilMelahirkanProspek("TIDAK_ADA_ORANG")).toBe(false);
  });
});
