import type {
  WithdrawRequestEntity,
  WithdrawRequestListEntity,
} from "../entities/WithdrawRequestEntity";
import type { WithdrawRequestDTO } from "../../dto/MitraDTO";

export interface CreateWithdrawRequestRecord {
  id: string;
  userId: string;
  walletId: string;
  payload: WithdrawRequestDTO;
}

export interface WithdrawRequestFilter {
  userId?: string;
  status?: string;
  page: number;
  limit: number;
  tenantId?: string;
}

export interface UpdateWithdrawStatusRecord {
  id: string;
  status: string;
  processedById: string;
  processedAt: Date;
  rejectionReason?: string;
}

export interface MobileWithdrawHistoryQuery {
  mitraId: string;
  tenantId?: string;
  page: number;
  limit: number;
}

export interface MobileWithdrawHistoryResult {
  bankInfo: {
    bankName: string | null;
    accountNo: string | null;
    accountName: string | null;
  };
  withdrawals: WithdrawRequestEntity[];
  total: number;
}

export interface IMitraWithdrawRepository {
  /** Mengambil mitra untuk validasi penarikan. */
  findMitraById(
    userId: string,
    tenantId?: string,
  ): Promise<{ id: string; minWithdrawal: number | null } | null>;

  /** Mengambil wallet mitra. */
  findWalletByMitraId(
    mitraId: string,
    tenantId?: string,
  ): Promise<{ id: string; balance: number } | null>;

  /** Menghitung request penarikan yang masih aktif. */
  countPendingWithdrawals(walletId: string): Promise<number>;

  /** Membuat request penarikan baru. */
  createWithdrawRequest(record: CreateWithdrawRequestRecord): Promise<void>;

  /** Mengambil request penarikan lengkap berdasarkan id. */
  findWithdrawRequestById(
    id: string,
    tenantId?: string,
  ): Promise<WithdrawRequestEntity | null>;

  /** Mengambil request penarikan sederhana berdasarkan id. */
  findWithdrawRequestByIdSimple(
    id: string,
    tenantId?: string,
  ): Promise<WithdrawRequestEntity | null>;

  /** Memperbarui status request penarikan. */
  updateWithdrawStatus(record: UpdateWithdrawStatusRecord): Promise<void>;

  /** Mengambil daftar request penarikan dengan filter. */
  findWithdrawRequests(
    filter: WithdrawRequestFilter,
  ): Promise<WithdrawRequestListEntity>;

  /** Menyelesaikan penarikan dan mutasi wallet secara atomik. */
  completeWithdraw(params: {
    walletId: string;
    amount: number;
    requestId: string;
    method: string;
    processedById: string;
  }): Promise<void>;

  /** Mengambil riwayat penarikan mobile beserta info bank mitra. */
  getMobileWithdrawHistory(
    query: MobileWithdrawHistoryQuery,
  ): Promise<MobileWithdrawHistoryResult | null>;
}
