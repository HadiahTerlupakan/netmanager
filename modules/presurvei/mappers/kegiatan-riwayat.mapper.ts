import type { RiwayatKegiatanEntity } from "../domain/entities/KegiatanRiwayat";
import type { PerubahanKegiatan } from "../domain/kegiatan-perubahan";
import {
  namaSalesSatuTenant,
  type IdentitasSalesBertenant,
} from "../domain/nama-sales";

/**
 * Pemetaan baris Prisma riwayat kegiatan ke entitas domain.
 *
 * Bentuk baris dideklarasikan struktural supaya folder mapper tidak perlu
 * mengimpor tipe Prisma.
 */
export interface RiwayatKegiatanRow {
  id: string;
  kegiatanId: string;
  tenantId: string | null;
  diubahOlehId: string | null;
  diubahPada: Date;
  /** Kolom Json; hanya ditulis `KegiatanRepository.ubahDenganRiwayat`. */
  perubahan: unknown;
  /** Hasil `include` (`SERTAKAN_PENGUBAH`); join tidak disaring ekstensi tenant. */
  diubahOleh?: IdentitasSalesBertenant | null;
}

/** Ubah satu baris riwayat menjadi entitas domain, dengan penjaga tenant nama. */
export function toRiwayatKegiatanEntity(
  row: RiwayatKegiatanRow,
): RiwayatKegiatanEntity {
  return {
    id: row.id,
    kegiatanId: row.kegiatanId,
    tenantId: row.tenantId,
    diubahOlehId: row.diubahOlehId,
    namaPengubah: namaSalesSatuTenant(row.diubahOleh, row.tenantId),
    diubahPada: row.diubahPada,
    perubahan: row.perubahan as PerubahanKegiatan,
  };
}
