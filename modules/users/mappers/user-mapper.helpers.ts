import type {
  AttendanceGeofencePolicy,
  RateType,
  TargetSchema,
  WorkingHourMode,
} from "@prisma/client";

import type {
  EmployeeAssignmentDTO,
  UserDetailDTO,
  UserListItemDTO,
  UserOptionDTO,
  UserSessionDTO,
} from "../dto/UserDTO";
import type {
  UserEntity,
  UserRelationEntity,
  UserScheduleEntity,
  UserShiftEntity,
  UserSiteRelationEntity,
} from "../domain/entities/UserEntity";
import type { CreateUserRepositoryInput } from "../domain/ports/IUserRepository";
import type { PrismaUserRelations } from "./UserMapper";

const DEFAULT_SITE_NAME = "Unknown";
const DEFAULT_WORKING_HOUR_MODE: WorkingHourMode = "FIXED";
const DEFAULT_GEOFENCE_POLICY: AttendanceGeofencePolicy = "WARN";
const DEFAULT_WORK_DAYS = "Mon,Tue,Wed,Thu,Fri";
const DEFAULT_START_WORK_TIME = "09:00";
const DEFAULT_END_WORK_TIME = "17:00";
const DEFAULT_FLEXIBLE_TARGET_HOUR = 8;
const DEFAULT_CANVASING_TARGET = 50;
const DEFAULT_TARGET_SCHEMA: TargetSchema = "MONTHLY_RESET";
const DEFAULT_RATE_TYPE: RateType = "PER_HOUR";
const DEFAULT_PAY_PERIOD_DAY = 25;
const DEFAULT_PAY_DAY = 1;
const DEFAULT_NUMERIC_VALUE = 0;

export function toUserRelation(
  relation?: { id: string; name: string } | null,
): UserRelationEntity | null {
  if (!relation) return null;
  return { id: relation.id, name: relation.name };
}

export function toUserSiteRelation(
  site?: { id: string; code: string; name: string } | null,
): UserSiteRelationEntity | null {
  if (!site) return null;
  return { id: site.id, code: site.code, name: site.name };
}

export function toUserShift(
  shift?: { id: string; name: string } | null,
): UserShiftEntity | null {
  if (!shift) return null;
  return { id: shift.id, name: shift.name };
}

export function toUserSites(userSites?: PrismaUserRelations["userSites"]) {
  if (!userSites) return [];
  return userSites.map((userSite) => ({
    id: userSite.id,
    siteId: userSite.siteId,
    isPrimary: userSite.isPrimary,
    site: {
      id: userSite.site.id,
      code: userSite.site.code,
      name: userSite.site.name,
    },
  }));
}

export function toRepositoryCreateInput(
  input: CreateUserRepositoryInput,
): CreateUserRepositoryInput {
  return {
    ...input,
    name: input.name || null,
    phone: input.phone || null,
    departmentId: input.departmentId || null,
    siteId: input.siteId || null,
    roleId: input.roleId || null,
    tenantId: input.tenantId || null,
    shiftId: input.shiftId || null,
    isActive: input.isActive ?? true,
    isAttendanceRequired: input.isAttendanceRequired ?? true,
    workingHourMode: input.workingHourMode || DEFAULT_WORKING_HOUR_MODE,
    attendanceGeofencePolicy:
      input.attendanceGeofencePolicy || DEFAULT_GEOFENCE_POLICY,
    startWorkTime: input.startWorkTime || DEFAULT_START_WORK_TIME,
    endWorkTime: input.endWorkTime || DEFAULT_END_WORK_TIME,
    workDays: input.workDays || DEFAULT_WORK_DAYS,
    flexibleTargetHour:
      input.flexibleTargetHour ?? DEFAULT_FLEXIBLE_TARGET_HOUR,
    isSales: input.isSales ?? false,
    canvasingTarget: input.canvasingTarget ?? DEFAULT_CANVASING_TARGET,
    targetSchema: input.targetSchema || DEFAULT_TARGET_SCHEMA,
    basicSalary: input.basicSalary ?? DEFAULT_NUMERIC_VALUE,
    payPeriodDay: input.payPeriodDay ?? DEFAULT_PAY_PERIOD_DAY,
    payDay: input.payDay ?? DEFAULT_PAY_DAY,
    woIncentiveEnabled: input.woIncentiveEnabled ?? false,
    woIncentiveRate: input.woIncentiveRate ?? DEFAULT_NUMERIC_VALUE,
    lateDeductionRate: input.lateDeductionRate ?? DEFAULT_NUMERIC_VALUE,
    absentDeductionRate: input.absentDeductionRate ?? DEFAULT_NUMERIC_VALUE,
    overtimeRateNormal: input.overtimeRateNormal ?? DEFAULT_NUMERIC_VALUE,
    overtimeRateHoliday: input.overtimeRateHoliday ?? DEFAULT_NUMERIC_VALUE,
    overtimeRateNational: input.overtimeRateNational ?? DEFAULT_NUMERIC_VALUE,
    overtimeCalcTypeNormal: input.overtimeCalcTypeNormal || DEFAULT_RATE_TYPE,
    overtimeCalcTypeHoliday: input.overtimeCalcTypeHoliday || DEFAULT_RATE_TYPE,
    overtimeCalcTypeNational:
      input.overtimeCalcTypeNational || DEFAULT_RATE_TYPE,
  };
}

export function toWorkingHoursUpdate(data: UserScheduleEntity) {
  const updateData: Record<string, unknown> = {
    workingHourMode: data.workingHourMode,
  };

  if (data.startWorkTime !== undefined)
    updateData.startWorkTime = data.startWorkTime;
  if (data.endWorkTime !== undefined) updateData.endWorkTime = data.endWorkTime;
  if (data.workDays !== undefined) updateData.workDays = data.workDays;
  if (data.flexibleTargetHour !== undefined) {
    updateData.flexibleTargetHour = data.flexibleTargetHour;
  }
  if (data.shiftId !== undefined) updateData.shiftId = data.shiftId;
  return updateData;
}

export function toListDTO(entity: UserEntity): UserListItemDTO {
  return {
    id: entity.id,
    email: entity.email,
    name: entity.name,
    phone: entity.phone,
    isActive: entity.isActive,
    isSales: entity.isSales,
    roleName: entity.role?.name ?? null,
    departmentName: entity.department?.name ?? null,
    siteName: entity.site?.name ?? null,
  };
}

export function toDetailDTO(entity: UserEntity): UserDetailDTO {
  return {
    id: entity.id,
    email: entity.email,
    name: entity.name,
    phone: entity.phone,
    isActive: entity.isActive,
    isSales: entity.isSales,
    isAttendanceRequired: entity.isAttendanceRequired,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    role: entity.role ?? null,
    department: entity.department ?? null,
    site: entity.site ? { id: entity.site.id, name: entity.site.name } : null,
    workingHours: {
      mode: entity.workingHourMode as WorkingHourMode,
      startWorkTime: entity.startWorkTime,
      endWorkTime: entity.endWorkTime,
      workDays: entity.workDays,
      flexibleTargetHour: entity.flexibleTargetHour,
      shift: entity.shift ?? null,
    },
    userSites: (entity.userSites ?? []).map((userSite) => ({
      siteId: userSite.siteId,
      siteName: userSite.site?.name ?? DEFAULT_SITE_NAME,
    })),
  };
}

export function toSessionDTO(
  entity: UserEntity,
  permissions: string[] = [],
): UserSessionDTO {
  return {
    id: entity.id,
    email: entity.email,
    name: entity.name,
    role: entity.role?.name ?? null,
    roleId: entity.roleId,
    departmentId: entity.departmentId,
    siteId: entity.siteId,
    permissions,
  };
}

export function toOptionDTO(entity: UserEntity): UserOptionDTO {
  return {
    id: entity.id,
    name: entity.name,
    email: entity.email,
    departmentName: entity.department?.name ?? null,
  };
}

export function toEmployeeAssignmentDTO(
  entity: UserEntity,
): EmployeeAssignmentDTO {
  return {
    id: entity.id,
    name: entity.name,
    email: entity.email,
    phone: entity.phone,
    isActive: entity.isActive,
    departmentId: entity.departmentId,
    siteId: entity.siteId,
  };
}
