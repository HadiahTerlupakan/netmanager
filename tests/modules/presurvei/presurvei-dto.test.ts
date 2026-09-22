import { describe, expect, it } from "vitest";

/**
 * DTO adalah batas antara domain dan klien. Tanggal harus keluar sebagai ISO
 * string, dan kesiapan promosi dihitung di sini supaya UI tidak menyalin ulang
 * aturan domain dan berisiko berbeda pendapat dengan server.
 */

import {
  toProspekDetail,
  toProspekListItem,
} from "@/modules/presurvei/dto/prospek.dto";
import { toKegiatanDetail } from "@/modules/presurvei/dto/kegiatan.dto";
import type { ProspekEntity } from "@/modules/presurvei/domain/entities/Prospek";
import type { KegiatanEntity } from "@/modules/presurvei/domain/entities/Kegiatan";

const WAKTU = new Date("2026-09-22T01:00:00.000Z");

const prospek = (over: Partial<ProspekEntity> = {}): ProspekEntity =>
  ({
    id: "prospek-1",
    nama: "Budi",
    noTelp: "081234567890",
    email: null,
    alamat: "Jl. Merdeka 10",
    latitude: null,
    longitude: null,
    shareloc: null,
    sumber: "LAPANGAN",
    iklanId: null,
    registrationId: null,
    referralNama: null,
    status: "BARU",
    pemilikId: "user-1",
    paketDiminati: null,
    catatan: null,
    canvasingId: null,
    konversiAt: null,
    siteId: null,
    tenantId: "tenant-1",
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...over,
  }) as ProspekEntity;

const kegiatan = (over: Partial<KegiatanEntity> = {}): KegiatanEntity =>
  ({
    id: "kegiatan-1",
    jenis: "KUNJUNGAN",
    userId: "user-1",
    prospekId: null,
    iklanId: null,
    waktuMulai: WAKTU,
    waktuSelesai: null,
    latitude: -6.2,
    longitude: 106.8,
    alamatDikunjungi: "Jl. Merdeka 10",
    ditemuiNama: "Budi",
    hasil: "TERTARIK",
    catatan: null,
    fotoUrls: ["https://contoh.id/a.webp", "https://contoh.id/b.webp"],
    odpTerdekat: null,
    estimasiKabelMeter: null,
    catatanTeknis: null,
    siteId: null,
    tenantId: "tenant-1",
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...over,
  }) as KegiatanEntity;

describe("toProspekListItem", () => {
  it("mengubah tanggal menjadi ISO string", () => {
    expect(toProspekListItem(prospek()).createdAt).toBe(
      "2026-09-22T01:00:00.000Z",
    );
  });
});

describe("toProspekDetail", () => {
  it("menandai prospek DEAL berdata lengkap sebagai siap dipromosikan", () => {
    expect(
      toProspekDetail(prospek({ status: "DEAL" })).isSiapDipromosikan,
    ).toBe(true);
  });

  it("tidak menandai prospek yang belum DEAL", () => {
    expect(toProspekDetail(prospek()).isSiapDipromosikan).toBe(false);
  });
});

describe("toKegiatanDetail", () => {
  it("menghitung jumlah foto tanpa membocorkan urutan penyimpanan", () => {
    expect(toKegiatanDetail(kegiatan()).jumlahFoto).toBe(2);
  });

  it("mengosongkan blok data teknis untuk kegiatan bukan survei", () => {
    expect(toKegiatanDetail(kegiatan()).dataTeknis).toBeNull();
  });

  it("mengisi blok data teknis untuk survei lokasi", () => {
    const hasil = toKegiatanDetail(
      kegiatan({
        jenis: "SURVEI_LOKASI",
        odpTerdekat: "ODP-12",
        estimasiKabelMeter: 120,
      }),
    );

    expect(hasil.dataTeknis).toMatchObject({
      odpTerdekat: "ODP-12",
      estimasiKabelMeter: 120,
    });
  });
});
