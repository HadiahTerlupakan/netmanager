import { logger } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import { UserLookupService } from "@/modules/users";
import type { Prisma } from "@prisma/client";
import type { CreateLeaveData, ServiceResult } from "./LeaveService";
import type { LeaveWithUser } from "./LeaveLifecycleTypes";
import type { IHolidayRepository } from "../domain/ports/IHolidayRepository";
import type { ILeaveRepository } from "../domain/ports/ILeaveRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { LeaveAttendanceSyncService } from "./LeaveAttendanceSyncService";
import { LeaveBalanceUsageService } from "./LeaveBalanceUsageService";
import { LeaveNotificationService } from "./LeaveNotificationService";
import { validateTukarLiburRules } from "./LeaveTukarLiburValidationService";

type LeaveResult = ServiceResult<Prisma.LeaveRequestGetPayload<object>>;
type BalanceUsageInput = Parameters<
  LeaveBalanceUsageService["incrementUsed"]
>[0];
type CreateValidationResult =
  | { success: true; leaveDays: number; balanceInput: BalanceUsageInput }
  | { success: false; error: string; code: string };

export class LeaveLifecycleService {
  constructor(
    private readonly repository: ILeaveRepository & LeaveRepository,
    private readonly holidayRepository: IHolidayRepository & HolidayRepository,
    private readonly userRepository: UserLookupService,
    private readonly attendanceSyncService: LeaveAttendanceSyncService,
    private readonly balanceUsageService: LeaveBalanceUsageService,
    private readonly notificationService: LeaveNotificationService,
  ) {}

  /** Buat pengajuan leave dan jalankan efek samping approval otomatis. */
  async createLeave(
    data: CreateLeaveData,
    createdById: string,
    tenantId: string,
    autoApprove: boolean,
  ): Promise<LeaveResult> {
    try {
      const user = await this.userRepository.findWorkScheduleByIdWithTenant(
        data.userId,
        tenantId,
      );
      const validation = await this.validateCreateRequest(data, tenantId, user);
      if (!validation.success) return validation;

      const leave = await this.repository.create({
        userId: data.userId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
        replacementDate: data.replacementDate ?? null,
        attachmentUrl: data.attachmentUrl ?? null,
        status: autoApprove ? "APPROVED" : "PENDING",
        approvedBy: autoApprove ? createdById : null,
        tenantId,
      });

      if (autoApprove && user) {
        await this.balanceUsageService.incrementUsed(
          validation.balanceInput,
          validation.leaveDays,
        );
        await this.syncCreatedLeave(leave.id, tenantId);
      }

      this.logActivity("CREATE", "LeaveRequest", createdById, {
        id: leave.id,
        userId: data.userId,
        type: data.type,
        autoApproved: autoApprove,
      });

      return { success: true, data: leave };
    } catch (error) {
      logger.error(
        "LeaveService.createLeave failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal membuat cuti",
        code: "CREATE_ERROR",
      };
    }
  }

  /** Setujui leave pending dan sinkronkan saldo serta attendance. */
  async approveLeave(
    id: string,
    approverId: string,
    tenantId: string,
  ): Promise<LeaveResult> {
    try {
      const existing = await this.getExistingLeave(id, tenantId);
      if (!existing.success) return existing;
      if (existing.data.status === "APPROVED") {
        return {
          success: false,
          error: "Cuti sudah disetujui",
          code: "ALREADY_APPROVED",
        };
      }

      const balanceInput = this.buildExistingBalanceInput(
        existing.data,
        tenantId,
      );
      const leaveDays =
        await this.balanceUsageService.calculateLeaveDays(balanceInput);
      const hasEnough = await this.balanceUsageService.hasEnoughDays(
        balanceInput,
        leaveDays,
      );
      if (!hasEnough) return this.insufficientBalanceResult();

      const leave = await this.repository.update(id, {
        status: "APPROVED",
        approvedBy: approverId,
      });
      await this.balanceUsageService.incrementUsed(balanceInput, leaveDays);
      await this.syncApprovedLeave(existing.data);
      this.logActivity("UPDATE", "LeaveRequest", approverId, {
        id,
        status: "APPROVED",
        userId: existing.data.userId,
        employeeName: existing.data.user.name,
      });
      await this.sendNotification(
        existing.data.userId,
        "✅ Izin Disetujui",
        "Pengajuan izin Anda telah disetujui.",
        leave.id,
      );
      return { success: true, data: leave };
    } catch (error) {
      logger.error(
        "LeaveService.approveLeave failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal menyetujui cuti",
        code: "APPROVE_ERROR",
      };
    }
  }

  /** Tolak leave dan refund saldo bila sebelumnya sudah approved. */
  async rejectLeave(
    id: string,
    approverId: string,
    tenantId: string,
    rejectionReason: string,
  ): Promise<LeaveResult> {
    try {
      const existing = await this.getExistingLeave(id, tenantId);
      if (!existing.success) return existing;
      await this.revertApprovedLeave(existing.data, tenantId, "reject");
      const leave = await this.repository.update(id, {
        status: "REJECTED",
        rejectionReason,
      });
      this.logActivity("UPDATE", "LeaveRequest", approverId, {
        id,
        status: "REJECTED",
        rejectionReason,
        userId: existing.data.userId,
        employeeName: existing.data.user.name,
      });
      await this.sendNotification(
        existing.data.userId,
        "❌ Izin Ditolak",
        `Pengajuan izin Anda ditolak. Alasan: ${rejectionReason}`,
        leave.id,
      );
      return { success: true, data: leave };
    } catch (error) {
      logger.error(
        "LeaveService.rejectLeave failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal menolak cuti",
        code: "REJECT_ERROR",
      };
    }
  }

  /** Hapus leave dan rollback efek attendance/saldo bila perlu. */
  async deleteLeave(
    id: string,
    deletedById: string,
    tenantId: string,
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await this.getExistingLeave(id, tenantId);
      if (!existing.success) return existing;
      await this.revertApprovedLeave(existing.data, tenantId, "deletion");
      await this.repository.delete(id);
      this.logActivity("DELETE", "LeaveRequest", deletedById, {
        id,
        employeeName: existing.data.user?.name,
      });
      return { success: true };
    } catch (error) {
      logger.error(
        "LeaveService.deleteLeave failed",
        error instanceof Error ? error : undefined,
      );
      if (isPrismaRecordNotFoundError(error)) {
        return {
          success: false,
          error: "Cuti tidak ditemukan",
          code: "NOT_FOUND",
        };
      }
      return {
        success: false,
        error: "Gagal menghapus cuti",
        code: "DELETE_ERROR",
      };
    }
  }

  private async validateCreateRequest(
    data: CreateLeaveData,
    tenantId: string,
    user: { workDays: string | null; workingHourMode?: string | null } | null,
  ): Promise<CreateValidationResult> {
    const tukarLiburError = await this.validateTukarLibur(data, tenantId, user);
    if (tukarLiburError) return tukarLiburError;
    if (!user)
      return {
        success: true as const,
        leaveDays: 0,
        balanceInput: this.emptyBalanceInput(data, tenantId),
      };
    const balanceInput = this.buildCreateBalanceInput(data, tenantId, user);
    const leaveDays =
      await this.balanceUsageService.calculateLeaveDays(balanceInput);
    const hasEnough = await this.balanceUsageService.hasEnoughDays(
      balanceInput,
      leaveDays,
    );
    if (!hasEnough) return this.insufficientBalanceResult();
    return { success: true as const, leaveDays, balanceInput };
  }

  private async validateTukarLibur(
    data: CreateLeaveData,
    tenantId: string,
    user: { workDays: string | null } | null,
  ): Promise<CreateValidationResult | null> {
    if (data.type !== "TUKAR_LIBUR") return null;
    const validation = await validateTukarLiburRules(
      {
        userId: data.userId,
        tenantId,
        startDate: data.startDate,
        replacementDate: data.replacementDate,
        workDays: user?.workDays ?? null,
      },
      {
        isHoliday: this.holidayRepository.isHoliday.bind(
          this.holidayRepository,
        ),
      },
    );
    if ("error" in validation) {
      return {
        success: false,
        error: validation.error,
        code: "VALIDATION_ERROR",
      };
    }
    return null;
  }

  private async getExistingLeave(id: string, tenantId: string) {
    const leave = await this.repository.findByIdWithUser(id, tenantId);
    if (!leave)
      return {
        success: false as const,
        error: "Cuti tidak ditemukan",
        code: "NOT_FOUND",
      };
    return { success: true as const, data: leave };
  }

  private async syncCreatedLeave(leaveId: string, tenantId: string) {
    try {
      const leave = await this.repository.findByIdWithUser(leaveId, tenantId);
      if (leave) await this.attendanceSyncService.syncLeaveToAttendance(leave);
    } catch (error) {
      logger.error(
        "Failed to sync leave to attendance",
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async syncApprovedLeave(leave: LeaveWithUser) {
    try {
      await this.attendanceSyncService.syncLeaveToAttendance(leave);
    } catch (error) {
      logger.error(
        "Failed to sync leave to attendance in approve",
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async revertApprovedLeave(
    leave: LeaveWithUser,
    tenantId: string,
    action: "reject" | "deletion",
  ) {
    if (leave.status !== "APPROVED") return;
    await this.balanceUsageService.refundUsed(
      this.buildExistingBalanceInput(leave, tenantId),
    );
    try {
      await this.attendanceSyncService.revertLeaveFromAttendance(leave);
    } catch (error) {
      const context = action === "reject" ? "reject" : "deletion";
      logger.error(
        `Failed to revert attendance in ${context}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private logActivity(
    action: string,
    subject: string,
    userId: string,
    details: Record<string, unknown>,
  ) {
    this.notificationService.logActivity({ action, subject, userId, details });
  }

  private async sendNotification(
    userId: string,
    title: string,
    message: string,
    sourceId: string,
  ) {
    await this.notificationService.sendNotification({
      userId,
      title,
      message,
      sourceId,
    });
  }

  private buildCreateBalanceInput(
    data: CreateLeaveData,
    tenantId: string,
    user: { workDays: string | null; workingHourMode?: string | null },
  ) {
    return {
      userId: data.userId,
      tenantId,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      workDays: user.workDays,
      workingHourMode: user.workingHourMode,
    };
  }

  private buildExistingBalanceInput(leave: LeaveWithUser, tenantId: string) {
    return {
      userId: leave.userId,
      tenantId,
      type: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      workDays: leave.user.workDays,
      workingHourMode: leave.user.workingHourMode,
    };
  }

  private emptyBalanceInput(
    data: CreateLeaveData,
    tenantId: string,
  ): BalanceUsageInput {
    return {
      userId: data.userId,
      tenantId,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      workDays: null,
      workingHourMode: null,
    };
  }

  private insufficientBalanceResult() {
    return {
      success: false as const,
      error: "Sisa cuti tidak mencukupi",
      code: "INSUFFICIENT_BALANCE",
    };
  }
}
