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
import {
  TANPA_BATAS,
  checkSiteRestriction,
  siteBolehDiakses,
  type LingkupSite,
} from "@/modules/roles";
import type { UserEntity } from "../domain/entities/UserEntity";
import type {
  AdminSession,
  UpdateUserPayload,
  UserRouteResult,
} from "./AdminUserRouteService.types";

const HASH_SALT_ROUNDS = 10;
const USER_SCHEDULE_CACHE_PREFIX = "user:schedule:";
const USERS_RESOURCE = "users";

/** Bagian user yang menentukan di site mana ia berada. */
export type UserSiteMembership = Pick<UserEntity, "siteId"> &
  Partial<Pick<UserEntity, "userSites">>;

/**
 * Lingkup site admin atas resource `users`: SELURUH site yang ditugaskan
 * kepadanya (userSites, fallback site legacy), bukan hanya site utama.
 */
export function lingkupSiteAdminUser(session: AdminSession): LingkupSite {
  const { isRestricted, siteIds } = checkSiteRestriction(
    session,
    USERS_RESOURCE,
  );
  return isRestricted ? { dibatasi: true, siteIds } : TANPA_BATAS;
}

/** Seluruh site seorang user: site utama digabung semua userSites-nya. */
export function siteIdsMilikUser(user: UserSiteMembership): string[] {
  const siteIds = (user.userSites ?? []).map((userSite) => userSite.siteId);
  if (user.siteId) siteIds.unshift(user.siteId);
  return [...new Set(siteIds)];
}

/**
 * Apakah admin boleh bertindak atas `target`.
 *
 * Sama dengan filter daftar user: target terlihat bila site utamanya ATAU
 * salah satu userSites-nya ada di lingkup admin. User tanpa site sama sekali
 * di luar lingkup admin terbatas (gagal tertutup); hanya admin tanpa
 * pembatasan yang bisa mengurusnya (mis. menugaskan site pertamanya).
 */
export function canAccessUserSite(
  session: AdminSession,
  target: UserSiteMembership,
): boolean {
  const lingkup = lingkupSiteAdminUser(session);
  if (!lingkup.dibatasi) return true;
  return siteIdsMilikUser(target).some((siteId) =>
    siteBolehDiakses(lingkup, siteId),
  );
}

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

/**
 * Memvalidasi update berdasarkan scope site admin.
 *
 * Admin terbatas hanya boleh mengubah keanggotaan site DI DALAM lingkupnya:
 * site di luar lingkup tidak boleh ditambah maupun dicabut, dan user tidak
 * boleh dibuat tanpa site (yang berarti keluar dari lingkup siapa pun yang
 * terbatas). Berlaku juga untuk update akun sendiri.
 */
export function validateScopedUpdate(
  session: AdminSession,
  isSelfUpdate: boolean,
  currentUser: UserEntity,
  payload: UpdateUserPayload,
): UserRouteResult<null> {
  const lingkup = lingkupSiteAdminUser(session);
  if (!lingkup.dibatasi) return { ok: true, data: null };
  if (!isSelfUpdate && !canAccessUserSite(session, currentUser)) {
    return fail(403, "Anda hanya dapat mengupdate user di site Anda");
  }
  const isSiteChanged =
    payload.siteId !== undefined && payload.siteId !== currentUser.siteId;
  if (isSiteChanged && !siteBolehDiakses(lingkup, payload.siteId)) {
    return fail(403, "Anda tidak dapat mengubah site user ke site lain");
  }
  if (
    payload.userSites !== undefined &&
    !isUserSitesChangeInScope(lingkup, currentUser, payload.userSites)
  ) {
    return fail(
      403,
      "Anda tidak dapat menambahkan atau melepas site di luar scope Anda",
    );
  }
  return { ok: true, data: null };
}

function isUserSitesChangeInScope(
  lingkup: LingkupSite,
  currentUser: UserEntity,
  nextUserSites: NonNullable<UpdateUserPayload["userSites"]>,
): boolean {
  const nextSiteIds = new Set(nextUserSites.map((userSite) => userSite.siteId));
  if (nextSiteIds.size === 0) return false;
  const isOutOfScope = (siteId: string) => !siteBolehDiakses(lingkup, siteId);
  // Site utama ikut dihitung: `updateWithSites` menimpa `user.siteId` dari
  // userSites, jadi site utama legacy di luar lingkup bisa ikut tercabut.
  const currentOutOfScope = siteIdsMilikUser(currentUser).filter(isOutOfScope);
  const nextOutOfScope = [...nextSiteIds].filter(isOutOfScope);
  return (
    currentOutOfScope.length === nextOutOfScope.length &&
    currentOutOfScope.every((siteId) => nextSiteIds.has(siteId))
  );
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

/**
 * Memastikan kepala sales yang ditetapkan ada di tenant yang sama dengan
 * user yang dibawahinya — tim lintas tenant akan membocorkan rencana
 * kunjungan antartenant. `null`/`undefined` (lepas tim / tidak diubah) lolos.
 */
export async function validateKepalaSalesTenant(options: {
  kepalaSalesId: string | null | undefined;
  tenantId: string | null | undefined;
  findUser: (id: string) => Promise<Pick<UserEntity, "tenantId"> | null>;
}): Promise<UserRouteResult<null>> {
  if (!options.kepalaSalesId) return { ok: true, data: null };
  const kepalaSales = await options.findUser(options.kepalaSalesId);
  if (!kepalaSales || kepalaSales.tenantId !== (options.tenantId ?? null)) {
    return fail(400, "Kepala sales tidak ditemukan di tenant ini");
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
  if (isDefined(payload.kepalaSalesId)) {
    data.kepalaSalesId = payload.kepalaSalesId;
  }
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
