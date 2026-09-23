import type { PerubahanKegiatan } from "../kegiatan-perubahan";

/**
 * Satu baris jejak audit perubahan kegiatan presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */
export interface RiwayatKegiatanEntity {
  id: string;
  kegiatanId: string;
  /** Tenant baris kegiatan saat diubah; nullable seperti kegiatannya. */
  tenantId: string | null;
  /** Null bila pengubahnya sudah dihapus (FK `onDelete: SetNull`). */
  diubahOlehId: string | null;
  /**
   * Label pengubah (`tentukanNamaSales`), null bila tidak bisa ditampilkan —
   * termasuk pengubah dari tenant lain (`namaSalesSatuTenant`).
   */
  namaPengubah: string | null;
  diubahPada: Date;
  perubahan: PerubahanKegiatan;
}
