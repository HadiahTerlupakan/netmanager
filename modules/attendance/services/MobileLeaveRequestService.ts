import { logger } from "@/lib/logger";
import { convertAndSaveBase64 } from "@/lib/utils/image-upload";
import { MobileLeaveNotificationHelper } from "./mobile-leave-notification.helpers";
import { Prisma } from "../repositories/prisma-boundary";
import { LeaveStatus, LeaveType } from "../types/attendance.enums";
import type { IHolidayRepository } from "../domain/ports/IHolidayRepository";
import type { ILeaveBalanceRepository } from "../domain/ports/ILeaveBalanceRepository";
import type { ILeaveRepository } from "../domain/ports/ILeaveRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { LeaveBalanceRepository } from "../repositories/LeaveBalanceRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { calculateWorkingDays } from "../utils/calculateWorkingDays";
import { validateTukarLiburRules } from "./LeaveService";

const LEAVE_UPLOAD_DIR = "public/uploads/employee-leave";
const BAD_REQUEST_STATUS = 400;
const INTERNAL_SERVER_ERROR_STATUS = 500;

type MobileLeaveRequester = Awaited<
  ReturnType<ILeaveRepository["findRequesterContext"]>
>;

export type MobileLeaveError = { error: string; code: string; status: number };
export type MobileLeaveResult = MobileLeaveError | { id: string };

type LeaveDateRange = { startDate: Date; endDate: Date };
type LeaveQuotaContext = {
  userId: string;
  tenantId: string;
  currentYear: number;
  leaveType: LeaveType;
  leaveDays: number;
};
type LeaveCreationContext = {
  input: MobileLeaveRequestInput;
  leaveType: LeaveType;
  dateRange: LeaveDateRange;
  attachments: string[];
};

type MobileLeaveProcessContext = {
  input: MobileLeaveRequestInput;
  requester: MobileLeaveRequester;
  leaveType: LeaveType;
  dateRange: LeaveDateRange;
  leaveDays: number;
};

export interface MobileLeaveRequestInput {
  userId: string;
  tenantId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  photos?: string[];
  replacementDate?: string;
}

export class MobileLeaveRequestService {
  private readonly notificationHelper: MobileLeaveNotificationHelper;

  constructor(
    private readonly leaveRepository: ILeaveRepository = new LeaveRepository(),
    private readonly leaveBalanceRepository: ILeaveBalanceRepository = new LeaveBalanceRepository(),
    private readonly holidayRepository: IHolidayRepository = new HolidayRepository(),
  ) {
    this.notificationHelper = new MobileLeaveNotificationHelper(
      leaveRepository,
    );
  }

  /** Create leave request from mobile payload. */
  async createLeaveRequest(
    input: MobileLeaveRequestInput,
  ): Promise<MobileLeaveResult> {
    try {
      return await this.createLeaveRequestUnsafe(input);
    } catch (error) {
      logger.error(
        "Leave request error:",
        error instanceof Error ? error : undefined,
      );
      return {
        error: "Terjadi kesalahan saat membuat pengajuan cuti",
        code: "INTERNAL_ERROR",
        status: INTERNAL_SERVER_ERROR_STATUS,
      };
    }
  }

  private async createLeaveRequestUnsafe(
    input: MobileLeaveRequestInput,
  ): Promise<MobileLeaveResult> {
    const requester = await this.leaveRepository.findRequesterContext(
      input.userId,
      input.tenantId,
    );
    const leaveType = input.type as LeaveType;
    const dateRange = this.createDateRange(input);
    const leaveDays = await this.calculateLeaveDays(
      dateRange,
      requester,
      input.tenantId,
    );
    const context = { input, requester, leaveType, dateRange, leaveDays };

    const validationError = await this.validateRequest(context);
    if (validationError) return validationError;

    const attachments = await this.uploadAttachments(
      input.userId,
      input.photos,
    );
    const requestData = await this.leaveRepository.create(
      this.createLeaveCreateInput({ input, leaveType, dateRange, attachments }),
    );

    await this.notificationHelper.notifyApprovers({
      tenantId: input.tenantId,
      requestId: requestData.id,
      siteId: requester?.siteId,
      requesterName: requester?.name,
      leaveType: input.type,
      reason: input.reason,
    });

    return { id: requestData.id };
  }

  private createDateRange(input: MobileLeaveRequestInput): LeaveDateRange {
    return {
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    };
  }

  private async calculateLeaveDays(
    dateRange: LeaveDateRange,
    requester: MobileLeaveRequester,
    tenantId: string,
  ): Promise<number> {
    return calculateWorkingDays(
      dateRange.startDate,
      dateRange.endDate,
      requester?.workDays ?? null,
      undefined,
      tenantId,
    );
  }

  private async validateRequest(
    context: MobileLeaveProcessContext,
  ): Promise<MobileLeaveError | null> {
    const tukarLiburError = await this.validateTukarLibur(context);
    if (tukarLiburError) return tukarLiburError;

    const overlapError = await this.validateOverlap(context);
    if (overlapError) return overlapError;

    const quotaError = await this.validateQuota(context);
    if (quotaError) return quotaError;

    if (
      this.requiresPhotoEvidence(context.input.type) &&
      !context.input.photos?.length
    ) {
      return {
        error: "Foto bukti wajib diupload",
        code: "VALIDATION_ERROR",
        status: BAD_REQUEST_STATUS,
      };
    }

    return null;
  }

  private async validateOverlap(
    context: MobileLeaveProcessContext,
  ): Promise<MobileLeaveError | null> {
    const existingLeave =
      await this.leaveRepository.findActiveLeaveForUserOnDate(
        context.input.userId,
        context.dateRange.startDate,
        context.dateRange.endDate,
        context.input.tenantId,
      );

    if (existingLeave) {
      const startDate = context.dateRange.startDate.toLocaleDateString(
        "id-ID",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        },
      );
      const endDate = context.dateRange.endDate.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      return {
        error: `Anda sudah punya pengajuan ${existingLeave.type} di tanggal ${startDate} - ${endDate}. Tidak bisa submit leave yang overlap.`,
        code: "VALIDATION_ERROR",
        status: BAD_REQUEST_STATUS,
      };
    }

    return null;
  }

  private async validateTukarLibur(
    context: MobileLeaveProcessContext,
  ): Promise<MobileLeaveError | null> {
    if (context.input.type !== "TUKAR_LIBUR") return null;

    const validation = await validateTukarLiburRules(
      {
        userId: context.input.userId,
        tenantId: context.input.tenantId,
        startDate: context.dateRange.startDate,
        replacementDate: context.input.replacementDate
          ? new Date(context.input.replacementDate)
          : undefined,
        workDays: context.requester?.workDays ?? null,
      },
      {
        isHoliday: (date, tenantId) =>
          this.holidayRepository.isHoliday(date, tenantId),
      },
    );

    if (!("error" in validation)) return null;
    return {
      error: validation.error,
      code: "VALIDATION_ERROR",
      status: BAD_REQUEST_STATUS,
    };
  }

  private async validateQuota(
    context: MobileLeaveProcessContext,
  ): Promise<MobileLeaveError | null> {
    if (this.canSkipQuotaValidation(context)) return null;

    const quota = await this.getQuotaState({
      userId: context.input.userId,
      tenantId: context.input.tenantId,
      currentYear: context.dateRange.startDate.getFullYear(),
      leaveType: context.leaveType,
      leaveDays: context.leaveDays,
    });

    if (quota.hasEnough) return null;
    return {
      error: `Kuota ${context.input.type} tidak cukup. Sisa: ${quota.remaining} hari, Dibutuhkan: ${context.leaveDays} hari.`,
      code: "VALIDATION_ERROR",
      status: BAD_REQUEST_STATUS,
    };
  }

  private canSkipQuotaValidation(context: MobileLeaveProcessContext): boolean {
    return (
      context.requester?.workingHourMode === "FLEXIBLE" ||
      context.input.type === "TUKAR_LIBUR"
    );
  }

  private async getQuotaState(context: LeaveQuotaContext) {
    const hasEnough = await this.leaveBalanceRepository.hasEnoughDays(
      context.userId,
      context.currentYear,
      context.leaveType,
      context.leaveDays,
      context.tenantId,
    );
    const remaining = hasEnough
      ? 0
      : await this.leaveBalanceRepository.getRemainingDays(
          context.userId,
          context.currentYear,
          context.leaveType,
          context.tenantId,
        );

    return { hasEnough, remaining };
  }

  private requiresPhotoEvidence(type: string): boolean {
    return type !== "CUTI" && type !== "TUKAR_LIBUR";
  }

  private async uploadAttachments(
    userId: string,
    photos?: string[],
  ): Promise<string[]> {
    if (!photos?.length) return [];

    const attachments: string[] = [];
    for (const [index, photo] of photos.entries()) {
      const attachment = await this.resolveAttachment(userId, photo, index);
      if (attachment) attachments.push(attachment);
    }
    return attachments;
  }

  private async resolveAttachment(
    userId: string,
    photo: string,
    index: number,
  ): Promise<string | null> {
    if (photo.startsWith("http") || photo.startsWith("/uploads")) {
      return photo;
    }

    return convertAndSaveBase64(
      photo,
      LEAVE_UPLOAD_DIR,
      `leave_${userId}_${Date.now()}_${index}`,
      "employee-leave",
    );
  }

  private createLeaveCreateInput(
    context: LeaveCreationContext,
  ): Prisma.LeaveRequestUncheckedCreateInput {
    return {
      userId: context.input.userId,
      type: context.leaveType,
      startDate: context.dateRange.startDate,
      endDate: context.dateRange.endDate,
      replacementDate: context.input.replacementDate
        ? new Date(context.input.replacementDate)
        : null,
      reason: context.input.reason,
      attachments: context.attachments,
      attachmentUrl: context.attachments[0] ?? null,
      status: LeaveStatus.PENDING,
      tenantId: context.input.tenantId,
    } as Prisma.LeaveRequestUncheckedCreateInput;
  }
}
