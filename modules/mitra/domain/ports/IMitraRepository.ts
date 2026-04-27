import type {
  FaceVerificationLogListEntity,
  MitraEntity,
  MitraListEntity,
  MitraPushTokenEntity,
  MitraStatsEntity,
  MitraSummaryEntity,
} from "../entities/MitraEntity";
import type {
  CreateMitraDTO,
  MitraFilters,
  UpdateMitraDTO,
} from "../../dto/MitraDTO";

export interface CreateMitraRecord {
  id: string;
  passwordHash: string;
  payload: CreateMitraDTO;
}

export interface UpdateMitraRecord {
  id: string;
  passwordHash?: string;
  payload: UpdateMitraDTO;
}

export interface FeePelangganStatsQuery {
  mitraId: string;
  ownerNames: string[];
  feeRate: number;
  monthStart: Date;
  today: Date;
}

export interface SaveFaceVerificationRecord {
  mitraId: string;
  photoUrl: string;
}

export interface IMitraRepository {
  /** Menghapus push token milik mitra yang tidak valid. */
  clearPushTokens(tokens: string[]): Promise<unknown>;

  /** Mengambil daftar mitra berdasarkan token push. */
  findManyWithPushToken(tokens: string[]): Promise<MitraPushTokenEntity[]>;

  /** Mengambil push token mitra berdasarkan id. */
  findPushTokenById(id: string): Promise<{ pushToken: string | null } | null>;

  /** Mengambil daftar mitra bertoken push dari kumpulan id. */
  findManyWithPushTokenByIds(ids: string[]): Promise<MitraPushTokenEntity[]>;

  /** Mengambil mitra sederhana berdasarkan id. */
  findByIdSimple(id: string, tenantId?: string): Promise<MitraEntity | null>;

  /** Mengambil seluruh id mitra pada site tertentu. */
  findIdsBySite(siteId: string): Promise<string[]>;

  /** Mengambil ringkasan mitra untuk kebutuhan canvasing. */
  findCanvasingSummary(id: string): Promise<MitraSummaryEntity | null>;

  /** Mengambil daftar mitra dengan filter dan paginasi. */
  findAll(
    filters: MitraFilters,
    page: number,
    limit: number,
  ): Promise<MitraListEntity>;

  /** Mengambil detail mitra berdasarkan id. */
  findById(id: string, tenantId?: string): Promise<MitraEntity | null>;

  /** Mengambil statistik agregat mitra. */
  getStats(tenantId?: string): Promise<MitraStatsEntity>;

  /** Membuat data mitra baru dan wallet awalnya. */
  createMitra(record: CreateMitraRecord): Promise<void>;

  /** Memperbarui data mitra dan memastikan wallet tetap tersedia. */
  updateMitra(record: UpdateMitraRecord): Promise<void>;

  /** Menonaktifkan mitra secara soft delete. */
  softDeleteMitra(id: string): Promise<void>;

  /** Mengambil log verifikasi wajah dengan paginasi. */
  getFaceVerificationLogs(
    mitraId: string,
    page: number,
    limit: number,
  ): Promise<FaceVerificationLogListEntity>;

  /** Mengambil jumlah penarikan pending milik mitra. */
  countPendingWithdrawals(mitraId: string, tenantId?: string): Promise<number>;

  /** Mengambil statistik fee pelanggan bulanan mitra sales. */
  getFeePelangganStats(query: FeePelangganStatsQuery): Promise<{
    activeCustomers: number;
    totalFeePelanggan: number;
    remainingFeePelanggan: number;
    unpaidCustomersCount: number;
  }>;

  /** Menyimpan hasil verifikasi wajah mitra. */
  saveFaceVerification(record: SaveFaceVerificationRecord): Promise<void>;
}
