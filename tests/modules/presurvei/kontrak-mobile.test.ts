import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import {
  catatKegiatanSchema,
  getStatusLanjutan,
  HASIL_PER_JENIS,
  isButuhDataTeknis,
  isButuhLokasi,
  isHasilMelahirkanProspek,
  KEGIATAN_HASIL,
  KEGIATAN_JENIS,
  labelHasilKegiatan,
  PROSPEK_STATUSES,
  ALAMAT_RENCANA_MAKS,
  ALASAN_BATAL_MAKS,
  ALASAN_BATAL_MIN,
  RENCANA_JENIS,
  RENCANA_STATUS_TAMPIL,
  RENCANA_SUMBER,
  TUJUAN_RENCANA_MAKS,
  type ProspekStatus,
} from "@/modules/presurvei";
import { resolveAksiKanban } from "@/modules/presurvei/client";

/**
 * Aplikasi mobile menyalin enum dan aturan presurvei sebagai fungsi murni
 * (tidak bisa mengimpor backend). Fixture ini satu-satunya titik temu: test
 * di sini memastikan fixture sama dengan backend, test mobile
 * (`__tests__/utils/presurvei/aturanPresurvei.test.ts`) memastikan mobile
 * sama dengan salinannya. Mengubah aturan backend membuat test ini merah —
 * perbarui fixture, lalu salin ke mobile.
 *
 * Urutan array dibandingkan apa adanya: mobile menampilkan pilihan dalam
 * urutan ini.
 */

interface KontrakMobile {
  kegiatanJenis: string[];
  kegiatanHasil: string[];
  prospekStatus: string[];
  transisiStatus: Record<string, string[]>;
  tujuanBukaKonversi: string[];
  jenisButuhLokasi: string[];
  jenisBerdataTeknis: string[];
  hasilMelahirkanProspek: string[];
  hasilPerJenis: Record<string, string[]>;
  labelHasilPerJenis: Record<string, Record<string, string>>;
  jumlahFotoMaks: number;
  kabelMeterMaks: number;
  rencanaJenis: string[];
  rencanaSumber: string[];
  rencanaStatusTampil: string[];
  tujuanRencanaMaks: number;
  alamatRencanaMaks: number;
  alasanBatalRencanaMin: number;
  alasanBatalRencanaMaks: number;
}

const kontrak = JSON.parse(
  readFileSync(
    path.resolve(process.cwd(), "tests/fixtures/presurvei/kontrak-mobile.json"),
    "utf8",
  ),
) as KontrakMobile;

const FOTO = "https://cdn.contoh.id/uploads/presurvei/kegiatan/a.webp";

const kegiatanTelepon = (fotoUrls: string[]) => ({
  jenis: "TELEPON",
  hasil: "TIDAK_MINAT",
  waktuMulai: new Date().toISOString(),
  fotoUrls,
});

const surveiDenganKabel = (estimasiKabelMeter: number) => ({
  jenis: "SURVEI_LOKASI",
  hasil: "PERLU_FOLLOWUP",
  waktuMulai: new Date().toISOString(),
  latitude: -6.2,
  longitude: 106.8,
  estimasiKabelMeter,
});

describe("kontrak presurvei untuk mobile", () => {
  it("enum sama dan berurutan sama dengan domain", () => {
    expect(kontrak.kegiatanJenis).toEqual([...KEGIATAN_JENIS]);
    expect(kontrak.kegiatanHasil).toEqual([...KEGIATAN_HASIL]);
    expect(kontrak.prospekStatus).toEqual([...PROSPEK_STATUSES]);
  });

  it("enum dan batas rencana kunjungan sama dengan domain", () => {
    expect(kontrak.rencanaJenis).toEqual([...RENCANA_JENIS]);
    expect(kontrak.rencanaSumber).toEqual([...RENCANA_SUMBER]);
    expect(kontrak.rencanaStatusTampil).toEqual([...RENCANA_STATUS_TAMPIL]);
    expect(kontrak.tujuanRencanaMaks).toBe(TUJUAN_RENCANA_MAKS);
    expect(kontrak.alamatRencanaMaks).toBe(ALAMAT_RENCANA_MAKS);
    expect(kontrak.alasanBatalRencanaMin).toBe(ALASAN_BATAL_MIN);
    expect(kontrak.alasanBatalRencanaMaks).toBe(ALASAN_BATAL_MAKS);
  });

  it("tabel transisi sama dengan getStatusLanjutan untuk setiap status", () => {
    expect(Object.keys(kontrak.transisiStatus)).toEqual([...PROSPEK_STATUSES]);
    for (const status of PROSPEK_STATUSES) {
      expect(kontrak.transisiStatus[status]).toEqual(getStatusLanjutan(status));
    }
  });

  it("tujuan yang membuka form konversi sama dengan resolveAksiKanban", () => {
    const tujuan = new Set<ProspekStatus>();
    for (const dari of PROSPEK_STATUSES) {
      for (const ke of PROSPEK_STATUSES) {
        if (resolveAksiKanban(dari, ke)?.jenis === "buka-konversi")
          tujuan.add(ke);
      }
    }
    expect(kontrak.tujuanBukaKonversi).toEqual([...tujuan]);
  });

  it("aturan jenis dan hasil sama dengan kegiatan-rules", () => {
    expect(kontrak.jenisButuhLokasi).toEqual(
      KEGIATAN_JENIS.filter(isButuhLokasi),
    );
    expect(kontrak.jenisBerdataTeknis).toEqual(
      KEGIATAN_JENIS.filter(isButuhDataTeknis),
    );
    expect(kontrak.hasilMelahirkanProspek).toEqual(
      KEGIATAN_HASIL.filter(isHasilMelahirkanProspek),
    );
  });

  it("jumlah foto maksimum sama dengan yang ditegakkan schema", () => {
    const pas = Array.from({ length: kontrak.jumlahFotoMaks }, () => FOTO);
    expect(catatKegiatanSchema.safeParse(kegiatanTelepon(pas)).success).toBe(
      true,
    );
    expect(
      catatKegiatanSchema.safeParse(kegiatanTelepon([...pas, FOTO])).success,
    ).toBe(false);
  });

  it("estimasi kabel maksimum sama dengan yang ditegakkan schema", () => {
    expect(
      catatKegiatanSchema.safeParse(surveiDenganKabel(kontrak.kabelMeterMaks))
        .success,
    ).toBe(true);
    expect(
      catatKegiatanSchema.safeParse(
        surveiDenganKabel(kontrak.kabelMeterMaks + 1),
      ).success,
    ).toBe(false);
  });

  it("hasil per jenis kegiatan beserta labelnya", () => {
    expect(kontrak.hasilPerJenis).toEqual(
      Object.fromEntries(KEGIATAN_JENIS.map((jenis) => [jenis, [...HASIL_PER_JENIS[jenis]]])),
    );
    expect(kontrak.labelHasilPerJenis).toEqual(
      Object.fromEntries(
        KEGIATAN_JENIS.map((jenis) => [
          jenis,
          Object.fromEntries(HASIL_PER_JENIS[jenis].map((hasil) => [hasil, labelHasilKegiatan(hasil, jenis)])),
        ]),
      ),
    );
  });
});
