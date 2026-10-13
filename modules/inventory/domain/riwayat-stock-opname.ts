/**
 * Jejak perubahan stock opname — aturan murni, tanpa Prisma maupun I/O.
 *
 * Dipakai untuk menjawab dua pertanyaan di layar kepatuhan SO: siapa yang
 * terakhir mengubah catatan sebuah gudang, dan apa saja yang ia ubah.
 */

export type AksiRiwayatOpname = "DIBUAT" | "DIUBAH" | "DIHAPUS";

/** Nilai sebuah field sebelum dan sesudah satu peristiwa. */
export interface PerubahanField {
  dari: string | number | null;
  ke: string | number | null;
}

export type RingkasanPerubahan = Record<string, PerubahanField>;

/**
 * Field catatan opname yang perubahannya layak dicatat, beserta label
 * manusiawinya. Field di luar daftar ini (id, tenantId, timestamp) tidak
 * bermakna bagi pembaca riwayat.
 */
export const LABEL_FIELD_OPNAME: Record<string, string> = {
  stokFisik: "Stok fisik",
  stokSistem: "Stok sistem",
  selisih: "Selisih",
  kondisiBaik: "Kondisi baik",
  kondisiRusak: "Kondisi rusak",
  kondisiExpire: "Kondisi expire",
  keterangan: "Keterangan",
  alasanSelisih: "Alasan selisih",
  lokasiPenyimpanan: "Lokasi penyimpanan",
  nomorRak: "Nomor rak",
  nomorBox: "Nomor box",
  nomorBatch: "Nomor batch",
  catatanDetail: "Catatan detail",
  pic: "PIC",
};

const FIELD_TERLACAK = Object.keys(LABEL_FIELD_OPNAME);

type NilaiField = string | number | null | undefined;
type CatatanOpname = Record<string, unknown>;

/** Samakan `undefined`, string kosong, dan `null` menjadi satu bentuk kosong. */
function normalkan(nilai: unknown): string | number | null {
  if (nilai === undefined || nilai === null || nilai === "") return null;
  if (typeof nilai === "number" || typeof nilai === "string") return nilai;
  return String(nilai);
}

/**
 * Field yang benar-benar berubah antara dua versi catatan opname.
 *
 * Hanya field yang berbeda yang masuk: riwayat yang mencatat semua field pada
 * tiap penyuntingan tidak bisa dibaca, dan menyembunyikan satu-satunya angka
 * yang benar-benar diubah operator.
 */
export function ringkasPerubahan(
  sebelum: CatatanOpname,
  sesudah: CatatanOpname,
): RingkasanPerubahan {
  const hasil: RingkasanPerubahan = {};

  for (const field of FIELD_TERLACAK) {
    const dari = normalkan(sebelum[field]);
    const ke = normalkan(sesudah[field]);
    if (dari !== ke) hasil[field] = { dari, ke };
  }

  return hasil;
}

/** Catat nilai awal sebuah catatan baru: semua field terisi, `dari` kosong. */
export function ringkasPembuatan(catatan: CatatanOpname): RingkasanPerubahan {
  const hasil: RingkasanPerubahan = {};

  for (const field of FIELD_TERLACAK) {
    const ke = normalkan(catatan[field]);
    if (ke !== null) hasil[field] = { dari: null, ke };
  }

  return hasil;
}

/** Catat nilai terakhir sebuah catatan yang dihapus: `ke` kosong. */
export function ringkasPenghapusan(catatan: CatatanOpname): RingkasanPerubahan {
  const hasil: RingkasanPerubahan = {};

  for (const field of FIELD_TERLACAK) {
    const dari = normalkan(catatan[field]);
    if (dari !== null) hasil[field] = { dari, ke: null };
  }

  return hasil;
}

/** Nama pelaku yang layak disimpan, dengan cadangan berjenjang. */
export function namaPelaku(
  nama?: NilaiField,
  email?: NilaiField,
  cadangan = "Admin",
): string {
  return String(nama || email || cadangan);
}
