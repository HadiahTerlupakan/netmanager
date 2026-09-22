import type {
  KegiatanEntity,
  KegiatanHasil,
  KegiatanJenis,
} from "../entities/Kegiatan";
import type { ProspekEntity } from "../entities/Prospek";
import type { CreateProspekInput } from "./IProspekRepository";

/**
 * Kontrak akses data kegiatan presurvei.
 *
 * Service hanya bergantung pada antarmuka ini supaya aturan bisnisnya bisa
 * diuji tanpa database.
 */

export interface KegiatanListFilters {
  userId?: string;
  jenis?: KegiatanJenis;
  hasil?: KegiatanHasil;
  prospekId?: string;
  dariTanggal?: Date;
  sampaiTanggal?: Date;
  page: number;
  limit: number;
}

export interface CreateKegiatanInput {
  jenis: KegiatanJenis;
  userId: string;
  prospekId?: string | null;
  iklanId?: string | null;
  waktuMulai: Date;
  waktuSelesai?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
  alamatDikunjungi?: string | null;
  ditemuiNama?: string | null;
  hasil: KegiatanHasil;
  catatan?: string | null;
  fotoUrls?: string[];
  odpTerdekat?: string | null;
  estimasiKabelMeter?: number | null;
  catatanTeknis?: string | null;
  siteId?: string | null;
}

/** Rentang waktu tertutup untuk perhitungan laporan. */
export interface RentangPeriode {
  mulai: Date;
  selesai: Date;
}

export interface IKegiatanRepository {
  findMany(
    filters: KegiatanListFilters,
  ): Promise<{ items: KegiatanEntity[]; total: number }>;
  findById(id: string): Promise<KegiatanEntity | null>;
  create(input: CreateKegiatanInput): Promise<KegiatanEntity>;
  /** Simpan kegiatan dan prospek barunya dalam satu transaksi, lalu tautkan. */
  createDenganProspek(
    kegiatan: CreateKegiatanInput,
    prospek: CreateProspekInput,
  ): Promise<{ kegiatan: KegiatanEntity; prospek: ProspekEntity }>;
  /** Jumlah kegiatan per pelaku pada satu rentang, berkunci userId. */
  hitungPerUser(rentang: RentangPeriode): Promise<Record<string, number>>;
}
