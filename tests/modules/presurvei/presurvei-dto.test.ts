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
import {
  toKegiatanDetail,
  toKegiatanListItem,
} from "@/modules/presurvei/dto/kegiatan.dto";
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

describe("toKegiatanListItem", () => {
  it("menyertakan koordinat supaya peta tidak perlu mengambil detail per baris", () => {
    // Nilai lintang dan bujur sengaja dibuat berjauhan: keduanya `number`
    // bersebelahan, dan tertukarnya tidak akan ditolak compiler — penanda
    // peta akan mendarat di belahan bumi yang salah tanpa satu pun keluhan.
    const hasil = toKegiatanListItem(
      kegiatan({ latitude: -6.2, longitude: 106.8 }),
    );

    expect(hasil.latitude).toBe(-6.2);
    expect(hasil.longitude).toBe(106.8);
  });

  it("meneruskan koordinat kosong apa adanya", () => {
    // Kegiatan telepon, chat, dan walk-in kantor tidak punya titik. Mengubah
    // null menjadi 0 akan menempatkannya di lepas pantai Afrika.
    const hasil = toKegiatanListItem(
      kegiatan({ latitude: null, longitude: null }),
    );

    expect(hasil.latitude).toBeNull();
    expect(hasil.longitude).toBeNull();
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

  it("tetap menampilkan data teknis saat estimasi kabelnya nol meter", () => {
    // Nol meter adalah hasil survei yang sah. Kalau pemeriksaan ini suatu saat
    // "disederhanakan" jadi truthiness, seluruh blok data teknis akan hilang
    // dari UI dan hasil surveinya tidak pernah terlihat.
    const hasil = toKegiatanDetail(
      kegiatan({ jenis: "SURVEI_LOKASI", estimasiKabelMeter: 0 }),
    );

    expect(hasil.dataTeknis).toEqual({
      odpTerdekat: null,
      estimasiKabelMeter: 0,
      catatanTeknis: null,
    });
  });

  it("mengubah waktu mulai menjadi ISO string", () => {
    expect(toKegiatanDetail(kegiatan()).waktuMulai).toBe(
      "2026-09-22T01:00:00.000Z",
    );
  });

  it("mewarisi koordinat dari item daftar, tidak menyalinnya sendiri", () => {
    // Kedua baris ini ada di dalam toKegiatanDetail sampai koordinat pindah
    // ke DTO induk. Sejak KegiatanDetailDto tidak lagi mendeklarasikannya
    // sendiri, compiler tidak akan menolak override yang ditambahkan setelah
    // spread — jadi assertion inilah satu-satunya yang menjaganya.
    const hasil = toKegiatanDetail(
      kegiatan({ latitude: -6.2, longitude: 106.8 }),
    );

    expect(hasil.latitude).toBe(-6.2);
    expect(hasil.longitude).toBe(106.8);
  });
});

describe("toProspekDetail — tanggal konversi", () => {
  it("mengembalikan null saat prospek belum pernah dikonversi", () => {
    expect(toProspekDetail(prospek()).konversiAt).toBeNull();
  });

  it("mengubah tanggal konversi menjadi ISO string saat sudah terisi", () => {
    const hasil = toProspekDetail(
      prospek({ konversiAt: new Date("2026-09-23T04:05:06.000Z") }),
    );

    expect(hasil.konversiAt).toBe("2026-09-23T04:05:06.000Z");
  });
});
