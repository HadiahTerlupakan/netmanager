import type {
  KegiatanEntity,
  KegiatanHasil,
  KegiatanJenis,
} from "../domain/entities/Kegiatan";

/**
 * Pemetaan baris Prisma ke entitas domain kegiatan.
 *
 * Bentuk baris dideklarasikan struktural supaya folder mapper tidak perlu
 * mengimpor tipe Prisma.
 */

export interface KegiatanRow {
  id: string;
  jenis: string;
  userId: string;
  prospekId: string | null;
  iklanId: string | null;
  waktuMulai: Date;
  waktuSelesai: Date | null;
  latitude: number | null;
  longitude: number | null;
  alamatDikunjungi: string | null;
  ditemuiNama: string | null;
  hasil: string;
  catatan: string | null;
  fotoUrls: string[];
  odpTerdekat: string | null;
  estimasiKabelMeter: number | null;
  catatanTeknis: string | null;
  siteId: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Ubah satu baris kegiatan dari database menjadi entitas domain. */
export function toKegiatanEntity(row: KegiatanRow): KegiatanEntity {
  return {
    id: row.id,
    jenis: row.jenis as KegiatanJenis,
    userId: row.userId,
    prospekId: row.prospekId,
    iklanId: row.iklanId,
    waktuMulai: row.waktuMulai,
    waktuSelesai: row.waktuSelesai,
    latitude: row.latitude,
    longitude: row.longitude,
    alamatDikunjungi: row.alamatDikunjungi,
    ditemuiNama: row.ditemuiNama,
    hasil: row.hasil as KegiatanHasil,
    catatan: row.catatan,
    fotoUrls: row.fotoUrls,
    odpTerdekat: row.odpTerdekat,
    estimasiKabelMeter: row.estimasiKabelMeter,
    catatanTeknis: row.catatanTeknis,
    siteId: row.siteId,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
