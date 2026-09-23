import { z } from "zod";
import { KEGIATAN_HASIL, KEGIATAN_JENIS } from "../domain/entities/Kegiatan";
import {
  isButuhDataTeknis,
  isButuhIklan,
  isButuhLokasi,
} from "../domain/kegiatan-rules";
import { isTerisi } from "./field-terisi";

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

const MENIT_KE_MS = 60 * 1000;

/**
 * Batas seberapa jauh `waktuMulai` boleh mendahului jam server.
 *
 * Perangkat lapangan sering tidak tersinkron NTP — ponsel yang berjam-jam
 * offline di area tanpa sinyal bisa melenceng beberapa menit — jadi batas nol
 * toleransi akan menolak data yang sah. Lima belas menit cukup lebar untuk
 * skew wajar, tapi jauh lebih sempit daripada salah ketik tahun yang akan
 * menempelkan satu kegiatan di puncak setiap daftar selamanya (daftar kegiatan
 * diurutkan `waktuMulai: "desc"`).
 *
 * Diekspor lewat `modules/presurvei/client.ts` supaya petunjuk di
 * `KegiatanFormModal.tsx` menyebut angka yang sama dengan yang ditegakkan di
 * sini, bukan salinan tangan yang bisa menyimpang.
 */
export const TOLERANSI_SKEW_JAM_MENIT = 15;
const TOLERANSI_SKEW_JAM_MS = TOLERANSI_SKEW_JAM_MENIT * MENIT_KE_MS;

/**
 * Apakah waktu ini belum melampaui jam server di luar toleransi skew.
 *
 * Batasnya dihitung saat parse, bukan saat modul dimuat: server berjalan
 * sebagai proses panjang, jadi batas yang dibekukan di waktu impor akan makin
 * ketinggalan seiring proses itu hidup.
 */
function isBelumMelewatiSekarang(waktu: Date): boolean {
  return waktu.getTime() <= Date.now() + TOLERANSI_SKEW_JAM_MS;
}

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
    waktuMulai: z.coerce.date().refine(isBelumMelewatiSekarang, {
      message: `Waktu mulai tidak boleh lebih dari ${TOLERANSI_SKEW_JAM_MENIT} menit di masa depan`,
    }),
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
      (isTerisi(kegiatan.latitude) && isTerisi(kegiatan.longitude)),
    { message: "Kunjungan dan survei lokasi wajib menyertakan koordinat" },
  )
  .refine(
    (kegiatan) =>
      isButuhDataTeknis(kegiatan.jenis) ||
      (!isTerisi(kegiatan.odpTerdekat) &&
        !isTerisi(kegiatan.estimasiKabelMeter) &&
        !isTerisi(kegiatan.catatanTeknis)),
    { message: "Data teknis hanya boleh diisi pada survei lokasi" },
  )
  .refine(
    (kegiatan) => !isButuhIklan(kegiatan.jenis) || isTerisi(kegiatan.iklanId),
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

/** Pesan saat badan ubah tidak membawa satu medan pun. */
const PESAN_UBAH_KOSONG = "Kirim minimal satu medan yang diubah";

/**
 * Masukan `PATCH /api/presurvei/kegiatan/[id]`.
 *
 * Hanya `catatan`, `ditemuiNama`, dan `hasil` (lihat
 * `domain/kegiatan-perubahan.ts`). `.strict()` membuat medan lain DITOLAK
 * dengan 400, bukan dibuang diam-diam — pemanggil yang mengirim `waktuMulai`
 * harus tahu perubahannya tidak tersimpan. Batas hasil lintas kelompok butuh
 * nilai tersimpan, jadi ditegakkan service, bukan di sini.
 */
export const ubahKegiatanSchema = z
  .object({
    catatan: z.string().max(PANJANG_CATATAN_MAKS).nullable().optional(),
    ditemuiNama: z.string().max(PANJANG_NAMA_MAKS).nullable().optional(),
    hasil: z.enum(KEGIATAN_HASIL).optional(),
  })
  .strict()
  .refine(
    (perubahan) =>
      Object.values(perubahan).some((nilai) => nilai !== undefined),
    { message: PESAN_UBAH_KOSONG },
  );
