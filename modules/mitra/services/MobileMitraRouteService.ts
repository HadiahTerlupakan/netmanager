import { logger } from "@/lib/logger";
import fs from "fs";
import path from "path";
import { logActivitySafe } from "@/lib/logger";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import type { MitraEntity } from "../domain/entities/MitraEntity";
import type { IMitraRepository } from "../domain/ports/IMitraRepository";
import type {
  IMitraWithdrawRepository,
  MobileWithdrawHistoryResult,
} from "../domain/ports/IMitraWithdrawRepository";
import { getMitraRepository } from "../repositories/MitraRepository";
import { getMitraWithdrawRepository } from "../repositories/MitraWithdrawRepository";
import { getMitraWalletService } from "./MitraWalletService";
import { getMitraWithdrawService } from "./MitraWithdrawService";

interface ServiceSuccess<T> {
  success: true;
  data: T;
}

interface ServiceFailure {
  success: false;
  error: string;
  status: number;
}

type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

interface MobileMitraSession {
  id: string;
  userId?: string;
  tenantId?: string | null;
  role: string;
}

interface FaceVerificationFile {
  arrayBuffer(): Promise<ArrayBuffer>;
  name: string;
}

const DEFAULT_PAGE = 1;
const MOBILE_LIMIT = 20;
const DASHBOARD_RECENT_TRANSACTION_LIMIT = 5;
const DASHBOARD_TRANSACTION_PAGE = 1;
const VERIFIED_MESSAGE = "Verifikasi wajah berhasil";
const UPLOAD_ROOT_SEGMENTS = ["public", "uploads", "mitra"] as const;
const FACE_VERIFICATION_PREFIX = "face_verification";
const DEFAULT_FILE_EXTENSION = "jpg";

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
    if (mitra.success === false)
      return this.buildFailureResult(mitra.error, mitra.status);
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
      this.getCompletedJobsThisMonth(
        mitraData.id,
        mitraData.mitraType,
        tenantId,
      ),
      this.getFeePelangganStats(mitraData),
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
    if (mitra.success === false)
      return this.buildFailureResult(mitra.error, mitra.status);
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
    const tenantId = session.tenantId ?? undefined;
    const history = await this.withdrawRepository.getMobileWithdrawHistory({
      mitraId: session.id,
      tenantId,
      page,
      limit: MOBILE_LIMIT,
    });
    if (!history)
      return { success: false, error: "Mitra tidak ditemukan", status: 404 };
    return { success: true, data: history };
  }

  /** Membuat permintaan penarikan baru dari mobile mitra. */
  async requestWithdraw(
    session: MobileMitraSession,
    payload: {
      amount: number;
      method: "TRANSFER" | "CASH";
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
      notes?: string;
    },
  ): Promise<ServiceResult<{ message: string }>> {
    if (!payload.amount || payload.amount <= 0) {
      return {
        success: false,
        error: "Jumlah penarikan harus lebih dari 0",
        status: 400,
      };
    }
    if (!["TRANSFER", "CASH"].includes(payload.method)) {
      return {
        success: false,
        error: "Metode penarikan tidak valid",
        status: 400,
      };
    }
    const result = await getMitraWithdrawService().requestWithdraw(
      session.id,
      payload,
      session.tenantId ?? undefined,
    );
    if (!result.success) {
      return {
        success: false,
        error: result.error || "Gagal membuat permintaan penarikan",
        status: 400,
      };
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
    if (!photo)
      return { success: false, error: "Foto tidak ditemukan", status: 400 };
    const fileUrl = await this.savePhotoFile(session.id, photo);
    await this.mitraRepository.saveFaceVerification({
      mitraId: session.id,
      photoUrl: fileUrl,
    });
    this.logFaceVerification(session, fileUrl);
    return {
      success: true,
      data: {
        message: VERIFIED_MESSAGE,
        url: fileUrl,
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  private async validateActiveMitra(
    session: MobileMitraSession,
  ): Promise<ServiceResult<MitraEntity>> {
    const mitra = await this.mitraRepository.findByIdSimple(
      session.id,
      session.tenantId ?? undefined,
    );
    if (!mitra) return this.buildFailureResult("Mitra tidak ditemukan", 404);
    if (!mitra.isActive)
      return this.buildFailureResult("Akun Mitra tidak aktif", 403);
    return { success: true, data: mitra };
  }

  /** Membuat hasil gagal yang konsisten untuk route service mobile. */
  private buildFailureResult(error: string, status: number): ServiceFailure {
    return { success: false, error, status };
  }

  /** Menghitung job selesai bulan berjalan dari transaksi earning. */
  private async getCompletedJobsThisMonth(
    mitraId: string,
    mitraType: string,
    _tenantId?: string,
  ) {
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

  /** Mengambil ringkasan fee pelanggan untuk dashboard mitra sales. */
  private async getFeePelangganStats(mitra: {
    id: string;
    mitraType: string;
    enableFeePelanggan: boolean;
    mitraRateFeePelanggan: number | null;
    mixradiusOwnerNames: string[];
  }) {
    if (mitra.mitraType !== "MITRA_SALES" || !mitra.enableFeePelanggan) {
      return this.buildEmptyFeeStats();
    }
    try {
      const today = this.createTodayStart();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return await this.mitraRepository.getFeePelangganStats({
        mitraId: mitra.id,
        ownerNames: mitra.mixradiusOwnerNames || [],
        feeRate: mitra.mitraRateFeePelanggan || 0,
        monthStart,
        today,
      });
    } catch (error) {
      logger.error(
        "[MobileMitraRouteService] Error getting fee pelanggan stats",
        error as Error,
      );
      return this.buildEmptyFeeStats();
    }
  }

  /** Membuat nilai default saat fee pelanggan tidak aktif atau gagal dihitung. */
  private buildEmptyFeeStats() {
    return {
      activeCustomers: 0,
      totalFeePelanggan: 0,
      remainingFeePelanggan: 0,
      unpaidCustomersCount: 0,
    };
  }

  /** Membuat timestamp awal hari untuk kalkulasi settlement. */
  private createTodayStart() {
    const today = new Date();
    today.setTime(toStartOfDay(today).getTime());
    return today;
  }

  /** Menyimpan file foto verifikasi ke public uploads mitra. */
  private async savePhotoFile(mitraId: string, photo: FaceVerificationFile) {
    const uploadDirectory = path.join(process.cwd(), ...UPLOAD_ROOT_SEGMENTS);
    if (!fs.existsSync(uploadDirectory))
      fs.mkdirSync(uploadDirectory, { recursive: true });
    const fileBuffer = Buffer.from(await photo.arrayBuffer());
    const extension = photo.name.split(".").pop() || DEFAULT_FILE_EXTENSION;
    const filename = `${FACE_VERIFICATION_PREFIX}_${mitraId}_${Date.now()}.${extension}`;
    const filePath = path.join(uploadDirectory, filename);
    fs.writeFileSync(filePath, fileBuffer);
    return `/uploads/mitra/${filename}`;
  }

  /** Mencatat audit verifikasi wajah mobile. */
  private logFaceVerification(session: MobileMitraSession, photoUrl: string) {
    logActivitySafe({
      action: "UPDATE",
      subject: "Face Verification",
      userId: null,
      tenantId: session.tenantId ?? undefined,
      details: {
        mitraId: session.id,
        action: "FACE_VERIFY_MOBILE",
        photoUrl,
        status: "SUCCESS",
      },
    });
  }
}

let instance: MobileMitraRouteService | null = null;

export function getMobileMitraRouteService() {
  if (!instance) instance = new MobileMitraRouteService();
  return instance;
}
