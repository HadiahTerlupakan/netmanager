import type {
  ProspekEntity,
  ProspekStatus,
  ProspekSumber,
} from "../domain/entities/Prospek";

/**
 * Pemetaan baris Prisma ke entitas domain prospek.
 *
 * Bentuk baris dideklarasikan struktural supaya folder mapper tidak perlu
 * mengimpor tipe Prisma, sehingga domain tetap bebas dari detail penyimpanan.
 */

export interface ProspekRow {
  id: string;
  nama: string;
  noTelp: string;
  email: string | null;
  alamat: string;
  latitude: number | null;
  longitude: number | null;
  shareloc: string | null;
  sumber: string;
  iklanId: string | null;
  registrationId: string | null;
  referralNama: string | null;
  status: string;
  pemilikId: string | null;
  paketDiminati: string | null;
  catatan: string | null;
  canvasingId: string | null;
  konversiAt: Date | null;
  siteId: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Ubah satu baris prospek dari database menjadi entitas domain. */
export function toProspekEntity(row: ProspekRow): ProspekEntity {
  return {
    id: row.id,
    nama: row.nama,
    noTelp: row.noTelp,
    email: row.email,
    alamat: row.alamat,
    latitude: row.latitude,
    longitude: row.longitude,
    shareloc: row.shareloc,
    sumber: row.sumber as ProspekSumber,
    iklanId: row.iklanId,
    registrationId: row.registrationId,
    referralNama: row.referralNama,
    status: row.status as ProspekStatus,
    pemilikId: row.pemilikId,
    paketDiminati: row.paketDiminati,
    catatan: row.catatan,
    canvasingId: row.canvasingId,
    konversiAt: row.konversiAt,
    siteId: row.siteId,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
