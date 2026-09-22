import { describe, expect, it } from "vitest";

/**
 * `isAktif` menyatakan niat pemilik iklan, `isBerjalan` menyatakan kenyataannya.
 * Keduanya sengaja dikirim terpisah supaya UI bisa membedakan "dimatikan" dari
 * "sudah lewat" — dua hal yang butuh tindakan berbeda.
 */

import {
  toIklanDetail,
  toIklanListItem,
} from "@/modules/presurvei/dto/iklan.dto";
import type { IklanEntity } from "@/modules/presurvei/domain/entities/Iklan";

const LAMPAU = new Date("2020-01-01T00:00:00.000Z");

const iklan = (over: Partial<IklanEntity> = {}): IklanEntity =>
  ({
    id: "iklan-1",
    nama: "Promo Ramadan",
    kode: "promo-ramadan",
    channel: "META",
    tanggalMulai: LAMPAU,
    tanggalSelesai: null,
    biaya: null,
    penanggungJawabId: null,
    isAktif: true,
    tenantId: "tenant-1",
    createdAt: LAMPAU,
    updatedAt: LAMPAU,
    ...over,
  }) as IklanEntity;

describe("toIklanListItem", () => {
  it("mengubah tanggal menjadi ISO string", () => {
    expect(toIklanListItem(iklan()).tanggalMulai).toBe(
      "2020-01-01T00:00:00.000Z",
    );
  });

  it("mengembalikan null untuk tanggal selesai yang kosong", () => {
    expect(toIklanListItem(iklan()).tanggalSelesai).toBeNull();
  });

  it("menandai iklan yang sudah lewat sebagai tidak berjalan meski penandanya aktif", () => {
    const hasil = toIklanListItem(
      iklan({ tanggalSelesai: new Date("2020-02-01T00:00:00.000Z") }),
    );

    expect(hasil.isAktif).toBe(true);
    expect(hasil.isBerjalan).toBe(false);
  });

  it("menandai iklan berjalan saat aktif dan tanggalnya masih berlaku", () => {
    expect(toIklanListItem(iklan()).isBerjalan).toBe(true);
  });

  it("membawa field penanda dari entitas tanpa tertukar", () => {
    // `id` dan `kode` sama-sama string, jadi tertukarnya tidak akan ditolak
    // compiler maupun test yang hanya memeriksa tanggal dan penanda. Padahal
    // `kode` adalah kunci pencocokan utm_campaign: tertukar dengan `id`,
    // seluruh atribusi iklan meleset tanpa satu pun gejala di permukaan.
    expect(toIklanListItem(iklan())).toMatchObject({
      id: "iklan-1",
      nama: "Promo Ramadan",
      kode: "promo-ramadan",
      channel: "META",
    });
  });
});

describe("toIklanDetail", () => {
  it("menyertakan biaya dan penanggung jawab", () => {
    const hasil = toIklanDetail(
      iklan({ biaya: 1500000.5, penanggungJawabId: "user-1" }),
    );

    expect(hasil.biaya).toBe(1500000.5);
    expect(hasil.penanggungJawabId).toBe("user-1");
  });

  it("mempertahankan biaya nol, bukan mengubahnya jadi null", () => {
    // Kampanye berbiaya nol itu wajar — organik, atau anggarannya belum diisi.
    expect(toIklanDetail(iklan({ biaya: 0 })).biaya).toBe(0);
  });

  it("membawa field penanda dan jejak waktu dari entitas tanpa tertukar", () => {
    expect(toIklanDetail(iklan())).toMatchObject({
      id: "iklan-1",
      nama: "Promo Ramadan",
      kode: "promo-ramadan",
      channel: "META",
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
  });
});
