/** Titik belok sebuah jalur: pasangan [latitude, longitude]. */
export type WaypointsRencana = Array<[number, number]>;

const PANJANG_PASANGAN_KOORDINAT = 2;

/** Apakah nilai berupa pasangan [latitude, longitude] berangka hingga. */
function isPasanganKoordinat(nilai: unknown): nilai is [number, number] {
  return (
    Array.isArray(nilai) &&
    nilai.length === PANJANG_PASANGAN_KOORDINAT &&
    nilai.every((angka) => typeof angka === "number" && Number.isFinite(angka))
  );
}

/**
 * Menguraikan kolom `waypoints` (String? berisi JSON array koordinat, ditulis
 * dengan `JSON.stringify` seperti di editor peta operasional).
 *
 * Satu-satunya pengurai kolom ini di modul planning. Sebelumnya ada dua:
 * yang dipakai perhitungan memvalidasi tiap elemen, sementara yang dipakai
 * DTO melakukan `parsed as Array<[number, number]>` tanpa pemeriksaan dan
 * menyuapkan hasilnya ke `<Polyline positions>` di browser. Kolom yang sama
 * dengan dua jawaban berbeda.
 *
 * Nilai kembali:
 * - `[]` — tidak ada titik belok (kolomnya memang kosong)
 * - `null` — isinya **rusak**: bukan JSON, bukan array, atau ada satu elemen
 *   yang bukan pasangan koordinat berangka hingga
 *
 * `null` dibedakan dari `[]` dengan sengaja. Jalur dengan waypoints rusak
 * jejaknya tidak diketahui, jadi panjangnya tidak boleh dihitung sebagai
 * garis lurus ujung-ke-ujung — itu lebih pendek dari kenyataan dan membuat
 * meter kabel hilang tanpa jejak. Pemanggil yang menghitung anggaran wajib
 * memperlakukan `null` sebagai "tidak bisa ditentukan"; pemanggil yang hanya
 * menggambar boleh jatuh ke `[]`.
 */
export function uraikanWaypoints(
  mentah: string | null,
): WaypointsRencana | null {
  if (!mentah) return [];
  try {
    const hasil: unknown = JSON.parse(mentah);
    if (!Array.isArray(hasil)) return null;
    if (!hasil.every(isPasanganKoordinat)) return null;
    return hasil;
  } catch {
    return null;
  }
}
