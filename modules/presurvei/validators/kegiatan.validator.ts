import { z } from "zod";
import { KEGIATAN_HASIL, KEGIATAN_JENIS } from "../domain/entities/Kegiatan";
import {
  isButuhDataTeknis,
  isButuhIklan,
  isButuhLokasi,
} from "../domain/kegiatan-rules";
import { PERAN_PELAKU } from "../domain/peran-pelaku";
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

/**
 * Query `GET /api/presurvei/kegiatan`.
 *
 * `peran` enum, bukan boolean `isSales`: "false" atau nilai asing ditolak 400
 * alih-alih diterjemahkan diam-diam. `peran` dan `departemenId` menyaring
 * lewat relasi pelaku (`KegiatanRepository.bangunFilter`) — keadaan user SAAT
 * INI, bukan saat kegiatan dicatat.
 */
export const daftarKegiatanSchema = z.object({
  userId: z.string().optional(),
  peran: z.enum(PERAN_PELAKU).optional(),
  departemenId: z.string().optional(),
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
 * Teks ubah yang dirapikan: spasi di kedua ujung dibuang, lalu isian kosong
 * menjadi `null`. Dikerjakan di schema, bukan di klien, supaya web dan mobile
 * menghasilkan nilai yang sama dan tidak lahir riwayat `null → ""`. Batas
 * panjang dihitung setelah dirapikan.
 */
const teksUbah = (panjangMaks: number) =>
  z
    .string()
    .trim()
    .max(panjangMaks)
    .transform((teks) => (teks === "" ? null : teks))
    .nullable()
    .optional();

/**
 * Masukan `PATCH /api/presurvei/kegiatan/[id]`.
 *
 * Hanya `catatan`, `ditemuiNama`, dan `hasil` yang bisa diubah (lihat
 * `domain/kegiatan-perubahan.ts`). `.strict()` membuat medan lain DITOLAK
 * dengan 400, bukan dibuang diam-diam — pemanggil yang mengirim `waktuMulai`
 * harus tahu perubahannya tidak tersimpan. Batas hasil lintas kelompok butuh
 * nilai tersimpan, jadi ditegakkan service, bukan di sini.
 *
 * `versi` BUKAN medan yang diubah: ia `updatedAt` rincian yang dilihat klien
 * (ISO bermilidetik, sama presisinya dengan kolom TIMESTAMP(3)), dipakai
 * sebagai kunci konkurensi optimistis. Opsional supaya klien mobile lama
 * tetap diterima; tanpa `versi`, kuncinya hanya menjaga jendela di dalam
 * satu request. Ia tidak dihitung sebagai "ada perubahan" — badan yang hanya
 * berisi `versi` tetap ditolak.
 */
export const ubahKegiatanSchema = z
  .object({
    catatan: teksUbah(PANJANG_CATATAN_MAKS),
    ditemuiNama: teksUbah(PANJANG_NAMA_MAKS),
    hasil: z.enum(KEGIATAN_HASIL).optional(),
    versi: z.iso
      .datetime()
      .transform((teks) => new Date(teks))
      .optional(),
  })
  .strict()
  .refine(
    (masukan) =>
      masukan.catatan !== undefined ||
      masukan.ditemuiNama !== undefined ||
      masukan.hasil !== undefined,
    { message: PESAN_UBAH_KOSONG },
  );
