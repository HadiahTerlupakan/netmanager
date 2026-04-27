import type { Overtime } from "@prisma/client";

import type {
  OvertimeDetailDTO,
  OvertimeListItemDTO,
  OvertimeSummaryDTO,
} from "../dto/OvertimeDTO";
import type {
  OvertimeAutoCheckoutScheduleEntity,
  OvertimeEntity,
} from "../domain/entities/OvertimeEntity";

const MINUTES_PER_HOUR = 60;
const SUMMARY_PRECISION = 10;

type PrismaOvertimeWithRelations = Overtime & {
  user?: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
    workDays?: string | null;
    workingHourMode?: string | null;
    siteId?: string | null;
    departmentId?: string | null;
    sites?: { name: string } | null;
    departments?: { name: string } | null;
  } | null;
  attendance?: {
    id: string;
    checkIn?: Date | null;
    checkOut?: Date | null;
  } | null;
};

type PrismaAutoCheckoutSchedule = {
  id: string;
  overtimeId: string;
  scheduledFor: Date;
  jobId: string | null;
  version: number;
  scheduleStatus: string;
  executedAt?: Date | null;
  cancelledAt?: Date | null;
  lastError?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export class OvertimeMapper {
  /** Map Prisma overtime model to domain entity. */
  static toDomain(record: PrismaOvertimeWithRelations): OvertimeEntity {
    return {
      id: record.id,
      userId: record.userId,
      tenantId: record.tenantId,
      reason: record.reason,
      startTime: record.startTime,
      endTime: record.endTime,
      startPhoto: record.startPhoto,
      startLocation: record.startLocation,
      endPhoto: record.endPhoto,
      endLocation: record.endLocation,
      duration: record.duration,
      status: record.status,
      approvedBy: record.approvedBy,
      rejectionReason: record.rejectionReason,
      attendanceId: record.attendanceId,
      isHolidayOvertime: record.isHolidayOvertime,
      isNationalHoliday: record.isNationalHoliday,
      isOffDay: record.isOffDay,
      holidayDescription: record.holidayDescription,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      user: record.user
        ? {
            id: record.user.id,
            name: record.user.name,
            email: record.user.email,
            image: record.user.image ?? null,
            workDays: record.user.workDays ?? null,
            workingHourMode: record.user.workingHourMode ?? null,
            siteId: record.user.siteId ?? null,
            departmentId: record.user.departmentId ?? null,
            siteName: record.user.sites?.name ?? null,
            departmentName: record.user.departments?.name ?? null,
          }
        : null,
      approver: null,
      attendance: record.attendance
        ? {
            id: record.attendance.id,
            checkIn: record.attendance.checkIn ?? null,
            checkOut: record.attendance.checkOut ?? null,
          }
        : null,
    };
  }

  /** Map Prisma schedule model to domain entity. */
  static toScheduleDomain(
    record: PrismaAutoCheckoutSchedule,
  ): OvertimeAutoCheckoutScheduleEntity {
    return {
      id: record.id,
      overtimeId: record.overtimeId,
      scheduledFor: record.scheduledFor,
      jobId: record.jobId,
      version: record.version,
      scheduleStatus: record.scheduleStatus,
      executedAt: record.executedAt ?? null,
      cancelledAt: record.cancelledAt ?? null,
      lastError: record.lastError ?? null,
      createdAt: record.createdAt ?? null,
      updatedAt: record.updatedAt ?? null,
    };
  }

  /** Map overtime domain entity to list DTO. */
  static toListItemDTO(entity: OvertimeEntity): OvertimeListItemDTO {
    return {
      id: entity.id,
      employeeName: entity.user?.name ?? null,
      employeeEmail: entity.user?.email ?? "",
      reason: entity.reason,
      startTime: entity.startTime?.toISOString() ?? null,
      endTime: entity.endTime?.toISOString() ?? null,
      duration: entity.duration,
      status: entity.status,
      isHolidayOvertime: entity.isHolidayOvertime,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  /** Map overtime domain entities to list DTOs. */
  static toListItemDTOs(entities: OvertimeEntity[]): OvertimeListItemDTO[] {
    return entities.map((entity) => this.toListItemDTO(entity));
  }

  /** Map overtime domain entity to detail DTO. */
  static toDetailDTO(entity: OvertimeEntity): OvertimeDetailDTO {
    return {
      id: entity.id,
      reason: entity.reason,
      startTime: entity.startTime?.toISOString() ?? null,
      endTime: entity.endTime?.toISOString() ?? null,
      startPhoto: entity.startPhoto,
      startLocation: entity.startLocation,
      endPhoto: entity.endPhoto,
      endLocation: entity.endLocation,
      duration: entity.duration,
      status: entity.status,
      rejectionReason: entity.rejectionReason,
      isHolidayOvertime: entity.isHolidayOvertime,
      isNationalHoliday: entity.isNationalHoliday,
      isOffDay: entity.isOffDay,
      holidayDescription: entity.holidayDescription,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      employee: {
        id: entity.user?.id ?? entity.userId,
        name: entity.user?.name ?? null,
        email: entity.user?.email ?? "",
      },
      approvedBy: entity.approver
        ? {
            id: entity.approver.id,
            name: entity.approver.name,
          }
        : null,
    };
  }

  /** Map overtime domain entity to legacy admin detail payload. */
  static toAdminDetailPayload(entity: OvertimeEntity) {
    return {
      id: entity.id,
      userId: entity.userId,
      tenantId: entity.tenantId,
      reason: entity.reason,
      startTime: entity.startTime,
      endTime: entity.endTime,
      startPhoto: entity.startPhoto,
      startLocation: entity.startLocation,
      endPhoto: entity.endPhoto,
      endLocation: entity.endLocation,
      duration: entity.duration,
      status: entity.status,
      approvedBy: entity.approvedBy,
      rejectionReason: entity.rejectionReason,
      attendanceId: entity.attendanceId,
      isHolidayOvertime: entity.isHolidayOvertime,
      isNationalHoliday: entity.isNationalHoliday,
      isOffDay: entity.isOffDay,
      holidayDescription: entity.holidayDescription,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      user: entity.user
        ? {
            id: entity.user.id,
            name: entity.user.name,
            email: entity.user.email,
            siteId: entity.user.siteId ?? null,
            departmentId: entity.user.departmentId ?? null,
            departments: entity.user.departmentName
              ? { name: entity.user.departmentName }
              : null,
            sites: entity.user.siteName ? { name: entity.user.siteName } : null,
          }
        : null,
    };
  }

  /** Map overtime domain entities to summary DTO. */
  static toSummaryDTO(entities: OvertimeEntity[]): OvertimeSummaryDTO {
    const pendingCount = entities.filter(
      (item) => item.status === "PENDING",
    ).length;
    const approvedCount = entities.filter(
      (item) => item.status === "APPROVED",
    ).length;
    const rejectedCount = entities.filter(
      (item) => item.status === "REJECTED",
    ).length;
    const holidayOvertimeCount = entities.filter(
      (item) => item.isHolidayOvertime,
    ).length;
    const totalMinutes = this.calculateApprovedMinutes(entities);

    return {
      totalRequests: entities.length,
      pendingCount,
      approvedCount,
      rejectedCount,
      totalHours: this.roundHours(totalMinutes),
      holidayOvertimeCount,
    };
  }

  /** Calculate approved overtime minutes. */
  private static calculateApprovedMinutes(entities: OvertimeEntity[]): number {
    return entities
      .filter((item) => item.status === "APPROVED" && item.duration)
      .reduce((sum, item) => sum + (item.duration ?? 0), 0);
  }

  /** Round minutes to one decimal hour. */
  private static roundHours(totalMinutes: number): number {
    return (
      Math.round((totalMinutes / MINUTES_PER_HOUR) * SUMMARY_PRECISION) /
      SUMMARY_PRECISION
    );
  }
}
