import { describe, expect, it } from "vitest";

/**
 * Jenis kegiatan menentukan kolom mana yang masuk akal terisi. Tanpa aturan
 * terpusat, kegiatan TELEPON bisa menyimpan estimasi kabel dan laporan lapangan
 * jadi tidak bisa dipercaya.
 */

import {
  daftarHasilSekelompok,
  isButuhDataTeknis,
  isButuhIklan,
  isButuhLokasi,
  isHasilMelahirkanProspek,
  isPerubahanHasilSah,
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

describe("isPerubahanHasilSah", () => {
  // Jalur ubah tidak menjalankan efek samping catat (melahirkan prospek), jadi
  // hasil tidak boleh melintasi batas `isHasilMelahirkanProspek`.
  it("membolehkan perubahan di dalam kelompok berminat", () => {
    expect(isPerubahanHasilSah("TERTARIK", "DEAL")).toBe(true);
    expect(isPerubahanHasilSah("DEAL", "TERTARIK")).toBe(true);
  });

  it("membolehkan perubahan di dalam kelompok belum berminat", () => {
    expect(isPerubahanHasilSah("PERLU_FOLLOWUP", "TIDAK_MINAT")).toBe(true);
    expect(isPerubahanHasilSah("TIDAK_ADA_ORANG", "PERLU_FOLLOWUP")).toBe(true);
  });

  it("menolak perubahan dari berminat ke belum berminat", () => {
    expect(isPerubahanHasilSah("TERTARIK", "PERLU_FOLLOWUP")).toBe(false);
    expect(isPerubahanHasilSah("DEAL", "TIDAK_MINAT")).toBe(false);
  });

  it("menolak perubahan dari belum berminat ke berminat", () => {
    expect(isPerubahanHasilSah("PERLU_FOLLOWUP", "TERTARIK")).toBe(false);
    expect(isPerubahanHasilSah("TIDAK_ADA_ORANG", "DEAL")).toBe(false);
  });

  it("selalu membolehkan hasil yang sama", () => {
    expect(isPerubahanHasilSah("DEAL", "DEAL")).toBe(true);
    expect(isPerubahanHasilSah("TIDAK_MINAT", "TIDAK_MINAT")).toBe(true);
  });
});

describe("daftarHasilSekelompok", () => {
  it("menawarkan hanya hasil berminat untuk kegiatan berminat", () => {
    expect(daftarHasilSekelompok("TERTARIK")).toEqual(["TERTARIK", "DEAL"]);
  });

  it("menawarkan hanya hasil belum berminat untuk kegiatan belum berminat", () => {
    expect(daftarHasilSekelompok("TIDAK_MINAT")).toEqual([
      "PERLU_FOLLOWUP",
      "TIDAK_MINAT",
      "TIDAK_ADA_ORANG",
    ]);
  });

  it("mengembalikan salinan baru, bukan tabel modul", () => {
    // Pemanggil yang meng-sort hasilnya tidak boleh merusak panggilan berikut.
    daftarHasilSekelompok("TERTARIK").reverse();
    expect(daftarHasilSekelompok("TERTARIK")).toEqual(["TERTARIK", "DEAL"]);
  });
});
