import type { IklanEntity } from "../domain/entities/Iklan";
import { isIklanBerjalan } from "../domain/iklan-rules";

/**
 * Bentuk data iklan yang dikirim ke klien.
 *
 * `isBerjalan` dihitung di sini supaya UI tidak perlu menyalin aturan domain
 * dan berisiko berbeda pendapat dengan server soal kampanye mana yang hidup.
 */

export interface IklanListItemDto {
  id: string;
  nama: string;
  kode: string;
  channel: string;
  tanggalMulai: string;
  tanggalSelesai: string | null;
  isAktif: boolean;
  isBerjalan: boolean;
}

export interface IklanDetailDto extends IklanListItemDto {
  biaya: number | null;
  penanggungJawabId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Ringkasan iklan untuk tampilan daftar. */
export function toIklanListItem(iklan: IklanEntity): IklanListItemDto {
  return {
    id: iklan.id,
    nama: iklan.nama,
    kode: iklan.kode,
    channel: iklan.channel,
    tanggalMulai: iklan.tanggalMulai.toISOString(),
    tanggalSelesai: iklan.tanggalSelesai?.toISOString() ?? null,
    isAktif: iklan.isAktif,
    isBerjalan: isIklanBerjalan(iklan),
  };
}

/** Rincian lengkap iklan untuk halaman detail. */
export function toIklanDetail(iklan: IklanEntity): IklanDetailDto {
  return {
    ...toIklanListItem(iklan),
    biaya: iklan.biaya,
    penanggungJawabId: iklan.penanggungJawabId,
    createdAt: iklan.createdAt.toISOString(),
    updatedAt: iklan.updatedAt.toISOString(),
  };
}
