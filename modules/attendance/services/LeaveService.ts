import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import type { IHolidayRepository } from "../domain/ports/IHolidayRepository";
import type { ILeaveBalanceRepository } from "../domain/ports/ILeaveBalanceRepository";
import type { ILeaveRepository } from "../domain/ports/ILeaveRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { LeaveBalanceRepository } from "../repositories/LeaveBalanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { UserLookupService } from "@/modules/users";
import { LeaveNotificationService } from "./LeaveNotificationService";
import type { LeaveStatus, LeaveType } from "@prisma/client";
import { LeaveAttendanceSyncService } from "./LeaveAttendanceSyncService";
import { LeaveBalanceUsageService } from "./LeaveBalanceUsageService";
import { LeaveLifecycleService } from "./LeaveLifecycleService";
import type { LeaveResult, LeaveWithUser } from "./LeaveLifecycleTypes";
export { validateTukarLiburRules } from "./LeaveTukarLiburValidationService";

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface LeaveFilters {
  userId?: string;
  status?: LeaveStatus;
  startDate?: Date;
  endDate?: Date;
  departmentId?: string;
  siteId?: string;
  tenantId?: string;
}

export interface CreateLeaveData {
  userId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  replacementDate?: Date;
  attachmentUrl?: string;
}

export class LeaveService {
  private repository: ILeaveRepository & LeaveRepository;
  private balanceRepository: ILeaveBalanceRepository & LeaveBalanceRepository;
  private holidayRepository: IHolidayRepository & HolidayRepository;
  private attendanceRepository: AttendanceRepository;
  private userRepository: UserLookupService;
  private attendanceSyncService: LeaveAttendanceSyncService;
  private notificationService: LeaveNotificationService;
  private balanceUsageService: LeaveBalanceUsageService;
  private lifecycleService: LeaveLifecycleService;

  constructor(
    repository: ILeaveRepository & LeaveRepository = new LeaveRepository(),
    balanceRepository: ILeaveBalanceRepository &
      LeaveBalanceRepository = new LeaveBalanceRepository(),
    holidayRepository: IHolidayRepository &
      HolidayRepository = new HolidayRepository(),
    attendanceRepository: AttendanceRepository = new AttendanceRepository(),
    userRepository: UserLookupService = new UserLookupService(),
  ) {
    this.repository = repository;
    this.balanceRepository = balanceRepository;
    this.holidayRepository = holidayRepository;
    this.attendanceRepository = attendanceRepository;
    this.userRepository = userRepository;
    this.attendanceSyncService = new LeaveAttendanceSyncService(
      this.attendanceRepository,
      this.holidayRepository,
    );
    this.notificationService = new LeaveNotificationService();
    this.balanceUsageService = new LeaveBalanceUsageService(
      this.balanceRepository,
      this.holidayRepository,
    );
    this.lifecycleService = new LeaveLifecycleService(
      this.repository,
      this.holidayRepository,
      this.userRepository,
      this.attendanceSyncService,
      this.balanceUsageService,
      this.notificationService,
    );
  }

  async getLeaves(
    filters: LeaveFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<
    ServiceResult<{
      leaves: Array<
        Prisma.LeaveRequestGetPayload<{
          include: {
            user: {
              select: {
                name: true;
                departments: { select: { name: true } };
                sites: { select: { name: true } };
              };
            };
          };
        }>
      >;
      total: number;
      page: number;
      totalPages: number;
    }>
  > {
    try {
      const skip = (page - 1) * limit;

      const [leaves, total] = await Promise.all([
        this.repository.findAll({ ...filters, skip, take: limit }),
        this.repository.count(filters),
      ]);

      return {
        success: true,
        data: {
          leaves,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(
        "LeaveService.getLeaves failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal mengambil data cuti",
        code: "FETCH_ERROR",
      };
    }
  }

  async getLeaveById(
    id: string,
    tenantId: string,
  ): Promise<ServiceResult<LeaveWithUser>> {
    try {
      const leave = await this.repository.findByIdWithUser(id, tenantId);
      if (!leave) {
        return {
          success: false,
          error: "Cuti tidak ditemukan",
          code: "NOT_FOUND",
        };
      }
      return { success: true, data: leave };
    } catch (error) {
      logger.error(
        "LeaveService.getLeaveById failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal mengambil cuti",
        code: "FETCH_ERROR",
      };
    }
  }

  async createLeave(
    data: CreateLeaveData,
    createdById: string,
    tenantId: string,
    autoApprove: boolean = true,
  ): Promise<LeaveResult> {
    return this.lifecycleService.createLeave(
      data,
      createdById,
      tenantId,
      autoApprove,
    );
  }

  async syncApprovedLeaveToAttendanceRange(
    startDate: Date,
    endDate: Date,
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    const leaves = await this.repository.findApprovedInRangeWithUser(
      startDate,
      endDate,
      tenantId,
      userId,
    );

    for (const leave of leaves) {
      await this.syncLeaveToAttendance(leave);
    }
  }

  async approveLeave(
    id: string,
    approverId: string,
    tenantId: string,
  ): Promise<LeaveResult> {
    return this.lifecycleService.approveLeave(id, approverId, tenantId);
  }

  async rejectLeave(
    id: string,
    approverId: string,
    tenantId: string,
    rejectionReason: string,
  ): Promise<LeaveResult> {
    return this.lifecycleService.rejectLeave(
      id,
      approverId,
      tenantId,
      rejectionReason,
    );
  }

  async deleteLeave(
    id: string,
    deletedById: string,
    tenantId: string,
  ): Promise<ServiceResult<void>> {
    return this.lifecycleService.deleteLeave(id, deletedById, tenantId);
  }

  private async syncLeaveToAttendance(leave: LeaveWithUser): Promise<void> {
    await this.attendanceSyncService.syncLeaveToAttendance(leave);
  }
}

let leaveServiceInstance: LeaveService | null = null;

export function getLeaveService(): LeaveService {
  if (!leaveServiceInstance) {
    leaveServiceInstance = new LeaveService();
  }
  return leaveServiceInstance;
}
