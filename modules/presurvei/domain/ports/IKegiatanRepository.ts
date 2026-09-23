import type {
  KegiatanEntity,
  KegiatanHasil,
  KegiatanJenis,
} from "../entities/Kegiatan";
import type { RiwayatKegiatanEntity } from "../entities/KegiatanRiwayat";
import type { ProspekEntity } from "../entities/Prospek";
import type {
  PerubahanKegiatan,
  UbahKegiatanInput,
} from "../kegiatan-perubahan";
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

/** Satu penulisan perubahan kegiatan beserta baris jejak auditnya. */
export interface UbahKegiatanDenganRiwayatInput {
  id: string;
  /**
   * Versi baris yang menjadi dasar perubahan ini: `updatedAt` yang dilihat
   * klien (`versi` di badan PATCH) bila dikirim, selain itu `updatedAt`
   * bacaan service sendiri — yang hanya menjaga jendela di dalam satu
   * request. Penulisan hanya terjadi bila baris masih pada versi ini.
   */
  versi: Date;
  nilaiBaru: UbahKegiatanInput;
  riwayat: {
    tenantId: string | null;
    diubahOlehId: string;
    perubahan: PerubahanKegiatan;
  };
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
  /**
   * Tulis perubahan kegiatan dan baris riwayatnya dalam SATU transaksi.
   * Null bila kegiatan sudah diubah pihak lain sejak `versi` (tidak ada yang
   * ditulis).
   */
  ubahDenganRiwayat(
    input: UbahKegiatanDenganRiwayatInput,
  ): Promise<KegiatanEntity | null>;
  /** Riwayat perubahan satu kegiatan, terbaru lebih dulu. */
  findRiwayat(kegiatanId: string): Promise<RiwayatKegiatanEntity[]>;
  /** Jumlah kegiatan per pelaku pada satu rentang, berkunci userId. */
  hitungPerUser(rentang: RentangPeriode): Promise<Record<string, number>>;
}
