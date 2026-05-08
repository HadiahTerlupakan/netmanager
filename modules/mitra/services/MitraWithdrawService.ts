import { randomUUID } from "crypto";
import { AttendanceSettingsService } from "@/modules/attendance";
import type { WithdrawRequestDTO } from "../dto/MitraDTO";
import type { IMitraWithdrawRepository } from "../domain/ports/IMitraWithdrawRepository";
import { getMitraWithdrawRepository } from "../repositories/MitraWithdrawRepository";
import { validateTransferDetails } from "../validators/mitraValidation";
import {
  getApprovalRequestValidationError,
  getMinimumWithdrawValidationError,
  getPendingRequestValidationError,
  getWalletValidationError,
  logWithdrawActivity,
  logWithdrawServiceError,
  resolveMinWithdraw,
} from "./MitraWithdrawService.helpers";

interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

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
      if (!mitra) {
        return { success: false, error: "Mitra tidak ditemukan" };
      }

      if (!mitra.isActive) {
        return { success: false, error: "Akun Mitra tidak aktif" };
      }

      const minimumError = await getMinimumWithdrawValidationError({
        amount: data.amount,
        minWithdrawal: mitra.minWithdrawal,
        attendanceSettingsService: this.attendanceSettingsService,
      });
      if (minimumError) {
        return { success: false, error: minimumError };
      }

      const transferError = validateTransferDetails(data);
      if (transferError) {
        return { success: false, error: transferError };
      }

      const wallet = await this.withdrawRepo.findWalletByMitraId(
        userId,
        tenantId,
      );
      const walletError = await getWalletValidationError({
        walletId: wallet?.id,
        balance: wallet?.balance,
        amount: data.amount,
        withdrawRepository: this.withdrawRepo,
      });
      if (walletError) {
        return { success: false, error: walletError };
      }

      const id = randomUUID();
      await this.withdrawRepo.createWithdrawRequest({
        id,
        userId,
        walletId: wallet!.id,
        payload: data,
      });

      return { success: true, data: { id } };
    } catch (error) {
      logWithdrawServiceError(
        "[MitraWithdrawService] Error requesting withdraw:",
        error,
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
      const validationError = getApprovalRequestValidationError({
        request,
        requiredStatus: REQUEST_STATUS_PENDING,
        pendingStatus: REQUEST_STATUS_PENDING,
      });
      if (validationError) {
        return { success: false, error: validationError };
      }

      await this.withdrawRepo.updateWithdrawStatus({
        id,
        status: REQUEST_STATUS_APPROVED,
        processedById: approvedById,
        processedAt: new Date(),
      });
      logWithdrawActivity("APPROVE", approvedById, {
        requestId: id,
        amount: request!.amount,
      });
      return { success: true };
    } catch (error) {
      logWithdrawServiceError(
        "[MitraWithdrawService] Error approving withdraw:",
        error,
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
      const validationError = getPendingRequestValidationError(request);
      if (validationError) {
        return { success: false, error: validationError };
      }

      await this.withdrawRepo.updateWithdrawStatus({
        id,
        status: REQUEST_STATUS_REJECTED,
        processedById: rejectedById,
        processedAt: new Date(),
        rejectionReason: reason,
      });
      logWithdrawActivity("REJECT", rejectedById, {
        requestId: id,
        reason,
      });
      return { success: true };
    } catch (error) {
      logWithdrawServiceError(
        "[MitraWithdrawService] Error rejecting withdraw:",
        error,
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
      const validationError = getApprovalRequestValidationError({
        request,
        requiredStatus: REQUEST_STATUS_APPROVED,
        pendingStatus: REQUEST_STATUS_PENDING,
      });
      if (validationError) {
        return { success: false, error: validationError };
      }

      await this.withdrawRepo.completeWithdraw({
        walletId: request!.mitraWalletId,
        amount: request!.amount,
        requestId: id,
        method: request!.method,
        processedById,
      });
      logWithdrawActivity("COMPLETE", processedById, {
        requestId: id,
        amount: request!.amount,
        method: request!.method,
      });
      return { success: true };
    } catch (error) {
      logWithdrawServiceError(
        "[MitraWithdrawService] Error completing withdraw:",
        error,
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
    allowedSiteIds?: string[];
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
        allowedSiteIds: filters.allowedSiteIds,
      });
      return { success: true, data: result };
    } catch (error) {
      logWithdrawServiceError(
        "[MitraWithdrawService] Error getting withdraw requests:",
        error,
      );
      return { success: false, error: "Gagal mengambil data penarikan" };
    }
  }

  /** Mengambil nilai minimum penarikan aktif. */
  async getMinWithdrawSetting(): Promise<
    ServiceResult<{ minWithdraw: number }>
  > {
    const minWithdraw = await resolveMinWithdraw(
      this.attendanceSettingsService,
    );
    return { success: true, data: { minWithdraw } };
  }
}

let instance: MitraWithdrawService | null = null;

export function getMitraWithdrawService(): MitraWithdrawService {
  if (!instance) {
    instance = new MitraWithdrawService();
  }

  return instance;
}
