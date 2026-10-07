import { describe, expect, it } from "vitest";

import { catalogOf } from "@/modules/regulatory/domain/license-schemes";

/**
 * Kunci katalog terhadap isi formulir resmi Komdigi.
 *
 * Angka dan redaksi di bawah disalin dari draf resmi yang diunduh dari folder
 * Komdigi (`Draft Self Assessment Jartaplok-PS.docx` dan `Draft Self Assessment
 * Layanan Akses Internet (ISP).docx`). Formulirnya tidak ada di repositori, jadi
 * salinan inilah pembandingnya: bila katalog bergeser tanpa dasar, test gagal.
 *
 * Perbedaan yang paling mudah luput dan karena itu ditulis utuh di sini:
 * blok Seluler dan Jartaplok pada formulir ISP memakai redaksi pasang baru yang
 * berbeda, dan tolok ukur keluhannya pun berbeda (2% vs 5%).
 */

const FORMULIR = {
  JARTAPLOK_PS: {
    UTAMA: [
      ["Persentase packet loss (Drop Rate)", "≤ 5 %"],
      ["Persentase Network Latency ≤ 250 mdet", "≥ 90%"],
      ["Presentase network availability", "≥ 99%"],
      [
        "Persentase pemenuhan pasang baru yang dipenuhi dalam waktu ≤7 hari kalender sejak disetujui",
        "≥ 90%",
      ],
      [
        "Presentase penyelesaian permohonan pemulihan layanan dalam waktu ≤2 hari kerja",
        "≥ 90%",
      ],
      [
        "Persentase penyelesaian keluhan pelanggan dalam waktu ≤3 hari kerja",
        "≥ 90%",
      ],
    ],
  },
  ISP: {
    SELULER: [
      ["Persentase packet loss (Drop Rate)", "≤ 5 %"],
      ["Persentase Network Latency ≤ 250 mdet", "≥ 90%"],
      ["Persentase Download Successful Rate", "≥ 80%"],
      ["Persentase Upload Successful Rate", "≥ 75%"],
      [
        "Persentase pemenuhan pasang baru yang dipenuhi dalam waktu ≤7 hari kalender sejak disetujui",
        "≥ 95%",
      ],
      [
        "Persentase keluhan atas akurasi tagihan dari jumlah seluruh tagihan bulan tersebut",
        "≤ 2 %",
      ],
      [
        "Persentase penyelesaian keluhan atas akurasi tagihan pascabayar yang diselesaikan dalam 15 (lima belas) hari kerja",
        "≥ 90%",
      ],
      [
        "Persentase penyelesaian keluhan atas akurasi pemotongan Deposit Prabayar yang diselesaikan dalam 15 (lima belas) hari kerja",
        "≥ 90%",
      ],
      ["Persentase keluhan umum pengguna yang diselesaikan", "≥ 95%"],
      [
        "Persentase laporan gangguan layanan dari jumlah pengguna dalam jangka waktu 12 (dua belas) bulan",
        "≤ 2 %",
      ],
      [
        "Persentase kecepatan jawab kontak layanan informasi terhadap panggilan pengguna dalam waktu 30 (tiga puluh) detik",
        "≥ 90%",
      ],
      [
        "Persentase Kecepatan Jawab Kontak Layanan Informasi terhadap email pengguna dalam waktu 3x24 jam",
        "≥ 90%",
      ],
      [
        "Persentase pemenuhan permohonan aktivasi paket data dalam waktu 15 (lima belas) menit",
        "≥ 90%",
      ],
    ],
    JARTAPLOK_PS: [
      ["Persentase packet loss (Drop Rate)", "≤ 5 %"],
      ["Persentase Network Latency ≤ 250 mdet", "≥ 90%"],
      ["Presentase network availability", "≥ 99%"],
      [
        "Persentase pemenuhan pasang baru dalam waktu 7 (tujuh) hari kalender",
        "≥ 95%",
      ],
      [
        "Persentase keluhan atas akurasi tagihan dari jumlah seluruh tagihan bulan tersebut",
        "≤ 5 %",
      ],
      ["Persentase keluhan umum pengguna yang diselesaikan", "≥ 95%"],
      [
        "Persentase laporan gangguan layanan dari jumlah pengguna dalam jangka waktu 12 (dua belas) bulan",
        "≤ 5 %",
      ],
      [
        "Persentase kecepatan jawab kontak layanan informasi terhadap panggilan pengguna dalam waktu 30 (tiga puluh) detik",
        "≥ 90%",
      ],
      [
        "Persentase Kecepatan Jawab Kontak Layanan Informasi terhadap email pengguna dalam waktu 3x24 jam",
        "≥ 90%",
      ],
    ],
  },
} as const;

const rapikan = (teks: string) => teks.replace(/\s+/g, " ").trim();

describe.each([
  ["JARTAPLOK_PS", FORMULIR.JARTAPLOK_PS],
  ["ISP", FORMULIR.ISP],
] as const)("katalog %s sama dengan formulir resmi", (skema, blokFormulir) => {
  const katalog = catalogOf(skema as "JARTAPLOK_PS" | "ISP");

  it("blok yang sama, berurutan sama", () => {
    expect(katalog.blocks.map((b) => b.key)).toEqual(Object.keys(blokFormulir));
  });

  const entri = Object.entries(blokFormulir) as [
    string,
    readonly (readonly [string, string])[],
  ][];

  it.each(entri)("blok %s: judul dan tolok ukur persis", (kunciBlok, baris) => {
    const blok = katalog.blocks.find((b) => b.key === kunciBlok);
    expect(blok).toBeDefined();

    const katalogBaris = [...blok!.network, ...blok!.nonNetwork].map((p) => [
      rapikan(p.title),
      rapikan(p.targetLabel),
    ]);
    expect(katalogBaris).toEqual(
      baris.map(([judul, tolok]) => [rapikan(judul), rapikan(tolok)]),
    );
  });
});
