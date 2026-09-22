import type { IklanChannel, IklanEntity } from "../domain/entities/Iklan";

/**
 * Pemetaan baris Prisma ke entitas domain iklan.
 *
 * Bentuk barisnya dideklarasikan struktural supaya mapper tidak perlu
 * mengimpor tipe Prisma.
 */

export interface IklanRow {
  id: string;
  nama: string;
  kode: string;
  channel: string;
  tanggalMulai: Date;
  tanggalSelesai: Date | null;
  biaya: { toString(): string } | null;
  penanggungJawabId: string | null;
  isAktif: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Ubah satu baris iklan dari database menjadi entitas domain. */
export function toIklanEntity(row: IklanRow): IklanEntity {
  return {
    id: row.id,
    nama: row.nama,
    kode: row.kode,
    channel: row.channel as IklanChannel,
    tanggalMulai: row.tanggalMulai,
    tanggalSelesai: row.tanggalSelesai,
    // Decimal Prisma diubah lewat string, bukan Number() langsung: konversi
    // biner bisa menggeser sen pada nilai anggaran yang besar.
    biaya: row.biaya === null ? null : Number(row.biaya.toString()),
    penanggungJawabId: row.penanggungJawabId,
    isAktif: row.isAktif,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
