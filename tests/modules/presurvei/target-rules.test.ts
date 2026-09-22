import { describe, expect, it } from "vitest";

/**
 * Pencapaian dipakai untuk bilah progres dan peringkat sales, jadi pembagian
 * dengan target nol harus punya jawaban yang disepakati — bukan Infinity atau
 * NaN yang merusak tampilan dan pengurutan.
 */

import { hitungPencapaian } from "@/modules/presurvei/domain/target-rules";

const target = {
  targetKunjungan: 20,
  targetProspek: 10,
  targetKonversi: 5,
};

describe("hitungPencapaian", () => {
  it("menghitung persentase tiap jenis target", () => {
    const hasil = hitungPencapaian(target, {
      kunjungan: 10,
      prospek: 5,
      konversi: 1,
    });

    expect(hasil.kunjungan.persen).toBe(50);
    expect(hasil.prospek.persen).toBe(50);
    expect(hasil.konversi.persen).toBe(20);
  });

  it("membatasi persentase pada 100 untuk keperluan tampilan", () => {
    const hasil = hitungPencapaian(target, {
      kunjungan: 40,
      prospek: 0,
      konversi: 0,
    });

    expect(hasil.kunjungan.persen).toBe(100);
  });

  it("tetap melaporkan jumlah sebenarnya meski persentasenya dibatasi", () => {
    // Bilah progres berhenti di 100%, tapi manajer perlu melihat 40 kunjungan.
    const hasil = hitungPencapaian(target, {
      kunjungan: 40,
      prospek: 0,
      konversi: 0,
    });

    expect(hasil.kunjungan.tercapai).toBe(40);
    expect(hasil.kunjungan.target).toBe(20);
  });

  it("menganggap target nol sebagai sudah tercapai penuh", () => {
    // Tidak ada target berarti tidak ada yang gagal dicapai. Mengembalikan
    // Infinity atau NaN akan merusak pengurutan peringkat sales.
    const hasil = hitungPencapaian(
      { targetKunjungan: 0, targetProspek: 0, targetKonversi: 0 },
      { kunjungan: 0, prospek: 0, konversi: 0 },
    );

    expect(hasil.kunjungan.persen).toBe(100);
    expect(hasil.prospek.persen).toBe(100);
    expect(hasil.konversi.persen).toBe(100);
  });

  it("melaporkan nol persen saat target ada tapi belum ada realisasi", () => {
    const hasil = hitungPencapaian(target, {
      kunjungan: 0,
      prospek: 0,
      konversi: 0,
    });

    expect(hasil.kunjungan.persen).toBe(0);
  });

  it("membulatkan persentase ke bilangan bulat", () => {
    const hasil = hitungPencapaian(target, {
      kunjungan: 7,
      prospek: 0,
      konversi: 0,
    });

    expect(hasil.kunjungan.persen).toBe(35);
  });
});
