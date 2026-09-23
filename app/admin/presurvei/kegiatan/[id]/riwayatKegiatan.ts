import { formatDateTimeDisplay } from "@/lib/utils/datetime";
import {
  KEGIATAN_HASIL_CONFIG,
  type KegiatanHasil,
  type MedanKegiatanDapatDiubah,
  type RiwayatKegiatanDto,
} from "@/modules/presurvei/client";

import { TEKS_KOSONG } from "./blokDetail";

/** Label pengubah yang namanya tidak bisa ditampilkan (lihat `namaSalesSatuTenant`). */
export const TEKS_PENGUBAH_TAK_DIKENAL = "Pengguna tidak dikenal";

/**
 * Label tiap medan, dalam urutan tampil. `Record` memaksa medan baru yang
 * bisa diubah ikut diberi label saat kompilasi.
 */
const LABEL_MEDAN: Record<MedanKegiatanDapatDiubah, string> = {
  catatan: "Catatan",
  ditemuiNama: "Ditemui",
  hasil: "Hasil",
};

const URUTAN_MEDAN = Object.keys(LABEL_MEDAN) as MedanKegiatanDapatDiubah[];

/** Satu medan yang berubah, sudah jadi teks. */
export interface BarisPerubahan {
  medan: MedanKegiatanDapatDiubah;
  label: string;
  dari: string;
  ke: string;
}

/** Satu baris riwayat siap tampil: siapa, kapan, medan dari → ke. */
export interface BarisRiwayat {
  id: string;
  pelaku: string;
  waktu: string;
  perubahan: BarisPerubahan[];
}

/**
 * Teks satu nilai. Pembanding eksplisit terhadap null, bukan `||`: string
 * kosong adalah nilai tersimpan yang sah dan berbeda dari "tidak diisi".
 */
function teksNilai(
  medan: MedanKegiatanDapatDiubah,
  nilai: string | null,
): string {
  if (nilai === null) return TEKS_KOSONG;
  if (medan === "hasil")
    return KEGIATAN_HASIL_CONFIG[nilai as KegiatanHasil].label;
  return nilai;
}

/** Ubah satu riwayat DTO menjadi baris siap tampil. */
export function keBarisRiwayat(riwayat: RiwayatKegiatanDto): BarisRiwayat {
  const perubahan: BarisPerubahan[] = [];
  for (const medan of URUTAN_MEDAN) {
    const berubah = riwayat.perubahan[medan];
    if (berubah === undefined) continue;
    perubahan.push({
      medan,
      label: LABEL_MEDAN[medan],
      dari: teksNilai(medan, berubah.dari),
      ke: teksNilai(medan, berubah.ke),
    });
  }

  return {
    id: riwayat.id,
    pelaku: riwayat.namaPengubah ?? TEKS_PENGUBAH_TAK_DIKENAL,
    waktu: formatDateTimeDisplay(riwayat.diubahPada),
    perubahan,
  };
}
