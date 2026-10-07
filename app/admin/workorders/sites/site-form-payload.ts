/**
 * Perubahan nilai form site menjadi muatan API.
 *
 * Input HTML selalu menghasilkan string, sedangkan `siteCreateSchema` dan
 * `siteUpdateSchema` meminta angka. Mengirim `formData.latitude` apa adanya
 * membuat Zod menolak dengan "expected number, received string" — kesalahan
 * yang muncul di layar pengguna sebagai kegagalan menyimpan tanpa petunjuk
 * field mana yang salah.
 *
 * Dibagi dua form (tambah dan ubah) supaya keduanya tidak bisa berbeda tafsir.
 */

/**
 * Angka dari isian teks, atau `null` bila kosong/tidak terbaca.
 *
 * Koordinat memang boleh kosong — site tanpa titik peta tetap sah — jadi string
 * kosong bukan kesalahan, melainkan "tidak diisi". Nilai yang tidak terbaca
 * sebagai angka juga jadi `null` alih-alih `NaN`, karena `NaN` lolos
 * `typeof === "number"` dan baru meledak jauh di dalam database.
 */
export function angkaAtauNull(nilai: string): number | null {
  const rapi = nilai.trim();
  if (rapi === "") return null;

  const angka = Number(rapi);
  return Number.isFinite(angka) ? angka : null;
}

/** Angka bulat dari isian teks, dengan nilai bawaan bila kosong/tak terbaca. */
export function angkaBulatAtau(nilai: string, bawaan: number): number {
  const angka = angkaAtauNull(nilai);
  return angka === null ? bawaan : Math.trunc(angka);
}

export const RADIUS_ABSENSI_BAWAAN = 100;
