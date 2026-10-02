import type {
  RencanaEntity,
  RencanaJenis,
  RencanaStatusTampil,
  RencanaSumber,
} from "../entities/Rencana";

/**
 * Kontrak akses data rencana kunjungan presurvei.
 *
 * Service hanya bergantung pada antarmuka ini supaya aturan bisnisnya bisa
 * diuji tanpa database.
 */

export interface RencanaListFilters {
  tenantId: string;
  /** Batas lingkup: undefined = semua sales tenant. */
  salesIds?: string[];
  /** Mempersempit ke satu sales (tetap di dalam `salesIds`). */
  salesId?: string;
  dari?: string;
  sampai?: string;
  status?: RencanaStatusTampil;
  /** Tanggal hari ini (zona tenant) untuk memisahkan DIRENCANAKAN vs TERLEWAT. */
  hariIni: string;
  page: number;
  limit: number;
}

export interface CreateRencanaInput {
  salesId: string;
  dibuatOlehId: string;
  sumber: RencanaSumber;
  jenis: RencanaJenis;
  tanggal: string;
  jam: string | null;
  tujuan: string;
  prospekId: string | null;
  alamat: string | null;
  latitude: number | null;
  longitude: number | null;
  tenantId: string;
}

export interface UbahRencanaInput {
  tanggal?: string;
  jam?: string | null;
  jenis?: RencanaJenis;
  tujuan?: string;
  prospekId?: string | null;
  alamat?: string | null;
}

export interface BatalRencanaInput {
  alasan: string;
  olehId: string;
  pada: Date;
}

export interface IRencanaRepository {
  findMany(
    filters: RencanaListFilters,
  ): Promise<{ items: RencanaEntity[]; total: number }>;

  findById(id: string): Promise<RencanaEntity | null>;

  create(input: CreateRencanaInput): Promise<RencanaEntity>;

  /** Ubah rencana tenant ini yang masih DIRENCANAKAN; null bila sudah tidak terbuka. */
  ubahSelagiTerbuka(
    id: string,
    tenantId: string,
    input: UbahRencanaInput,
  ): Promise<RencanaEntity | null>;

  /** Batalkan rencana tenant ini yang masih DIRENCANAKAN; null bila sudah tidak terbuka. */
  batalkanSelagiTerbuka(
    id: string,
    tenantId: string,
    input: BatalRencanaInput,
  ): Promise<RencanaEntity | null>;

  /** Semua rencana pada rentang tanggal (untuk rekap), dalam batas lingkup. */
  findUntukRekap(filters: {
    tenantId: string;
    salesIds?: string[];
    dari: string;
    sampai: string;
  }): Promise<RencanaEntity[]>;

  /** Id anggota tim seorang kepala sales (aktif maupun tidak). */
  anggotaTim(kepalaSalesId: string, tenantId: string): Promise<string[]>;
}
