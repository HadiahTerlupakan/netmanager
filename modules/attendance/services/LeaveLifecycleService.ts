import { UserLookupService } from "@/modules/users";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import type { CreateLeaveData, ServiceResult } from "./LeaveService";
import { LeaveAttendanceSyncService } from "./LeaveAttendanceSyncService";
import { LeaveBalanceUsageService } from "./LeaveBalanceUsageService";
import { LeaveNotificationService } from "./LeaveNotificationService";
import type {
  CreateLeaveContext,
  CreateValidationResult,
  ExistingLeaveResult,
  LeaveResult,
  LeaveWithUser,
} from "./LeaveLifecycleTypes";
import { validateTukarLiburCreateRequest } from "./LeaveTukarLiburValidationService";
import {
  buildCreateBalanceInput,
  buildExistingBalanceInput,
  emptyBalanceInput,
  insufficientBalanceResult,
  createDecisionDetails,
  logLeaveMutation,
  notifyLeaveDecision,
  revertApprovedLeave,
  syncApprovedLeave,
  syncAutoApprovedLeave,
} from "./leave-lifecycle.helpers";
import {
  createLeaveFailureResult,
  handleDeleteLeaveError,
  handleLeaveError,
} from "./leave-lifecycle-error.helpers";

const NOT_FOUND_RESULT: ExistingLeaveResult = {
  success: false,
  error: "Cuti tidak ditemukan",
  code: "NOT_FOUND",
};

export class LeaveLifecycleService {
  constructor(
    private readonly repository: LeaveRepository,
    private readonly holidayRepository: HolidayRepository,
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
    bypassManualApproval: boolean = false,
  ): Promise<LeaveResult> {
    try {
      return await this.createLeaveUnsafe(data, {
        actorId: createdById,
        tenantId,
        autoApprove: bypassManualApproval,
      });
    } catch (error) {
      return handleLeaveError(
        "LeaveService.createLeave failed",
        error,
        "Gagal membuat cuti",
        "CREATE_ERROR",
      );
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
      if (!existing.success) {
        const failure = existing as {
          success: false;
          error: string;
          code: string;
        };
        return { success: false, error: failure.error, code: failure.code };
      }
      if (existing.data.status === "APPROVED") {
        return createLeaveFailureResult(
          "Cuti sudah disetujui",
          "ALREADY_APPROVED",
        );
      }

      const balance = await this.getApprovedLeaveBalance(
        existing.data,
        tenantId,
      );
      if (!balance.hasEnough) return insufficientBalanceResult();

      const leave = await this.repository.update(id, {
        status: "APPROVED",
        approvedBy: approverId,
      });
      await this.balanceUsageService.incrementUsed(
        balance.balanceInput,
        balance.leaveDays,
      );
      await syncApprovedLeave(this.attendanceSyncService, existing.data);
      logLeaveMutation(this.notificationService, {
        action: "UPDATE",
        userId: approverId,
        details: createDecisionDetails({
          id,
          status: "APPROVED",
          leave: existing.data,
        }),
      });
      await notifyLeaveDecision(this.notificationService, {
        userId: existing.data.userId,
        title: "Izin Disetujui",
        message: "Pengajuan izin Anda telah disetujui.",
        sourceId: leave.id,
      });
      return { success: true, data: leave };
    } catch (error) {
      return handleLeaveError(
        "LeaveService.approveLeave failed",
        error,
        "Gagal menyetujui cuti",
        "APPROVE_ERROR",
      );
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
      if (!existing.success) {
        const failure = existing as {
          success: false;
          error: string;
          code: string;
        };
        return { success: false, error: failure.error, code: failure.code };
      }
      await revertApprovedLeave({
        leave: existing.data,
        tenantId,
        action: "reject",
        balanceUsageService: this.balanceUsageService,
        attendanceSyncService: this.attendanceSyncService,
      });
      const leave = await this.repository.update(id, {
        status: "REJECTED",
        rejectionReason,
      });
      logLeaveMutation(this.notificationService, {
        action: "UPDATE",
        userId: approverId,
        details: createDecisionDetails({
          id,
          status: "REJECTED",
          leave: existing.data,
          extra: { rejectionReason },
        }),
      });
      await notifyLeaveDecision(this.notificationService, {
        userId: existing.data.userId,
        title: "Izin Ditolak",
        message: `Pengajuan izin Anda ditolak. Alasan: ${rejectionReason}`,
        sourceId: leave.id,
      });
      return { success: true, data: leave };
    } catch (error) {
      return handleLeaveError(
        "LeaveService.rejectLeave failed",
        error,
        "Gagal menolak cuti",
        "REJECT_ERROR",
      );
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
      if (!existing.success) {
        const failure = existing as {
          success: false;
          error: string;
          code: string;
        };
        return { success: false, error: failure.error, code: failure.code };
      }
      await revertApprovedLeave({
        leave: existing.data,
        tenantId,
        action: "deletion",
        balanceUsageService: this.balanceUsageService,
        attendanceSyncService: this.attendanceSyncService,
      });
      await this.repository.delete(id);
      logLeaveMutation(this.notificationService, {
        action: "DELETE",
        userId: deletedById,
        details: { id, employeeName: existing.data.user?.name },
      });
      return { success: true };
    } catch (error) {
      return handleDeleteLeaveError(error);
    }
  }

  private async createLeaveUnsafe(
    data: CreateLeaveData,
    context: CreateLeaveContext,
  ): Promise<LeaveResult> {
    const user = await this.userRepository.findWorkScheduleByIdWithTenant(
      data.userId,
      context.tenantId,
    );
    const validation = await this.validateCreateRequest(
      data,
      context.tenantId,
      user,
    );
    if (!validation.success) return validation;

    const leave = await this.repository.create({
      userId: data.userId,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      replacementDate: data.replacementDate ?? null,
      attachmentUrl: data.attachmentUrl ?? null,
      status: context.autoApprove ? "APPROVED" : "PENDING",
      approvedBy: context.autoApprove ? context.actorId : null,
      tenantId: context.tenantId,
    });

    await syncAutoApprovedLeave({
      repository: this.repository,
      attendanceSyncService: this.attendanceSyncService,
      balanceUsageService: this.balanceUsageService,
      leaveId: leave.id,
      user,
      tenantId: context.tenantId,
      autoApprove: context.autoApprove,
      validation,
    });
    logLeaveMutation(this.notificationService, {
      action: "CREATE",
      userId: context.actorId,
      details: {
        id: leave.id,
        userId: data.userId,
        type: data.type,
        autoApproved: context.autoApprove,
      },
    });
    return { success: true, data: leave };
  }

  private async validateCreateRequest(
    data: CreateLeaveData,
    tenantId: string,
    user: { workDays: string | null; workingHourMode?: string | null } | null,
  ): Promise<CreateValidationResult> {
    const tukarLiburValidation = await validateTukarLiburCreateRequest({
      data,
      tenantId,
      user,
      dependencies: {
        isHoliday: this.holidayRepository.isHoliday.bind(
          this.holidayRepository,
        ),
      },
    });
    if (!tukarLiburValidation.success) {
      const validationFailure = tukarLiburValidation as {
        success: false;
        error: string;
      };
      return {
        success: false,
        error: validationFailure.error,
        code: "VALIDATION_ERROR",
      };
    }
    if (!user) {
      return {
        success: true,
        leaveDays: 0,
        balanceInput: emptyBalanceInput(data, tenantId),
      };
    }

    const balanceInput = buildCreateBalanceInput(data, tenantId, user);
    const leaveDays =
      await this.balanceUsageService.calculateLeaveDays(balanceInput);
    const hasEnough = await this.balanceUsageService.hasEnoughDays(
      balanceInput,
      leaveDays,
    );
    if (!hasEnough) return insufficientBalanceResult();
    return { success: true, leaveDays, balanceInput };
  }

  private async getExistingLeave(
    id: string,
    tenantId: string,
  ): Promise<ExistingLeaveResult> {
    const leave = await this.repository.findByIdWithUser(id, tenantId);
    return leave ? { success: true, data: leave } : NOT_FOUND_RESULT;
  }

  private async getApprovedLeaveBalance(
    leave: LeaveWithUser,
    tenantId: string,
  ) {
    const balanceInput = buildExistingBalanceInput(leave, tenantId);
    const leaveDays =
      await this.balanceUsageService.calculateLeaveDays(balanceInput);
    const hasEnough = await this.balanceUsageService.hasEnoughDays(
      balanceInput,
      leaveDays,
    );
    return { balanceInput, leaveDays, hasEnough };
  }
}
