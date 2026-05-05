import { getMitraRepository } from "../repositories/MitraRepository";
import { getMitraWithdrawRepository } from "../repositories/MitraWithdrawRepository";
import type { MitraEntity } from "../domain/entities/MitraEntity";
import type { IMitraRepository } from "../domain/ports/IMitraRepository";
import type {
  IMitraWithdrawRepository,
  MobileWithdrawHistoryResult,
} from "../domain/ports/IMitraWithdrawRepository";
import { getMitraWalletService } from "./MitraWalletService";
import { getMitraWithdrawService } from "./MitraWithdrawService";
import {
  buildFailureResult,
  type FaceVerificationFile,
  getFeePelangganStatsForMitra,
  getVerifiedFaceMessage,
  getWithdrawAmountError,
  getWithdrawMethodError,
  logMobileFaceVerification,
  saveFaceVerificationPhoto,
} from "./MobileMitraRouteService.helpers";
import type {
  MobileMitraSession,
  MobileWithdrawRequestPayload,
  ServiceResult,
} from "./MobileMitraRouteService.types";

const DEFAULT_PAGE = 1;
const MOBILE_LIMIT = 20;
const DASHBOARD_RECENT_TRANSACTION_LIMIT = 5;
const DASHBOARD_TRANSACTION_PAGE = 1;

export class MobileMitraRouteService {
  constructor(
    private readonly mitraRepository: IMitraRepository = getMitraRepository(),
    private readonly withdrawRepository: IMitraWithdrawRepository = getMitraWithdrawRepository(),
  ) {}

  /** Mengambil payload dashboard mobile milik mitra. */
  async getDashboard(
    session: MobileMitraSession,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const mitra = await this.validateActiveMitra(session);
    if (mitra.success === false) {
      return buildFailureResult(mitra.error, mitra.status);
    }

    const tenantId = session.tenantId ?? undefined;
    const mitraData = mitra.data;
    const [
      balance,
      monthly,
      pendingWithdrawals,
      recentTransactions,
      completedJobs,
      feeStats,
    ] = await Promise.all([
      getMitraWalletService().getBalance(mitraData.id, tenantId),
      getMitraWalletService().getEarningsSummary(mitraData.id, tenantId),
      this.mitraRepository.countPendingWithdrawals(mitraData.id, tenantId),
      getMitraWalletService().getTransactions(
        mitraData.id,
        tenantId,
        DASHBOARD_TRANSACTION_PAGE,
        DASHBOARD_RECENT_TRANSACTION_LIMIT,
      ),
      this.getCompletedJobsThisMonth(mitraData.id, mitraData.mitraType),
      getFeePelangganStatsForMitra(this.mitraRepository, mitraData),
    ]);

    return {
      success: true,
      data: {
        employeeType: mitraData.mitraType,
        ratePsb: mitraData.mitraRateWoPsb,
        rateMaintenance: mitraData.mitraRateWoMaintenance,
        rateCanvasing: mitraData.mitraRateCanvasing,
        minWithdrawal: mitraData.minWithdrawal,
        balance: balance.success ? balance.data?.balance || 0 : 0,
        totalEarnings:
          (balance.success ? balance.data?.totalEarnings || 0 : 0) +
          feeStats.remainingFeePelanggan,
        totalWithdrawn: balance.success ? balance.data?.totalWithdrawn || 0 : 0,
        completedJobsThisMonth: completedJobs,
        activeCustomers: feeStats.unpaidCustomersCount,
        totalActiveCustomers: feeStats.activeCustomers,
        targetHarian: mitraData.targetHarian,
        enableFeePelanggan: mitraData.enableFeePelanggan || false,
        pendingWithdrawals,
        monthlyEarnings: monthly.success ? monthly.data || null : null,
        recentTransactions: recentTransactions.success
          ? recentTransactions.data?.transactions || []
          : [],
      },
    };
  }

  /** Mengambil saldo dan riwayat wallet mobile milik mitra. */
  async getWallet(
    session: MobileMitraSession,
    page = DEFAULT_PAGE,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const mitra = await this.validateActiveMitra(session);
    if (mitra.success === false) {
      return buildFailureResult(mitra.error, mitra.status);
    }

    const tenantId = session.tenantId ?? undefined;
    const [balanceResult, txResult] = await Promise.all([
      getMitraWalletService().getBalance(mitra.data.id, tenantId),
      getMitraWalletService().getTransactions(
        mitra.data.id,
        tenantId,
        page,
        MOBILE_LIMIT,
      ),
    ]);

    return {
      success: true,
      data: {
        balance: balanceResult.success
          ? balanceResult.data
          : { balance: 0, totalEarnings: 0, totalWithdrawn: 0 },
        transactions: txResult.success
          ? txResult.data
          : { transactions: [], total: 0 },
      },
    };
  }

  /** Mengambil riwayat penarikan mobile milik mitra. */
  async getWithdrawHistory(
    session: MobileMitraSession,
    page = DEFAULT_PAGE,
  ): Promise<ServiceResult<MobileWithdrawHistoryResult>> {
    const mitra = await this.validateActiveMitra(session);
    if (mitra.success === false) {
      return buildFailureResult(mitra.error, mitra.status);
    }

    const tenantId = session.tenantId ?? undefined;
    const history = await this.withdrawRepository.getMobileWithdrawHistory({
      mitraId: mitra.data.id,
      tenantId,
      page,
      limit: MOBILE_LIMIT,
    });

    if (!history) {
      return buildFailureResult("Mitra tidak ditemukan", 404);
    }

    return { success: true, data: history };
  }

  /** Membuat permintaan penarikan baru dari mobile mitra. */
  async requestWithdraw(
    session: MobileMitraSession,
    payload: MobileWithdrawRequestPayload,
  ): Promise<ServiceResult<{ message: string }>> {
    const mitra = await this.validateActiveMitra(session);
    if (mitra.success === false) {
      return buildFailureResult(mitra.error, mitra.status);
    }

    const amountError = getWithdrawAmountError(payload.amount);
    if (amountError) {
      return buildFailureResult(amountError, 400);
    }

    const methodError = getWithdrawMethodError(payload.method);
    if (methodError) {
      return buildFailureResult(methodError, 400);
    }

    const result = await getMitraWithdrawService().requestWithdraw(
      mitra.data.id,
      payload,
      session.tenantId ?? undefined,
    );
    if (!result.success) {
      return buildFailureResult(
        result.error || "Gagal membuat permintaan penarikan",
        400,
      );
    }

    return {
      success: true,
      data: { message: "Permintaan penarikan berhasil dibuat" },
    };
  }

  /** Menyimpan hasil verifikasi wajah mobile mitra. */
  async verifyFace(
    session: MobileMitraSession,
    photo: FaceVerificationFile | null,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const mitra = await this.validateActiveMitra(session);
    if (mitra.success === false) {
      return buildFailureResult(mitra.error, mitra.status);
    }

    if (!photo) {
      return buildFailureResult("Foto tidak ditemukan", 400);
    }

    try {
      const fileUrl = await saveFaceVerificationPhoto(mitra.data.id, photo);
      await this.mitraRepository.saveFaceVerification({
        mitraId: mitra.data.id,
        photoUrl: fileUrl,
      });
      logMobileFaceVerification(session, fileUrl);

      return {
        success: true,
        data: {
          message: getVerifiedFaceMessage(),
          url: fileUrl,
          verifiedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        return buildFailureResult(error.message, 400);
      }

      return buildFailureResult("Gagal menyimpan foto verifikasi", 500);
    }
  }

  private async validateActiveMitra(
    session: MobileMitraSession,
  ): Promise<ServiceResult<MitraEntity>> {
    const mitra = await this.mitraRepository.findByIdSimple(
      session.id,
      session.tenantId ?? undefined,
    );
    if (!mitra) {
      return buildFailureResult("Mitra tidak ditemukan", 404);
    }

    if (!mitra.isActive) {
      return buildFailureResult("Akun Mitra tidak aktif", 403);
    }

    return { success: true, data: mitra };
  }

  /** Menghitung job selesai bulan berjalan dari transaksi earning. */
  private async getCompletedJobsThisMonth(mitraId: string, mitraType: string) {
    const keyword = mitraType === "MITRA_TEKNISI" ? "WO" : "Canvasing";
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const result =
      await getMitraWalletService().countMonthlyEarningsByDescription(
        mitraId,
        keyword,
        monthStart,
      );
    return result.success ? result.data || 0 : 0;
  }
}

let instance: MobileMitraRouteService | null = null;

export function getMobileMitraRouteService() {
  if (!instance) instance = new MobileMitraRouteService();
  return instance;
}
