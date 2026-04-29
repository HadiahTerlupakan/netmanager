import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";
import { logActivitySafe } from "@/lib/logger";
import { AttendanceSettingsService } from "@/modules/attendance";
import type { WithdrawRequestDTO } from "../dto/MitraDTO";
import type { IMitraWithdrawRepository } from "../domain/ports/IMitraWithdrawRepository";
import { getMitraWithdrawRepository } from "../repositories/MitraWithdrawRepository";
import { validateTransferDetails } from "../validators/mitraValidation";

interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

const DEFAULT_MIN_WITHDRAW = 50000;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const REQUEST_STATUS_PENDING = "PENDING";
const REQUEST_STATUS_APPROVED = "APPROVED";
const REQUEST_STATUS_REJECTED = "REJECTED";

export class MitraWithdrawService {
  constructor(
    private readonly withdrawRepo: IMitraWithdrawRepository = getMitraWithdrawRepository(),
    private readonly attendanceSettingsService: AttendanceSettingsService = new AttendanceSettingsService(),
  ) {}

  /** Membuat request penarikan baru untuk mitra. */
  async requestWithdraw(
    userId: string,
    data: WithdrawRequestDTO,
    tenantId?: string,
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const mitra = await this.withdrawRepo.findMitraById(userId, tenantId);
      if (!mitra) return { success: false, error: "Mitra tidak ditemukan" };
      const minimumError = await this.validateMinimumWithdraw(
        data.amount,
        mitra.minWithdrawal,
      );
      if (minimumError) return minimumError;
      const transferError = validateTransferDetails(data);
      if (transferError) return { success: false, error: transferError };
      const wallet = await this.withdrawRepo.findWalletByMitraId(
        userId,
        tenantId,
      );
      const walletError = await this.validateWalletForWithdraw(
        wallet?.id,
        wallet?.balance,
        data.amount,
      );
      if (walletError) return walletError;
      const id = randomUUID();
      await this.withdrawRepo.createWithdrawRequest({
        id,
        userId,
        walletId: wallet!.id,
        payload: data,
      });
      logger.info(
        `[MitraWithdrawService] Withdraw requested: userId=${userId}, amount=${data.amount}, method=${data.method}`,
      );
      return { success: true, data: { id } };
    } catch (error) {
      logger.error(
        "[MitraWithdrawService] Error requesting withdraw:",
        error as Error,
      );
      return { success: false, error: "Gagal membuat request penarikan" };
    }
  }

  /** Menyetujui request penarikan yang masih pending. */
  async approveWithdraw(
    id: string,
    approvedById: string,
    tenantId?: string,
  ): Promise<ServiceResult> {
    try {
      const request = await this.withdrawRepo.findWithdrawRequestById(
        id,
        tenantId,
      );
      const validationError = this.validateApprovalRequest(
        request,
        REQUEST_STATUS_PENDING,
      );
      if (validationError) return validationError;
      await this.withdrawRepo.updateWithdrawStatus({
        id,
        status: REQUEST_STATUS_APPROVED,
        processedById: approvedById,
        processedAt: new Date(),
      });
      this.logWithdrawActivity("APPROVE", approvedById, {
        requestId: id,
        amount: request!.amount,
      });
      return { success: true };
    } catch (error) {
      logger.error(
        "[MitraWithdrawService] Error approving withdraw:",
        error as Error,
      );
      return { success: false, error: "Gagal menyetujui penarikan" };
    }
  }

  /** Menolak request penarikan yang masih pending. */
  async rejectWithdraw(
    id: string,
    reason: string,
    rejectedById: string,
    tenantId?: string,
  ): Promise<ServiceResult> {
    try {
      const request = await this.withdrawRepo.findWithdrawRequestByIdSimple(
        id,
        tenantId,
      );
      const validationError = this.validatePendingRequest(request);
      if (validationError) return validationError;
      await this.withdrawRepo.updateWithdrawStatus({
        id,
        status: REQUEST_STATUS_REJECTED,
        processedById: rejectedById,
        processedAt: new Date(),
        rejectionReason: reason,
      });
      this.logWithdrawActivity("REJECT", rejectedById, {
        requestId: id,
        reason,
      });
      return { success: true };
    } catch (error) {
      logger.error(
        "[MitraWithdrawService] Error rejecting withdraw:",
        error as Error,
      );
      return { success: false, error: "Gagal menolak penarikan" };
    }
  }

  /** Menyelesaikan request penarikan yang sudah disetujui. */
  async completeWithdraw(
    id: string,
    processedById: string,
    tenantId?: string,
  ): Promise<ServiceResult> {
    try {
      const request = await this.withdrawRepo.findWithdrawRequestById(
        id,
        tenantId,
      );
      const validationError = this.validateApprovalRequest(
        request,
        REQUEST_STATUS_APPROVED,
      );
      if (validationError) return validationError;
      await this.withdrawRepo.completeWithdraw({
        walletId: request!.mitraWalletId,
        amount: request!.amount,
        requestId: id,
        method: request!.method,
        processedById,
      });
      this.logWithdrawActivity("COMPLETE", processedById, {
        requestId: id,
        amount: request!.amount,
        method: request!.method,
      });
      logger.info(
        `[MitraWithdrawService] Withdraw completed: requestId=${id}, amount=${request!.amount}`,
      );
      return { success: true };
    } catch (error) {
      logger.error(
        "[MitraWithdrawService] Error completing withdraw:",
        error as Error,
      );
      return { success: false, error: "Gagal menyelesaikan penarikan" };
    }
  }

  /** Mengambil daftar request penarikan dengan filter dan paginasi. */
  async getWithdrawRequests(filters: {
    userId?: string;
    status?: string;
    page?: number;
    limit?: number;
    tenantId?: string;
  }) {
    try {
      const page = filters.page ?? DEFAULT_PAGE;
      const limit = filters.limit ?? DEFAULT_LIMIT;
      const result = await this.withdrawRepo.findWithdrawRequests({
        userId: filters.userId,
        status: filters.status,
        page,
        limit,
        tenantId: filters.tenantId,
      });
      return { success: true, data: result };
    } catch (error) {
      logger.error(
        "[MitraWithdrawService] Error getting withdraw requests:",
        error as Error,
      );
      return { success: false, error: "Gagal mengambil data penarikan" };
    }
  }

  /** Mengambil nilai minimum penarikan aktif. */
  async getMinWithdrawSetting(): Promise<
    ServiceResult<{ minWithdraw: number }>
  > {
    const minWithdraw = await this.getMinWithdraw();
    return { success: true, data: { minWithdraw } };
  }

  private async getMinWithdraw() {
    try {
      const setting =
        await this.attendanceSettingsService.findByKey("mitra_min_withdraw");
      return setting?.value ? parseFloat(setting.value) : DEFAULT_MIN_WITHDRAW;
    } catch {
      return DEFAULT_MIN_WITHDRAW;
    }
  }

  private async validateMinimumWithdraw(
    amount: number,
    minWithdrawal: number | null,
  ) {
    const minWithdraw = minWithdrawal ?? (await this.getMinWithdraw());
    if (amount >= minWithdraw) return null;
    return {
      success: false,
      error: `Minimum penarikan Anda adalah Rp ${minWithdraw.toLocaleString("id-ID")}`,
    };
  }

  private async validateWalletForWithdraw(
    walletId: string | undefined,
    balance: number | undefined,
    amount: number,
  ) {
    if (!walletId || balance === undefined)
      return { success: false, error: "Wallet tidak ditemukan" };
    if (balance < amount) return { success: false, error: "Saldo tidak cukup" };
    const pendingCount =
      await this.withdrawRepo.countPendingWithdrawals(walletId);
    if (pendingCount > 0)
      return {
        success: false,
        error: "Masih ada request penarikan yang belum selesai",
      };
    return null;
  }

  private validatePendingRequest(request: { status: string } | null) {
    if (!request) return { success: false, error: "Request tidak ditemukan" };
    if (request.status !== REQUEST_STATUS_PENDING)
      return { success: false, error: "Request sudah diproses" };
    return null;
  }

  private validateApprovalRequest(
    request: {
      status: string;
      amount: number;
      mitraWallet?: { balance: number };
    } | null,
    requiredStatus: string,
  ) {
    if (!request) return { success: false, error: "Request tidak ditemukan" };
    if (request.status !== requiredStatus) {
      return {
        success: false,
        error:
          requiredStatus === REQUEST_STATUS_PENDING
            ? "Request sudah diproses"
            : "Request belum disetujui",
      };
    }
    if ((request.mitraWallet?.balance || 0) < request.amount) {
      return { success: false, error: "Saldo mitra tidak cukup" };
    }
    return null;
  }

  private logWithdrawActivity(
    action: string,
    userId: string,
    details: Record<string, unknown>,
  ) {
    logActivitySafe({ action, subject: "WithdrawRequest", userId, details });
  }
}

let instance: MitraWithdrawService | null = null;

export function getMitraWithdrawService(): MitraWithdrawService {
  if (!instance) {
    instance = new MitraWithdrawService();
  }

  return instance;
}
