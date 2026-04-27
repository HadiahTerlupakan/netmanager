import type {
  MitraTransactionEntity,
  MitraTypeEntity,
  MitraWalletEntity,
  WalletSummaryEntity,
  WalletTransactionPageEntity,
} from "../entities/MitraWalletEntity";

export type EarningReferenceType = "WORK_ORDER" | "CANVASING";

export interface WalletMutationInput {
  userId: string;
  amount: number;
  description: string;
  referenceId?: string;
  referenceType?: EarningReferenceType;
}

export interface WalletAdjustmentInput {
  userId: string;
  amount: number;
  description: string;
  tenantId?: string;
}

export interface WalletSummaryQuery {
  userId: string;
  tenantId?: string;
  startDate: Date;
  endDate: Date;
}

export interface IMitraWalletRepository {
  /** Mengambil wallet mitra berdasarkan user dan tenant opsional. */
  findWalletByUserId(
    mitraId: string,
    tenantId?: string,
  ): Promise<MitraWalletEntity | null>;

  /** Mengambil tipe mitra untuk validasi wallet otomatis. */
  findMitraTypeById(
    mitraId: string,
    tenantId?: string,
  ): Promise<MitraTypeEntity | null>;

  /** Membuat wallet kosong untuk mitra. */
  createWallet(mitraId: string): Promise<MitraWalletEntity>;

  /** Menambahkan pendapatan wallet secara atomik. */
  addEarning(params: WalletMutationInput): Promise<void>;

  /** Mengurangi saldo wallet untuk penalti secara atomik. */
  deductBalance(params: WalletMutationInput): Promise<void>;

  /** Menambahkan penyesuaian manual admin ke wallet. */
  addAdjustment(params: WalletAdjustmentInput): Promise<void>;

  /** Mengambil riwayat transaksi wallet dengan paginasi. */
  getTransactionsByUserId(
    userId: string,
    tenantId: string | undefined,
    page: number,
    limit: number,
  ): Promise<WalletTransactionPageEntity | null>;

  /** Mengambil ringkasan pendapatan wallet pada periode tertentu. */
  getEarningsSummaryByUserId(
    params: WalletSummaryQuery,
  ): Promise<WalletSummaryEntity | null>;

  /** Mengecek transaksi komisi duplikat berdasarkan referensi. */
  findTransactionByReferenceId(
    referenceId: string,
  ): Promise<MitraTransactionEntity | null>;

  /** Menghitung transaksi earning bulanan berdasarkan keyword deskripsi. */
  countMonthlyEarningsByDescription(params: {
    mitraId: string;
    keyword: string;
    startDate: Date;
  }): Promise<number>;
}
