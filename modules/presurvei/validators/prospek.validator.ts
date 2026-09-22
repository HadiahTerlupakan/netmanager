import { z } from "zod";
import { PROSPEK_STATUSES, PROSPEK_SUMBER } from "../domain/entities/Prospek";
import {
  isSumberButuhIklan,
  isSumberButuhReferral,
} from "../domain/prospek-rules";
import { isTerisi } from "./field-terisi";

/**
 * Validasi masukan prospek presurvei.
 *
 * Nilai enum diturunkan dari const array domain supaya tidak ada dua definisi
 * status yang bisa berbeda. Skema pembuatan juga menegakkan matriks atribusi
 * sumber: prospek yang mengaku datang dari iklan atau referral wajib membawa
 * jejak asalnya, karena setelah tersimpan jejak itu tidak bisa direkonstruksi.
 */

const PANJANG_NAMA_MIN = 2;
const PANJANG_NAMA_MAKS = 120;
const PANJANG_TELP_MIN = 8;
const PANJANG_TELP_MAKS = 20;
const PANJANG_ALAMAT_MIN = 5;
const PANJANG_ALAMAT_MAKS = 500;
const PANJANG_CATATAN_MAKS = 1000;
const BATAS_HALAMAN_MAKS = 100;
const ISI_HALAMAN_BAWAAN = 20;

export const buatProspekSchema = z
  .object({
    nama: z.string().min(PANJANG_NAMA_MIN).max(PANJANG_NAMA_MAKS),
    noTelp: z
      .string()
      .min(PANJANG_TELP_MIN, "Nomor telepon minimal 8 digit")
      .max(PANJANG_TELP_MAKS),
    email: z.string().email("Format email tidak valid").optional().nullable(),
    alamat: z.string().min(PANJANG_ALAMAT_MIN).max(PANJANG_ALAMAT_MAKS),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    shareloc: z.string().url("Tautan lokasi tidak valid").optional().nullable(),
    sumber: z.enum(PROSPEK_SUMBER),
    iklanId: z.string().optional().nullable(),
    referralNama: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
    pemilikId: z.string().optional().nullable(),
    paketDiminati: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
    catatan: z.string().max(PANJANG_CATATAN_MAKS).optional().nullable(),
    siteId: z.string().optional().nullable(),
  })
  .refine(
    (prospek) =>
      !isSumberButuhIklan(prospek.sumber) || isTerisi(prospek.iklanId),
    { message: "Prospek dari iklan wajib menunjuk ke sebuah iklan" },
  )
  .refine(
    (prospek) =>
      !isSumberButuhReferral(prospek.sumber) || isTerisi(prospek.referralNama),
    { message: "Prospek dari referral wajib mencatat nama perujuknya" },
  );

export const ubahProspekSchema = z.object({
  nama: z.string().min(PANJANG_NAMA_MIN).max(PANJANG_NAMA_MAKS).optional(),
  noTelp: z.string().min(PANJANG_TELP_MIN).max(PANJANG_TELP_MAKS).optional(),
  email: z.string().email().optional().nullable(),
  alamat: z
    .string()
    .min(PANJANG_ALAMAT_MIN)
    .max(PANJANG_ALAMAT_MAKS)
    .optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  shareloc: z.string().url().optional().nullable(),
  status: z.enum(PROSPEK_STATUSES).optional(),
  pemilikId: z.string().optional().nullable(),
  paketDiminati: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
  catatan: z.string().max(PANJANG_CATATAN_MAKS).optional().nullable(),
});

export const daftarProspekSchema = z.object({
  status: z.enum(PROSPEK_STATUSES).optional(),
  sumber: z.enum(PROSPEK_SUMBER).optional(),
  pemilikId: z.string().optional(),
  search: z.string().max(PANJANG_NAMA_MAKS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(BATAS_HALAMAN_MAKS)
    .default(ISI_HALAMAN_BAWAAN),
});
