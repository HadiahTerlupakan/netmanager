import { logger } from "@/lib/logger";
import type {
  IMitraWalletRepository,
  EarningReferenceType,
} from "../domain/ports/IMitraWalletRepository";
import { getMitraWalletRepository } from "../repositories/MitraWalletRepository";
import { validatePositiveAmount } from "../validators/mitraValidation";

interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

const ELIGIBLE_MITRA_TYPES = ["MITRA_TEKNISI", "MITRA_SALES"];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export class MitraWalletService {
  constructor(
    private readonly mitraWalletRepository: IMitraWalletRepository = getMitraWalletRepository(),
  ) {}

  /** Mengambil saldo wallet mitra dan membuat wallet otomatis bila valid. */
  async getBalance(
    userId: string,
    tenantId?: string,
  ): Promise<
    ServiceResult<{
      balance: number;
      totalEarnings: number;
      totalWithdrawn: number;
    }>
  > {
    try {
      const wallet = await this.findOrCreateEligibleWallet(userId, tenantId);
      if (!wallet) return { success: false, error: "User bukan mitra" };
      return {
        success: true,
        data: {
          balance: wallet.balance,
          totalEarnings: wallet.totalEarnings,
          totalWithdrawn: wallet.totalWithdrawn,
        },
      };
    } catch (error) {
      logger.error(
        "[MitraWalletService] Error getting balance:",
        error as Error,
      );
      return { success: false, error: "Gagal mengambil saldo" };
    }
  }

  /** Menambahkan pendapatan ke wallet mitra secara idempoten per referensi. */
  async addEarning(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: EarningReferenceType,
  ): Promise<ServiceResult> {
    try {
      const amountError = validatePositiveAmount(amount);
      if (amountError) return { success: false, error: amountError };
      await this.mitraWalletRepository.addEarning({
        userId,
        amount,
        description,
        referenceId,
        referenceType,
      });
      logger.info(
        `[MitraWalletService] Earning added: userId=${userId}, amount=${amount}, ref=${referenceId}`,
      );
      return { success: true };
    } catch (error) {
      return this.handleServiceError(
        error,
        "Gagal menambah pendapatan",
        "Error adding earning",
      );
    }
  }

  /** Mengurangi saldo wallet untuk penalti SLA atau koreksi serupa. */
  async deductBalance(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: EarningReferenceType,
  ): Promise<ServiceResult> {
    try {
      const amountError = validatePositiveAmount(amount);
      if (amountError) return { success: false, error: amountError };
      await this.mitraWalletRepository.deductBalance({
        userId,
        amount,
        description,
        referenceId,
        referenceType,
      });
      logger.info(
        `[MitraWalletService] Penalty deducted: userId=${userId}, amount=${amount}, ref=${referenceId}`,
      );
      return { success: true };
    } catch (error) {
      return this.handleServiceError(
        error,
        "Gagal memotong saldo",
        "Error deducting balance",
      );
    }
  }

  /** Menambahkan penyesuaian manual oleh admin ke wallet mitra. */
  async addAdjustment(
    userId: string,
    amount: number,
    description: string,
    adminId: string,
    tenantId?: string,
  ): Promise<ServiceResult> {
    try {
      if (!Number.isFinite(amount) || amount === 0) {
        return { success: false, error: "Jumlah penyesuaian tidak valid" };
      }
      await this.mitraWalletRepository.addAdjustment({
        userId,
        amount,
        description,
        tenantId,
      });
      logger.info(
        `[MitraWalletService] Adjustment: userId=${userId}, amount=${amount}, by=${adminId}`,
      );
      return { success: true };
    } catch (error) {
      return this.handleServiceError(
        error,
        "Gagal melakukan penyesuaian",
        "Error adjusting",
      );
    }
  }

  /** Mengambil riwayat transaksi wallet mitra dengan paginasi. */
  async getTransactions(
    userId: string,
    tenantId?: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ) {
    try {
      const pagedTransactions =
        await this.mitraWalletRepository.getTransactionsByUserId(
          userId,
          tenantId,
          page,
          limit,
        );
      if (!pagedTransactions)
        return {
          success: true,
          data: { transactions: [], total: 0, page, totalPages: 0 },
        };
      return { success: true, data: pagedTransactions };
    } catch (error) {
      logger.error(
        "[MitraWalletService] Error getting transactions:",
        error as Error,
      );
      return { success: false, error: "Gagal mengambil riwayat transaksi" };
    }
  }

  /** Mengambil ringkasan pendapatan wallet mitra pada periode bulan tertentu. */
  async getEarningsSummary(
    userId: string,
    tenantId?: string,
    month?: number,
    year?: number,
  ) {
    try {
      const { startDate, endDate } = this.buildMonthlyPeriod(month, year);
      const summary =
        await this.mitraWalletRepository.getEarningsSummaryByUserId({
          userId,
          tenantId,
          startDate,
          endDate,
        });
      if (!summary) return { success: true, data: this.buildEmptySummary() };
      return { success: true, data: summary };
    } catch (error) {
      logger.error(
        "[MitraWalletService] Error getting earnings summary:",
        error as Error,
      );
      return { success: false, error: "Gagal mengambil ringkasan pendapatan" };
    }
  }

  /** Menghitung earning bulanan berdasarkan kata kunci deskripsi. */
  async countMonthlyEarningsByDescription(
    userId: string,
    keyword: string,
    startDate: Date,
  ) {
    try {
      const total =
        await this.mitraWalletRepository.countMonthlyEarningsByDescription({
          mitraId: userId,
          keyword,
          startDate,
        });
      return { success: true, data: total };
    } catch (error) {
      logger.error(
        "[MitraWalletService] Error counting monthly earnings:",
        error as Error,
      );
      return { success: false, error: "Gagal menghitung transaksi bulanan" };
    }
  }

  private async findOrCreateEligibleWallet(userId: string, tenantId?: string) {
    const existingWallet = await this.mitraWalletRepository.findWalletByUserId(
      userId,
      tenantId,
    );
    if (existingWallet) return existingWallet;
    const mitra = await this.mitraWalletRepository.findMitraTypeById(
      userId,
      tenantId,
    );
    if (!mitra || !ELIGIBLE_MITRA_TYPES.includes(mitra.mitraType)) return null;
    return this.mitraWalletRepository.createWallet(userId);
  }

  private buildMonthlyPeriod(month?: number, year?: number) {
    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();
    return {
      startDate: new Date(targetYear, targetMonth - 1, 1),
      endDate: new Date(targetYear, targetMonth, 0, 23, 59, 59),
    };
  }

  private buildEmptySummary() {
    return {
      balance: 0,
      totalEarnings: 0,
      totalWithdrawn: 0,
      earningsThisMonth: 0,
      earningsCount: 0,
    };
  }

  private handleServiceError(
    error: unknown,
    fallbackMessage: string,
    logContext: string,
  ): ServiceResult {
    const message = error instanceof Error ? error.message : fallbackMessage;
    logger.error(`[MitraWalletService] ${logContext}:`, error as Error);
    return { success: false, error: message };
  }
}

let instance: MitraWalletService | null = null;

export function getMitraWalletService(): MitraWalletService {
  if (!instance) {
    instance = new MitraWalletService();
  }

  return instance;
}
