import type { Prisma } from "../repositories/prisma-boundary";
import { WorkingHourMode } from "../types/user.enums";
import type { UserScheduleEntity } from "../domain/entities/UserEntity";
import type { CreateUserRepositoryInput } from "../domain/ports/IUserRepository";
import type { CreateUserInput, UpdateUserInput } from "./UserService.types";
import {
  DEFAULT_ATTENDANCE_GEOFENCE_POLICY,
  type AttendanceGeofencePolicy,
} from "@/lib/geofencePolicy";

const DEFAULT_IS_SALES = false;
const DEFAULT_IS_ATTENDANCE_REQUIRED = true;

type UpdateFieldSetter = (
  updateData: Prisma.UserUncheckedUpdateInput,
  data: UpdateUserInput,
) => void;

const UPDATE_FIELD_SETTERS: UpdateFieldSetter[] = [
  (updateData, data) => assignIfDefined(updateData, "email", data.email),
  (updateData, data) => assignIfDefined(updateData, "name", data.name),
  (updateData, data) => assignIfDefined(updateData, "phone", data.phone),
  (updateData, data) => assignIfDefined(updateData, "isActive", data.isActive),
  (updateData, data) =>
    assignNullableIfDefined(updateData, "departmentId", data.departmentId),
  (updateData, data) =>
    assignNullableIfDefined(updateData, "siteId", data.siteId),
  (updateData, data) =>
    assignNullableIfDefined(updateData, "roleId", data.roleId),
  (updateData, data) =>
    assignNullableIfDefined(updateData, "tenantId", data.tenantId),
  (updateData, data) =>
    assignNullableIfDefined(updateData, "shiftId", data.shiftId),
  (updateData, data) =>
    assignIfDefined(updateData, "startWorkTime", data.startWorkTime),
  (updateData, data) =>
    assignIfDefined(updateData, "endWorkTime", data.endWorkTime),
  (updateData, data) => assignIfDefined(updateData, "workDays", data.workDays),
  (updateData, data) =>
    assignIfDefined(updateData, "flexibleTargetHour", data.flexibleTargetHour),
  (updateData, data) => assignIfDefined(updateData, "isSales", data.isSales),
  (updateData, data) =>
    assignIfDefined(updateData, "canvasingTarget", data.canvasingTarget),
  (updateData, data) =>
    assignIfDefined(
      updateData,
      "isAttendanceRequired",
      data.isAttendanceRequired,
    ),
  (updateData, data) =>
    assignIfDefined(updateData, "basicSalary", data.basicSalary),
  (updateData, data) =>
    assignIfDefined(updateData, "payPeriodDay", data.payPeriodDay),
  (updateData, data) => assignIfDefined(updateData, "payDay", data.payDay),
  (updateData, data) =>
    assignIfDefined(updateData, "woIncentiveEnabled", data.woIncentiveEnabled),
  (updateData, data) =>
    assignIfDefined(updateData, "woIncentiveRate", data.woIncentiveRate),
  (updateData, data) =>
    assignIfDefined(updateData, "lateDeductionRate", data.lateDeductionRate),
  (updateData, data) =>
    assignIfDefined(
      updateData,
      "absentDeductionRate",
      data.absentDeductionRate,
    ),
  (updateData, data) =>
    assignIfDefined(updateData, "overtimeRateNormal", data.overtimeRateNormal),
  (updateData, data) =>
    assignIfDefined(
      updateData,
      "overtimeRateHoliday",
      data.overtimeRateHoliday,
    ),
  (updateData, data) =>
    assignIfDefined(
      updateData,
      "overtimeRateNational",
      data.overtimeRateNational,
    ),
  assignWorkingHourMode,
  assignAttendanceGeofencePolicy,
  assignTargetSchema,
  assignOvertimeCalcTypeNormal,
  assignOvertimeCalcTypeHoliday,
  assignOvertimeCalcTypeNational,
];

/** Build repository input for creating a user. */
export function buildCreateUserInput(
  data: CreateUserInput,
  passwordHash: string,
): CreateUserRepositoryInput {
  return {
    email: data.email,
    name: data.name || null,
    passwordHash,
    phone: data.phone || null,
    departmentId: data.departmentId || null,
    siteId: data.siteId || null,
    roleId: data.roleId || null,
    isActive: data.isActive,
    workingHourMode: toWorkingHourMode(data.workingHourMode),
    attendanceGeofencePolicy: toAttendanceGeofencePolicy(
      data.attendanceGeofencePolicy,
    ),
    startWorkTime: data.startWorkTime,
    endWorkTime: data.endWorkTime,
    workDays: data.workDays,
    flexibleTargetHour: data.flexibleTargetHour,
    shiftId: data.shiftId || null,
    isSales: data.isSales || DEFAULT_IS_SALES,
    canvasingTarget: data.canvasingTarget,
    targetSchema: data.targetSchema,
    isAttendanceRequired:
      data.isAttendanceRequired ?? DEFAULT_IS_ATTENDANCE_REQUIRED,
    tenantId: data.tenantId || null,
    basicSalary: data.basicSalary,
    payPeriodDay: data.payPeriodDay,
    payDay: data.payDay,
    woIncentiveEnabled: data.woIncentiveEnabled,
    woIncentiveRate: data.woIncentiveRate,
    lateDeductionRate: data.lateDeductionRate,
    absentDeductionRate: data.absentDeductionRate,
    overtimeRateNormal: data.overtimeRateNormal,
    overtimeRateHoliday: data.overtimeRateHoliday,
    overtimeRateNational: data.overtimeRateNational,
    overtimeCalcTypeNormal: data.overtimeCalcTypeNormal,
    overtimeCalcTypeHoliday: data.overtimeCalcTypeHoliday,
    overtimeCalcTypeNational: data.overtimeCalcTypeNational,
  };
}

/** Build Prisma update payload from service input. */
export function buildUpdateUserData(
  data: UpdateUserInput,
): Prisma.UserUncheckedUpdateInput {
  const updateData: Prisma.UserUncheckedUpdateInput = {};
  UPDATE_FIELD_SETTERS.forEach((setter) => setter(updateData, data));
  return updateData;
}

/** Validate working-hours payload before repository update. */
export function validateWorkingHoursPayload(data: UserScheduleEntity): void {
  if (data.workingHourMode === WorkingHourMode.FIXED) {
    validateFixedWorkingHours(data);
  }

  if (data.workingHourMode !== WorkingHourMode.SHIFT) {
    return;
  }

  if (!data.shiftId) {
    throw new Error("Shift wajib dipilih untuk mode Shift");
  }
}

function validateFixedWorkingHours(data: UserScheduleEntity): void {
  if (!data.startWorkTime || !data.endWorkTime) {
    throw new Error(
      "Waktu mulai dan waktu selesai diperlukan untuk mode Fixed",
    );
  }

  if (!data.workDays) {
    throw new Error("Hari kerja diperlukan untuk mode Fixed");
  }
}

function toWorkingHourMode(value?: string): WorkingHourMode {
  return (value as WorkingHourMode | undefined) || WorkingHourMode.FIXED;
}

function toAttendanceGeofencePolicy(value?: string): AttendanceGeofencePolicy {
  return (
    (value as AttendanceGeofencePolicy | undefined) ||
    DEFAULT_ATTENDANCE_GEOFENCE_POLICY
  );
}

function assignIfDefined<T extends keyof Prisma.UserUncheckedUpdateInput>(
  updateData: Prisma.UserUncheckedUpdateInput,
  key: T,
  value: Prisma.UserUncheckedUpdateInput[T] | undefined,
): void {
  if (value !== undefined) {
    updateData[key] = value;
  }
}

function assignNullableIfDefined<
  T extends keyof Prisma.UserUncheckedUpdateInput,
>(
  updateData: Prisma.UserUncheckedUpdateInput,
  key: T,
  value: string | null | undefined,
): void {
  if (value !== undefined) {
    updateData[key] = value || null;
  }
}

function assignWorkingHourMode(
  updateData: Prisma.UserUncheckedUpdateInput,
  data: UpdateUserInput,
): void {
  if (data.workingHourMode !== undefined) {
    updateData.workingHourMode = data.workingHourMode as WorkingHourMode;
  }
}

function assignAttendanceGeofencePolicy(
  updateData: Prisma.UserUncheckedUpdateInput,
  data: UpdateUserInput,
): void {
  if (data.attendanceGeofencePolicy !== undefined) {
    updateData.attendanceGeofencePolicy =
      data.attendanceGeofencePolicy as AttendanceGeofencePolicy;
  }
}

function assignTargetSchema(
  updateData: Prisma.UserUncheckedUpdateInput,
  data: UpdateUserInput,
): void {
  if (data.targetSchema !== undefined) {
    updateData.targetSchema =
      data.targetSchema as Prisma.UserUncheckedUpdateInput["targetSchema"];
  }
}

function assignOvertimeCalcTypeNormal(
  updateData: Prisma.UserUncheckedUpdateInput,
  data: UpdateUserInput,
): void {
  if (data.overtimeCalcTypeNormal !== undefined) {
    updateData.overtimeCalcTypeNormal =
      data.overtimeCalcTypeNormal as Prisma.UserUncheckedUpdateInput["overtimeCalcTypeNormal"];
  }
}

function assignOvertimeCalcTypeHoliday(
  updateData: Prisma.UserUncheckedUpdateInput,
  data: UpdateUserInput,
): void {
  if (data.overtimeCalcTypeHoliday !== undefined) {
    updateData.overtimeCalcTypeHoliday =
      data.overtimeCalcTypeHoliday as Prisma.UserUncheckedUpdateInput["overtimeCalcTypeHoliday"];
  }
}

function assignOvertimeCalcTypeNational(
  updateData: Prisma.UserUncheckedUpdateInput,
  data: UpdateUserInput,
): void {
  if (data.overtimeCalcTypeNational !== undefined) {
    updateData.overtimeCalcTypeNational =
      data.overtimeCalcTypeNational as Prisma.UserUncheckedUpdateInput["overtimeCalcTypeNational"];
  }
}
