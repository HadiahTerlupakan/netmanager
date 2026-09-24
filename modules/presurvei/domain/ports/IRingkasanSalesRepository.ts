import type { KegiatanJenis } from "../entities/Kegiatan";
import type { ProspekSentuhan } from "../ringkasan-sales";
import type { RentangPeriode } from "./IKegiatanRepository";

/**
 * Kontrak baca-saja untuk ringkasan Beranda sales.
 *
 * Dipisah dari `IKegiatanRepository`/`IProspekRepository` supaya kebutuhan
 * satu layar tidak melebarkan port yang dipakai seluruh modul. Setiap
 * method menerima `tenantId` dan wajib menuliskannya eksplisit.
 */
export interface IRingkasanSalesRepository {
  /** Jumlah kegiatan `userId` per jenis dalam rentang; jenis kosong tidak muncul. */
  hitungKegiatanPerJenis(
    userId: string,
    rentang: RentangPeriode,
    tenantId: string,
  ): Promise<Partial<Record<KegiatanJenis, number>>>;
  /** Prospek beban aktif milik `pemilikId`, `updatedAt` terlama lebih dulu. */
  daftarProspekAktif(
    pemilikId: string,
    tenantId: string,
  ): Promise<ProspekSentuhan[]>;
  /** Waktu mulai kegiatan terakhir per prospek; prospek tanpa kegiatan tidak muncul. */
  waktuKegiatanTerakhir(
    prospekIds: readonly string[],
    tenantId: string,
  ): Promise<Record<string, Date>>;
}
