/**
 * Aturan seret papan prospek.
 *
 * Murni: tidak mengimpor apa pun dari luar folder `domain/`.
 *
 * Aturan transisinya TIDAK ditulis ulang di sini — `isTransisiStatusSah` sudah
 * memegangnya, dan menyalinnya akan melahirkan dua sumber kebenaran yang
 * bisa berbeda pendapat.
 */

import type { ProspekStatus } from "./entities/Prospek";
import { isTransisiStatusSah } from "./prospek-rules";

/** Apa yang terjadi saat kartu dijatuhkan ke sebuah kolom. */
export type AksiKanban =
  | { jenis: "ubah-status"; tujuan: ProspekStatus }
  | { jenis: "buka-konversi" };

/**
 * Aksi untuk kartu berstatus `dari` yang dijatuhkan ke kolom `ke`, atau null
 * bila perpindahan itu tidak sah.
 *
 * Pemanggil memakai null untuk meredupkan kolom saat kartu diangkat, sehingga
 * tujuan yang tidak sah tidak pernah tampak bisa dijatuhi.
 */
export function resolveAksiKanban(
  dari: ProspekStatus,
  ke: ProspekStatus,
): AksiKanban | null {
  // Menjatuhkan kartu ke kolomnya sendiri bukan perpindahan, apa pun kata
  // tabel transisi. Penjaga ini TIDAK redundan secara semantik meski hari ini
  // tak terjangkau mutasi: `TRANSISI_SAH` kebetulan tidak punya satu pun
  // status yang mendaftarkan dirinya sendiri, jadi penjaga di bawah sudah
  // menolak kasus ini. Begitu ada satu saja transisi-diri ditambahkan nanti,
  // tanpa baris ini sebuah non-perpindahan akan diam-diam menulis status.
  if (dari === ke) {
    return null;
  }

  if (!isTransisiStatusSah(dari, ke)) {
    return null;
  }

  // DEAL menuntut data yang tidak ada pada prospek, jadi ia membuka form
  // alih-alih langsung menulis status.
  return ke === "DEAL"
    ? { jenis: "buka-konversi" }
    : { jenis: "ubah-status", tujuan: ke };
}
