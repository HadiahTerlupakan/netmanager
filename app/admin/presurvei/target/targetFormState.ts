import { z } from "zod";

import {
  tetapkanTargetSchema,
  type TargetDto,
} from "@/modules/presurvei/client";

import type { StatusDaftarSales } from "../useDaftarSalesPresurvei";
import { cariTargetSales, type BarisTarget } from "./barisTarget";
import type { Periode } from "../periode";

/**
 * Batas atas tiap angka target, dipasang sebagai atribut `max` medan: browser
 * menolak angka di atasnya lebih dulu, dan `tetapkanTargetSchema` berlaku
 * sebagai jaring kedua. Salinan dari `TARGET_MAKS` di
 * `modules/presurvei/validators/target.validator.ts:10` (tidak diekspor) —
 * WAJIB diselaraskan bila angka di sana berubah, sama seperti
 * `KegiatanFormModal.tsx:42-44`.
 */
export const TARGET_MAKS = 10_000;

/** Pesan untuk medan angka yang kosong atau bukan angka. */
export const PESAN_ANGKA_WAJIB = "Isi dengan angka; 0 berarti tanpa target.";

/** Pesan untuk form yang belum memilih sales. */
export const PESAN_SALES_WAJIB = "Pilih sales terlebih dahulu.";

/** Kunci pesan yang tidak menempel ke satu medan pun. */
export const KUNCI_KESALAHAN_FORM = "_form";

/** Nilai medan form; semuanya string karena berasal dari `<input>`. */
export interface NilaiFormTarget {
  userId: string;
  targetKunjungan: string;
  targetProspek: string;
  targetKonversi: string;
}

/** Badan `POST /api/admin/presurvei/target`. */
export type MuatanTarget = z.infer<typeof tetapkanTargetSchema>;

/** Pesan kesalahan per medan. */
export type KesalahanFormTarget = Partial<
  Record<keyof NilaiFormTarget | typeof KUNCI_KESALAHAN_FORM, string>
>;

/** Hasil pemeriksaan form: muatan siap kirim, atau pesan per medan. */
export type HasilPeriksaTarget =
  | { success: true; muatan: MuatanTarget }
  | { success: false; kesalahan: KesalahanFormTarget };

/** Medan angka target, urut sesuai tampilan di form. */
export type MedanAngka = "targetKunjungan" | "targetProspek" | "targetKonversi";

export const MEDAN_ANGKA: readonly MedanAngka[] = [
  "targetKunjungan",
  "targetProspek",
  "targetKonversi",
];

/**
 * Medan yang punya slot pesan di form. `Record` memaksa medan baru dijawab
 * saat kompilasi; `periodeTahun`/`periodeBulan` sengaja tidak ada karena
 * periode hanya tampil sebagai teks read-only.
 */
const MEDAN_BERSLOT_PESAN: Record<keyof NilaiFormTarget, boolean> = {
  userId: true,
  targetKunjungan: true,
  targetProspek: true,
  targetKonversi: true,
};

/** Nilai awal form target baru. */
export const NILAI_FORM_KOSONG: NilaiFormTarget = {
  userId: "",
  targetKunjungan: "",
  targetProspek: "",
  targetKonversi: "",
};

/** Nilai form ubah, terisi dari target yang sudah ada. */
export function nilaiFormDariTarget(target: TargetDto): NilaiFormTarget {
  return {
    userId: target.userId,
    targetKunjungan: String(target.targetKunjungan),
    targetProspek: String(target.targetProspek),
    targetKonversi: String(target.targetKonversi),
  };
}

/**
 * Angka dari medan target, atau null bila kosong atau bukan angka.
 *
 * Kekosongan diperiksa eksplisit karena `Number("")` adalah 0 — tanpanya
 * medan yang lupa diisi tersimpan sebagai target nol. Sebaliknya "0" adalah
 * target sah (`min(0)` di `tetapkanTargetSchema`), jadi hasilnya tidak boleh
 * disaring dengan `||`. Pecahan dan angka negatif dibiarkan lolos di sini dan
 * ditolak schema.
 */
export function keAngkaTarget(teks: string): number | null {
  const bersih = teks.trim();
  if (bersih === "") return null;

  const angka = Number(bersih);
  return Number.isNaN(angka) ? null : angka;
}

/** Kunci tempat sebuah issue schema ditampilkan. */
function kunciKesalahan(
  path: readonly PropertyKey[],
): keyof KesalahanFormTarget {
  const kunci = String(path[0] ?? "");

  return MEDAN_BERSLOT_PESAN[kunci as keyof NilaiFormTarget] === true
    ? (kunci as keyof NilaiFormTarget)
    : KUNCI_KESALAHAN_FORM;
}

/** Pesan untuk kekosongan yang bisa diketahui sebelum schema dijalankan. */
function periksaKekosongan(nilai: NilaiFormTarget): KesalahanFormTarget {
  const kesalahan: KesalahanFormTarget = {};

  if (nilai.userId.trim() === "") kesalahan.userId = PESAN_SALES_WAJIB;
  for (const medan of MEDAN_ANGKA) {
    if (keAngkaTarget(nilai[medan]) === null) {
      kesalahan[medan] = PESAN_ANGKA_WAJIB;
    }
  }

  return kesalahan;
}

/**
 * Periksa form dan bentuk muatan `POST` untuk periode yang sedang tampil.
 *
 * Periode datang dari layar, bukan dari medan form: invalidasi setelah simpan
 * harus mengenai query yang sedang tampil, dan pemakai tidak boleh menyimpan
 * ke bulan yang tidak ia lihat.
 */
export function periksaFormTarget(
  nilai: NilaiFormTarget,
  periode: Periode,
): HasilPeriksaTarget {
  const kesalahanKosong = periksaKekosongan(nilai);
  if (Object.keys(kesalahanKosong).length > 0) {
    return { success: false, kesalahan: kesalahanKosong };
  }

  const hasil = tetapkanTargetSchema.safeParse({
    userId: nilai.userId.trim(),
    periodeTahun: periode.tahun,
    periodeBulan: periode.bulan,
    targetKunjungan: keAngkaTarget(nilai.targetKunjungan),
    targetProspek: keAngkaTarget(nilai.targetProspek),
    targetKonversi: keAngkaTarget(nilai.targetKonversi),
  });
  if (hasil.success) return { success: true, muatan: hasil.data };

  const kesalahan: KesalahanFormTarget = {};
  for (const masalah of hasil.error.issues) {
    kesalahan[kunciKesalahan(masalah.path)] = masalah.message;
  }
  return { success: false, kesalahan };
}

/**
 * Apakah tombol simpan boleh aktif.
 *
 * Mode buat butuh daftar sales yang sudah tiba: daftar kosong karena gagal
 * tidak boleh tampak sama dengan "tidak ada sales". Mode ubah mengunci sales
 * dari baris target, jadi tidak bergantung pada daftar itu.
 */
export function isSimpanTargetTerbuka({
  isUbah,
  statusDaftarSales,
}: {
  isUbah: boolean;
  statusDaftarSales: StatusDaftarSales;
}): boolean {
  return isUbah || statusDaftarSales === "siap";
}

/**
 * Nilai form setelah pemakai mengganti sales pada mode buat.
 *
 * - Sales baru sudah punya target periode ini → medan diisi target lamanya,
 *   menimpa ketikan. Yang akan tertimpa harus terlihat sebelum disimpan.
 * - Sales sebelumnya bertarget, sales baru tidak → angka dikosongkan. Angka
 *   itu milik target sales sebelumnya, bukan ketikan untuk sales baru.
 * - Keduanya tanpa target → ketikan dipertahankan, karena memang diketik
 *   pemakai dan belum menempel ke target siapa pun.
 */
export function nilaiSetelahGantiSales(
  lama: NilaiFormTarget,
  userIdBaru: string,
  barisPeriode: readonly BarisTarget[],
): NilaiFormTarget {
  const targetBaru = cariTargetSales(userIdBaru, barisPeriode);
  if (targetBaru !== null) return nilaiFormDariTarget(targetBaru);

  const isAngkaMilikTargetLama =
    cariTargetSales(lama.userId, barisPeriode) !== null;
  if (isAngkaMilikTargetLama) {
    return { ...NILAI_FORM_KOSONG, userId: userIdBaru };
  }

  return { ...lama, userId: userIdBaru };
}
