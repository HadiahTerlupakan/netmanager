import { logger } from "@/lib/logger";
import { hash } from "bcryptjs";
import {
  AttendanceGeofencePolicy,
  Prisma,
  RateType,
  TargetSchema,
  WorkingHourMode,
} from "../repositories/prisma-boundary";
import { invalidatePermissionCache } from "@/lib/auth";
import { firebaseRealtimeService } from "@/lib/realtime";
import { redis } from "@/lib/redis";
import { checkGlobalIdentifier } from "@/lib/validations/global-identifier";
import { checkSiteRestriction, canAccessSite } from "@/modules/roles";
import type { UserEntity } from "../domain/entities/UserEntity";
import type {
  AdminSession,
  UpdateUserPayload,
  UserRouteResult,
} from "./AdminUserRouteService.types";

const HASH_SALT_ROUNDS = 10;
const USER_SCHEDULE_CACHE_PREFIX = "user:schedule:";

/** Membuat hasil gagal terstandar untuk route admin user. */
export function fail(code: number, message: string): UserRouteResult<never> {
  return { ok: false, error: { code, message } };
}

/** Memeriksa apakah nilai benar-benar dikirim. */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/** Membangun payload update dasar untuk tabel user. */
export function buildBaseUpdateData(
  payload: UpdateUserPayload,
): Prisma.UserUncheckedUpdateInput {
  const data: Prisma.UserUncheckedUpdateInput = {};
  applyCommonFieldUpdates(data, payload);
  applyScheduleFieldUpdates(data, payload);
  applySalaryFieldUpdates(data, payload);
  return data;
}

/** Memvalidasi update terhadap akun sendiri. */
export function validateSelfUpdate(
  isSelfUpdate: boolean,
  currentUser: UserEntity,
  payload: UpdateUserPayload,
): UserRouteResult<null> {
  if (!isSelfUpdate) return { ok: true, data: null };
  if (payload.roleId !== undefined && payload.roleId !== currentUser.roleId) {
    return fail(403, "Tidak dapat mengubah role sendiri");
  }
  if (payload.siteId !== undefined && payload.siteId !== currentUser.siteId) {
    return fail(403, "Tidak dapat mengubah site sendiri");
  }
  if (
    payload.departmentId !== undefined &&
    payload.departmentId !== currentUser.departmentId
  ) {
    return fail(403, "Tidak dapat mengubah departemen sendiri");
  }
  if (
    payload.isActive !== undefined &&
    payload.isActive !== currentUser.isActive
  ) {
    return fail(403, "Tidak dapat mengubah status aktif sendiri");
  }
  return { ok: true, data: null };
}

/** Memvalidasi update berdasarkan scope site admin. */
export function validateScopedUpdate(
  session: AdminSession,
  isSelfUpdate: boolean,
  currentUser: UserEntity,
  payload: UpdateUserPayload,
): UserRouteResult<null> {
  const { isRestricted, primarySiteId } = checkSiteRestriction(
    session,
    "users",
  );
  if (!isRestricted || isSelfUpdate) return { ok: true, data: null };
  if (!canAccessSite(session, "users", currentUser.siteId)) {
    return fail(403, "Anda hanya dapat mengupdate user di site Anda");
  }
  if (payload.siteId && payload.siteId !== primarySiteId) {
    return fail(403, "Anda tidak dapat mengubah site user ke site lain");
  }
  return { ok: true, data: null };
}

/** Menerapkan perubahan tenant jika diizinkan. */
export async function applyTenantChange(options: {
  session: AdminSession;
  currentUser: UserEntity;
  payload: UpdateUserPayload;
  data: Prisma.UserUncheckedUpdateInput;
}): Promise<UserRouteResult<null>> {
  if (options.payload.tenantId === undefined) return { ok: true, data: null };
  if (options.session.user.isSuperAdmin) {
    options.data.tenantId = options.payload.tenantId || null;
    return { ok: true, data: null };
  }
  if (options.payload.tenantId !== options.currentUser.tenantId) {
    return fail(403, "Hanya Super Admin yang dapat mengubah tenantId");
  }
  return { ok: true, data: null };
}

/** Menerapkan perubahan email sambil menjaga identifier global. */
export async function applyEmailChange(options: {
  userId: string;
  currentEmail: string;
  nextEmail: string | undefined;
  data: Prisma.UserUncheckedUpdateInput;
}): Promise<UserRouteResult<null>> {
  if (!options.nextEmail || options.nextEmail === options.currentEmail) {
    return { ok: true, data: null };
  }
  const globalCheck = await checkGlobalIdentifier(
    options.nextEmail,
    "EMPLOYEE",
    options.userId,
  );
  if (globalCheck.exists) {
    return fail(409, `Email sudah terdaftar sebagai ${globalCheck.role}`);
  }
  options.data.email = options.nextEmail;
  return { ok: true, data: null };
}

/** Menerapkan hash password baru jika dikirim. */
export async function applyPasswordChange(
  password: string | undefined,
  data: Prisma.UserUncheckedUpdateInput,
): Promise<void> {
  if (!password) return;
  data.passwordHash = await hash(password, HASH_SALT_ROUNDS);
}

/** Mempublikasikan pembaruan izin user ke cache dan realtime. */
export async function publishPermissionUpdate(userId: string): Promise<void> {
  await invalidatePermissionCache(userId);
  void firebaseRealtimeService
    .publish({
      type: "user.permissions_update",
      scope: { kind: "user", id: userId },
      payload: { userId },
    })
    .catch((error) => {
      logger.error(
        "[users/update] Failed to publish realtime permissions update",
        error,
      );
    });
}

/** Menghapus cache jadwal user setelah update. */
export async function clearUserScheduleCache(userId: string): Promise<void> {
  await redis.del(`${USER_SCHEDULE_CACHE_PREFIX}${userId}`);
}

function applyCommonFieldUpdates(
  data: Prisma.UserUncheckedUpdateInput,
  payload: UpdateUserPayload,
) {
  if (isDefined(payload.name)) data.name = payload.name;
  if (isDefined(payload.phone)) data.phone = payload.phone;
  if (isDefined(payload.roleId)) data.roleId = payload.roleId;
  if (isDefined(payload.siteId)) data.siteId = payload.siteId;
  if (isDefined(payload.departmentId)) data.departmentId = payload.departmentId;
  if (isDefined(payload.isActive)) data.isActive = payload.isActive;
  if (isDefined(payload.isSales)) data.isSales = payload.isSales;
  if (isDefined(payload.isAttendanceRequired)) {
    data.isAttendanceRequired = payload.isAttendanceRequired;
  }
}

function applyScheduleFieldUpdates(
  data: Prisma.UserUncheckedUpdateInput,
  payload: UpdateUserPayload,
) {
  if (isDefined(payload.workingHourMode)) {
    data.workingHourMode = payload.workingHourMode as WorkingHourMode;
  }
  if (isDefined(payload.attendanceGeofencePolicy)) {
    data.attendanceGeofencePolicy =
      payload.attendanceGeofencePolicy as AttendanceGeofencePolicy;
  }
  if (isDefined(payload.startWorkTime))
    data.startWorkTime = payload.startWorkTime;
  if (isDefined(payload.endWorkTime)) data.endWorkTime = payload.endWorkTime;
  if (isDefined(payload.workDays)) data.workDays = payload.workDays;
  if (isDefined(payload.flexibleTargetHour)) {
    data.flexibleTargetHour = payload.flexibleTargetHour;
  }
  if (isDefined(payload.shiftId)) data.shiftId = payload.shiftId;
  if (isDefined(payload.canvasingTarget)) {
    data.canvasingTarget = payload.canvasingTarget;
  }
  if (isDefined(payload.targetSchema)) {
    data.targetSchema = payload.targetSchema as TargetSchema;
  }
}

function applySalaryFieldUpdates(
  data: Prisma.UserUncheckedUpdateInput,
  payload: UpdateUserPayload,
) {
  if (isDefined(payload.basicSalary)) data.basicSalary = payload.basicSalary;
  if (isDefined(payload.payPeriodDay)) data.payPeriodDay = payload.payPeriodDay;
  if (isDefined(payload.payDay)) data.payDay = payload.payDay;
  if (isDefined(payload.overtimeRateNormal)) {
    data.overtimeRateNormal = payload.overtimeRateNormal;
  }
  if (isDefined(payload.overtimeRateHoliday)) {
    data.overtimeRateHoliday = payload.overtimeRateHoliday;
  }
  if (isDefined(payload.overtimeRateNational)) {
    data.overtimeRateNational = payload.overtimeRateNational;
  }
  if (isDefined(payload.overtimeCalcTypeNormal)) {
    data.overtimeCalcTypeNormal = payload.overtimeCalcTypeNormal as RateType;
  }
  if (isDefined(payload.overtimeCalcTypeHoliday)) {
    data.overtimeCalcTypeHoliday = payload.overtimeCalcTypeHoliday as RateType;
  }
  if (isDefined(payload.overtimeCalcTypeNational)) {
    data.overtimeCalcTypeNational =
      payload.overtimeCalcTypeNational as RateType;
  }
  if (isDefined(payload.woIncentiveEnabled)) {
    data.woIncentiveEnabled = payload.woIncentiveEnabled;
  }
  if (isDefined(payload.woIncentiveRate)) {
    data.woIncentiveRate = payload.woIncentiveRate;
  }
  if (isDefined(payload.lateDeductionRate)) {
    data.lateDeductionRate = payload.lateDeductionRate;
  }
  if (isDefined(payload.absentDeductionRate)) {
    data.absentDeductionRate = payload.absentDeductionRate;
  }
}
