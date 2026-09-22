import type { IklanChannel, IklanEntity } from "../domain/entities/Iklan";

/**
 * Pemetaan baris Prisma ke entitas domain iklan.
 *
 * Bentuk barisnya dideklarasikan struktural supaya mapper tidak terikat pada
 * tipe Prisma yang di-generate. Bentuknya tetap harus sempit: tipe yang
 * dipenuhi sembarang nilai tidak menolak apa pun saat kompilasi.
 */

export interface IklanRow {
  id: string;
  nama: string;
  kode: string;
  channel: string;
  tanggalMulai: Date;
  tanggalSelesai: Date | null;
  biaya: { toNumber(): number } | number | null;
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
    // Decimal Prisma dan number polos (dari fixture test) ditangani lewat union
    // eksplisit, bukan duck-typing `toString()`. Setiap nilai JavaScript punya
    // `toString()`, jadi bentuk baris yang keliru akan lolos kompilasi lalu
    // diam-diam menghasilkan NaN pada kolom yang dipakai menghitung biaya per
    // lead. `toNumber()` hanya dipenuhi objek mirip-Decimal.
    biaya:
      row.biaya === null
        ? null
        : typeof row.biaya === "number"
          ? row.biaya
          : row.biaya.toNumber(),
    penanggungJawabId: row.penanggungJawabId,
    isAktif: row.isAktif,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
