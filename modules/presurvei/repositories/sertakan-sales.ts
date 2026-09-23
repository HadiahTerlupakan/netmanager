import type { Prisma } from "@prisma/client";

/**
 * Join nama sales untuk baris kegiatan dan prospek.
 *
 * Dipakai di SETIAP pembacaan dan penulisan yang mengembalikan entitas, supaya
 * `namaSales`/`namaPemilik` tidak diam-diam null hanya karena satu jalur lupa
 * menyertakannya.
 *
 * `tenantId` ikut dipilih bukan untuk ditampilkan, melainkan untuk penjaga
 * tenant di `namaSalesSatuTenant`: `include` bersarang tidak dijangkau
 * ekstensi tenant, dan relasi ke-satu tidak menerima `where` untuk ditulisi
 * `tenantId` secara eksplisit — jadi penyaringannya dilakukan setelah baris
 * kembali, oleh mapper.
 */
const KOLOM_IDENTITAS_SALES = {
  name: true,
  email: true,
  tenantId: true,
} as const;

/** Sertakan pelaku kegiatan (`PresurveiKegiatan.user`). */
export const SERTAKAN_PELAKU = {
  user: { select: KOLOM_IDENTITAS_SALES },
} satisfies Prisma.PresurveiKegiatanInclude;

/** Sertakan pemilik prospek (`PresurveiProspek.pemilik`). */
export const SERTAKAN_PEMILIK = {
  pemilik: { select: KOLOM_IDENTITAS_SALES },
} satisfies Prisma.PresurveiProspekInclude;
