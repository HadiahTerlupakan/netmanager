import { describe, expect, it } from "vitest";

/**
 * Jejak audit kegiatan hanya bernilai bila isinya jujur: medan yang tidak
 * berubah tidak boleh tercatat sebagai perubahan, dan `dari`/`ke` tidak boleh
 * tertukar. Nilai tiap medan sengaja berbeda supaya pertukaran terlihat.
 */

import {
  hitungPerubahanKegiatan,
  isTanpaPerubahan,
  nilaiBaruDariPerubahan,
  type NilaiKegiatanDapatDiubah,
} from "@/modules/presurvei/domain/kegiatan-perubahan";

const lama: NilaiKegiatanDapatDiubah = Object.freeze({
  catatan: "Catatan lama",
  ditemuiNama: "Bu Rina",
  hasil: "TERTARIK",
});

describe("hitungPerubahanKegiatan", () => {
  it("mencatat hanya medan yang benar-benar berubah", () => {
    const perubahan = hitungPerubahanKegiatan(lama, {
      catatan: "Catatan baru",
      ditemuiNama: "Bu Rina",
      hasil: "TERTARIK",
    });

    expect(perubahan).toEqual({
      catatan: { dari: "Catatan lama", ke: "Catatan baru" },
    });
  });

  it("mengabaikan medan yang tidak dikirim", () => {
    expect(hitungPerubahanKegiatan(lama, { hasil: "DEAL" })).toEqual({
      hasil: { dari: "TERTARIK", ke: "DEAL" },
    });
  });

  it("mencatat pengosongan ke null sebagai perubahan", () => {
    expect(hitungPerubahanKegiatan(lama, { ditemuiNama: null })).toEqual({
      ditemuiNama: { dari: "Bu Rina", ke: null },
    });
  });

  it("mencatat pengisian dari null", () => {
    const perubahan = hitungPerubahanKegiatan(
      { ...lama, catatan: null },
      { catatan: "Baru diisi" },
    );

    expect(perubahan).toEqual({ catatan: { dari: null, ke: "Baru diisi" } });
  });

  it("menganggap string kosong berbeda dari null", () => {
    // `""` dan `null` sama-sama falsy; perbandingan truthiness akan
    // menyembunyikan perubahan ini dari jejak audit.
    const perubahan = hitungPerubahanKegiatan(
      { ...lama, catatan: "" },
      { catatan: null },
    );

    expect(perubahan).toEqual({ catatan: { dari: "", ke: null } });
  });

  it("mencatat ketiga medan sekaligus bila semuanya berubah", () => {
    expect(
      hitungPerubahanKegiatan(lama, {
        catatan: "C2",
        ditemuiNama: "Pak Joko",
        hasil: "DEAL",
      }),
    ).toEqual({
      catatan: { dari: "Catatan lama", ke: "C2" },
      ditemuiNama: { dari: "Bu Rina", ke: "Pak Joko" },
      hasil: { dari: "TERTARIK", ke: "DEAL" },
    });
  });

  it("mengembalikan objek kosong bila tidak ada yang berubah", () => {
    expect(hitungPerubahanKegiatan(lama, { ...lama })).toEqual({});
  });
});

describe("isTanpaPerubahan", () => {
  it("benar hanya untuk perubahan kosong", () => {
    expect(isTanpaPerubahan({})).toBe(true);
    expect(isTanpaPerubahan({ hasil: { dari: "TERTARIK", ke: "DEAL" } })).toBe(
      false,
    );
  });
});

describe("nilaiBaruDariPerubahan", () => {
  it("mengambil nilai `ke`, bukan `dari`", () => {
    expect(
      nilaiBaruDariPerubahan({
        catatan: { dari: "Lama", ke: "Baru" },
        hasil: { dari: "TERTARIK", ke: "DEAL" },
      }),
    ).toEqual({ catatan: "Baru", hasil: "DEAL" });
  });

  it("mempertahankan null sebagai nilai baru yang sah", () => {
    expect(
      nilaiBaruDariPerubahan({ ditemuiNama: { dari: "Bu Rina", ke: null } }),
    ).toEqual({ ditemuiNama: null });
  });
});
