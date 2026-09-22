import type { KegiatanHasil, KegiatanJenis } from "./entities/Kegiatan";

/**
 * Aturan bisnis kegiatan presurvei — fungsi murni, tanpa I/O.
 *
 * Menentukan kolom mana yang masuk akal terisi untuk tiap jenis kegiatan, dan
 * kapan sebuah kegiatan pantas melahirkan prospek baru.
 */

const JENIS_DI_LAPANGAN: KegiatanJenis[] = ["KUNJUNGAN", "SURVEI_LOKASI"];
const JENIS_BERDATA_TEKNIS: KegiatanJenis[] = ["SURVEI_LOKASI"];
const JENIS_TERKAIT_IKLAN: KegiatanJenis[] = ["IKLAN"];
const HASIL_BERMINAT: KegiatanHasil[] = ["TERTARIK", "DEAL"];

/** Apakah jenis kegiatan ini terjadi di lokasi sehingga butuh koordinat. */
export function isButuhLokasi(jenis: KegiatanJenis): boolean {
  return JENIS_DI_LAPANGAN.includes(jenis);
}

/** Apakah jenis kegiatan ini boleh membawa hasil survei teknis. */
export function isButuhDataTeknis(jenis: KegiatanJenis): boolean {
  return JENIS_BERDATA_TEKNIS.includes(jenis);
}

/** Apakah jenis kegiatan ini harus menunjuk ke sebuah iklan. */
export function isButuhIklan(jenis: KegiatanJenis): boolean {
  return JENIS_TERKAIT_IKLAN.includes(jenis);
}

/** Apakah hasil kegiatan menunjukkan minat yang layak dicatat sebagai prospek. */
export function isHasilMelahirkanProspek(hasil: KegiatanHasil): boolean {
  return HASIL_BERMINAT.includes(hasil);
}
