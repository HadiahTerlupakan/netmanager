import type {
  RencanaEntity,
  RencanaJenis,
  RencanaStatus,
  RencanaSumber,
} from "../domain/entities/Rencana";
import {
  namaSalesSatuTenant,
  type IdentitasSalesBertenant,
} from "../domain/nama-sales";

/**
 * Pemetaan baris Prisma ke entitas domain rencana kunjungan.
 */

const PANJANG_TANGGAL_ISO = 10;

export interface RencanaRow {
  id: string;
  salesId: string;
  dibuatOlehId: string;
  sumber: RencanaSumber;
  jenis: RencanaJenis;
  tanggal: Date;
  jam: string | null;
  tujuan: string;
  prospekId: string | null;
  alamat: string | null;
  latitude: number | null;
  longitude: number | null;
  status: RencanaStatus;
  kegiatanId: string | null;
  dilaporkanAt: Date | null;
  alasanBatal: string | null;
  dibatalkanOlehId: string | null;
  dibatalkanAt: Date | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
  sales?: IdentitasSalesBertenant | null;
  dibuatOleh?: IdentitasSalesBertenant | null;
  prospek?: { nama: string; tenantId: string | null } | null;
}

/**
 * Kolom DATE dibaca Prisma sebagai tengah malam UTC; bagian tanggalnya adalah
 * tanggal kalender yang disimpan, tanpa pergeseran zona.
 */
export function tanggalDariKolomDate(nilai: Date): string {
  return nilai.toISOString().slice(0, PANJANG_TANGGAL_ISO);
}

/** Tanggal kalender "YYYY-MM-DD" untuk ditulis ke kolom DATE. */
export function tanggalKeKolomDate(tanggal: string): Date {
  return new Date(`${tanggal}T00:00:00.000Z`);
}

/** Ubah satu baris rencana dari database menjadi entitas domain. */
export function toRencanaEntity(row: RencanaRow): RencanaEntity {
  return {
    id: row.id,
    salesId: row.salesId,
    namaSales: namaSalesSatuTenant(row.sales, row.tenantId),
    dibuatOlehId: row.dibuatOlehId,
    namaPembuat: namaSalesSatuTenant(row.dibuatOleh, row.tenantId),
    sumber: row.sumber,
    jenis: row.jenis,
    tanggal: tanggalDariKolomDate(row.tanggal),
    jam: row.jam,
    tujuan: row.tujuan,
    prospekId: row.prospekId,
    namaProspek:
      row.prospek && row.prospek.tenantId === row.tenantId
        ? row.prospek.nama
        : null,
    alamat: row.alamat,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    kegiatanId: row.kegiatanId,
    dilaporkanAt: row.dilaporkanAt,
    alasanBatal: row.alasanBatal,
    dibatalkanOlehId: row.dibatalkanOlehId,
    dibatalkanAt: row.dibatalkanAt,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
