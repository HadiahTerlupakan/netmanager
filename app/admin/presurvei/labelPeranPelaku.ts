import {
  PERAN_PELAKU_LABEL,
  type KegiatanListItemDto,
} from "@/modules/presurvei/client";

/** Pemisah label peran dan nama departemen. */
const PEMISAH_PERAN_DEPARTEMEN = " · ";

/**
 * Label peran pelaku beserta departemennya: "Non-sales · Teknik", "Sales",
 * atau null bila keduanya tidak diketahui (pelaku tak bisa ditampilkan).
 *
 * Satu definisi untuk tabel kegiatan, rincian, dan dashboard. Peran dan
 * departemen adalah keadaan user SAAT INI, bukan saat kegiatan dicatat.
 * Departemen kosong diperiksa panjangnya, bukan truthiness-nya, supaya
 * maksudnya terbaca: yang ditanyakan "terisi atau tidak".
 */
export function teksPeranPelaku(
  item: Pick<KegiatanListItemDto, "peranPelaku" | "departemenPelaku">,
): string | null {
  const bagian: string[] = [];
  if (item.peranPelaku !== null) {
    bagian.push(PERAN_PELAKU_LABEL[item.peranPelaku]);
  }
  if (item.departemenPelaku !== null && item.departemenPelaku.length > 0) {
    bagian.push(item.departemenPelaku);
  }
  return bagian.length > 0 ? bagian.join(PEMISAH_PERAN_DEPARTEMEN) : null;
}
