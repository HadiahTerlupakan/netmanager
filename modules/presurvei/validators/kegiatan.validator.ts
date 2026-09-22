import { z } from "zod";
import { KEGIATAN_HASIL, KEGIATAN_JENIS } from "../domain/entities/Kegiatan";
import {
  isButuhDataTeknis,
  isButuhIklan,
  isButuhLokasi,
} from "../domain/kegiatan-rules";

/**
 * Validasi masukan kegiatan presurvei.
 *
 * Selain memeriksa tiap field, skema ini menegakkan konsistensi antara jenis
 * kegiatan dan kolom yang menyertainya: kunjungan wajib berkoordinat, data
 * teknis hanya boleh ikut pada survei lokasi.
 */

const PANJANG_NAMA_MAKS = 120;
const PANJANG_ALAMAT_MAKS = 500;
const PANJANG_CATATAN_MAKS = 1000;
const JUMLAH_FOTO_MAKS = 6;
const KABEL_METER_MAKS = 5000;
const BATAS_HALAMAN_MAKS = 100;
const ISI_HALAMAN_BAWAAN = 20;

const dataProspekBaruSchema = z.object({
  nama: z.string().min(2).max(PANJANG_NAMA_MAKS),
  noTelp: z.string().min(8).max(20),
  alamat: z.string().min(5).max(PANJANG_ALAMAT_MAKS),
  email: z.string().email().optional().nullable(),
  paketDiminati: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
});

export const catatKegiatanSchema = z
  .object({
    jenis: z.enum(KEGIATAN_JENIS),
    prospekId: z.string().optional().nullable(),
    iklanId: z.string().optional().nullable(),
    waktuMulai: z.coerce.date(),
    waktuSelesai: z.coerce.date().optional().nullable(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    alamatDikunjungi: z.string().max(PANJANG_ALAMAT_MAKS).optional().nullable(),
    ditemuiNama: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
    hasil: z.enum(KEGIATAN_HASIL),
    catatan: z.string().max(PANJANG_CATATAN_MAKS).optional().nullable(),
    fotoUrls: z.array(z.string().url()).max(JUMLAH_FOTO_MAKS).default([]),
    odpTerdekat: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
    estimasiKabelMeter: z
      .number()
      .int()
      .min(0)
      .max(KABEL_METER_MAKS)
      .optional()
      .nullable(),
    catatanTeknis: z.string().max(PANJANG_CATATAN_MAKS).optional().nullable(),
    siteId: z.string().optional().nullable(),
    prospekBaru: dataProspekBaruSchema.optional(),
  })
  .refine(
    (kegiatan) =>
      !isButuhLokasi(kegiatan.jenis) ||
      (kegiatan.latitude !== null &&
        kegiatan.latitude !== undefined &&
        kegiatan.longitude !== null &&
        kegiatan.longitude !== undefined),
    { message: "Kunjungan dan survei lokasi wajib menyertakan koordinat" },
  )
  .refine(
    (kegiatan) =>
      isButuhDataTeknis(kegiatan.jenis) ||
      (!kegiatan.odpTerdekat &&
        !kegiatan.estimasiKabelMeter &&
        !kegiatan.catatanTeknis),
    { message: "Data teknis hanya boleh diisi pada survei lokasi" },
  )
  .refine(
    (kegiatan) => !isButuhIklan(kegiatan.jenis) || Boolean(kegiatan.iklanId),
    { message: "Kegiatan iklan wajib menunjuk ke sebuah iklan" },
  );

export const daftarKegiatanSchema = z.object({
  userId: z.string().optional(),
  jenis: z.enum(KEGIATAN_JENIS).optional(),
  hasil: z.enum(KEGIATAN_HASIL).optional(),
  prospekId: z.string().optional(),
  dariTanggal: z.coerce.date().optional(),
  sampaiTanggal: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(BATAS_HALAMAN_MAKS)
    .default(ISI_HALAMAN_BAWAAN),
});
