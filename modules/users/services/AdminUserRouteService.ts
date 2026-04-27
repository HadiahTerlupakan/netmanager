import { hash } from "bcryptjs";
import type { Session } from "next-auth";
import {
  AttendanceGeofencePolicy,
  Prisma,
  RateType,
  TargetSchema,
  WorkingHourMode,
} from "@prisma/client";
import { invalidatePermissionCache } from "@/lib/auth";
import { firebaseRealtimeService } from "@/lib/realtime";
import { redis } from "@/lib/redis";
import { checkGlobalIdentifier } from "@/lib/validations/global-identifier";
import { checkSiteRestriction, canAccessSite } from "@/modules/roles";
import { prisma, prismaAuth } from "@/modules/database";
import { getTenantAdminRoleId } from "@/modules/mitra";
import { AdminLeaveBalanceRouteService } from "@/modules/attendance";
import type { LeaveType } from "@prisma/client";
import type { UserEntity } from "../domain/entities/UserEntity";
import type { IUserRepository } from "../domain/ports/IUserRepository";
import { createUserRepository } from "../factories/RepositoryFactory";
import { UserMapper } from "../mappers/UserMapper";
import { UserService } from "./UserService";

const HASH_SALT_ROUNDS = 10;
const USER_NOT_FOUND = "User tidak ditemukan";
const NO_SCOPE_MATCH = "__NO_SCOPE_MATCH__";
const USER_SCHEDULE_CACHE_PREFIX = "user:schedule:";

type NewUserSiteAssignment = {
  siteId?: string;
  isPrimary?: boolean;
};

type CreateAdminUserInput = {
  email: string;
  name?: string;
  password: string;
  phone?: string;
  roleId?: string;
  siteId?: string;
  departmentId?: string;
  isActive?: boolean;
  isSales?: boolean;
  isAttendanceRequired?: boolean;
  tenantId?: string | null;
  userSites?: Array<{ siteId: string; isPrimary?: boolean }>;
  workingHourMode?: string;
  attendanceGeofencePolicy?: string;
  startWorkTime?: string;
  endWorkTime?: string;
  workDays?: string;
  flexibleTargetHour?: number;
  shiftId?: string | null;
  canvasingTarget?: number;
  targetSchema?: string;
  basicSalary?: number;
  payPeriodDay?: number;
  payDay?: number;
  overtimeRateNormal?: number;
  overtimeRateHoliday?: number;
  overtimeRateNational?: number;
  overtimeCalcTypeNormal?: string;
  overtimeCalcTypeHoliday?: string;
  overtimeCalcTypeNational?: string;
  woIncentiveEnabled?: boolean;
  woIncentiveRate?: number;
  lateDeductionRate?: number;
  absentDeductionRate?: number;
  leaveQuotas?: Record<string, number>;
};

type UpdateUserPayload = {
  email?: string;
  name?: string;
  password?: string;
  phone?: string;
  roleId?: string | null;
  siteId?: string | null;
  isAttendanceRequired?: boolean;
  departmentId?: string | null;
  isActive?: boolean;
  isSales?: boolean;
  tenantId?: string | null;
  userSites?: Array<{ siteId: string; isPrimary?: boolean }>;
  workingHourMode?: string;
  attendanceGeofencePolicy?: string;
  startWorkTime?: string;
  endWorkTime?: string;
  workDays?: string;
  flexibleTargetHour?: number;
  shiftId?: string | null;
  canvasingTarget?: number;
  targetSchema?: string;
  basicSalary?: number;
  payPeriodDay?: number;
  payDay?: number;
  overtimeRateNormal?: number;
  overtimeRateHoliday?: number;
  overtimeRateNational?: number;
  overtimeCalcTypeNormal?: string;
  overtimeCalcTypeHoliday?: string;
  overtimeCalcTypeNational?: string;
  woIncentiveEnabled?: boolean;
  woIncentiveRate?: number;
  lateDeductionRate?: number;
  absentDeductionRate?: number;
};

type AdminSession = Session & {
  user: Session["user"] & {
    id: string;
    isSuperAdmin?: boolean;
  };
};

type UserRouteResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: number; message: string } };

function fail(code: number, message: string): UserRouteResult<never> {
  return { ok: false, error: { code, message } };
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function buildBaseUpdateData(
  payload: UpdateUserPayload,
): Prisma.UserUncheckedUpdateInput {
  const data: Prisma.UserUncheckedUpdateInput = {};
  if (isDefined(payload.name)) data.name = payload.name;
  if (isDefined(payload.phone)) data.phone = payload.phone;
  if (isDefined(payload.roleId)) data.roleId = payload.roleId;
  if (isDefined(payload.siteId)) data.siteId = payload.siteId;
  if (isDefined(payload.isAttendanceRequired))
    data.isAttendanceRequired = payload.isAttendanceRequired;
  if (isDefined(payload.departmentId)) data.departmentId = payload.departmentId;
  if (isDefined(payload.isActive)) data.isActive = payload.isActive;
  if (isDefined(payload.isSales)) data.isSales = payload.isSales;
  if (isDefined(payload.workingHourMode))
    data.workingHourMode = payload.workingHourMode as WorkingHourMode;
  if (isDefined(payload.attendanceGeofencePolicy)) {
    data.attendanceGeofencePolicy =
      payload.attendanceGeofencePolicy as AttendanceGeofencePolicy;
  }
  if (isDefined(payload.startWorkTime))
    data.startWorkTime = payload.startWorkTime;
  if (isDefined(payload.endWorkTime)) data.endWorkTime = payload.endWorkTime;
  if (isDefined(payload.workDays)) data.workDays = payload.workDays;
  if (isDefined(payload.flexibleTargetHour))
    data.flexibleTargetHour = payload.flexibleTargetHour;
  if (isDefined(payload.shiftId)) data.shiftId = payload.shiftId;
  if (isDefined(payload.canvasingTarget))
    data.canvasingTarget = payload.canvasingTarget;
  if (isDefined(payload.targetSchema))
    data.targetSchema = payload.targetSchema as TargetSchema;
  if (isDefined(payload.basicSalary)) data.basicSalary = payload.basicSalary;
  if (isDefined(payload.payPeriodDay)) data.payPeriodDay = payload.payPeriodDay;
  if (isDefined(payload.payDay)) data.payDay = payload.payDay;
  if (isDefined(payload.overtimeRateNormal))
    data.overtimeRateNormal = payload.overtimeRateNormal;
  if (isDefined(payload.overtimeRateHoliday))
    data.overtimeRateHoliday = payload.overtimeRateHoliday;
  if (isDefined(payload.overtimeRateNational))
    data.overtimeRateNational = payload.overtimeRateNational;
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
  if (isDefined(payload.woIncentiveEnabled))
    data.woIncentiveEnabled = payload.woIncentiveEnabled;
  if (isDefined(payload.woIncentiveRate))
    data.woIncentiveRate = payload.woIncentiveRate;
  if (isDefined(payload.lateDeductionRate))
    data.lateDeductionRate = payload.lateDeductionRate;
  if (isDefined(payload.absentDeductionRate))
    data.absentDeductionRate = payload.absentDeductionRate;
  return data;
}

function validateSelfUpdate(
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

function validateScopedUpdate(
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

async function applyTenantChange(
  session: AdminSession,
  currentUser: UserEntity,
  payload: UpdateUserPayload,
  data: Prisma.UserUncheckedUpdateInput,
): Promise<UserRouteResult<null>> {
  if (payload.tenantId === undefined) return { ok: true, data: null };
  if (session.user.isSuperAdmin) {
    data.tenantId = payload.tenantId || null;
    return { ok: true, data: null };
  }
  if (payload.tenantId !== currentUser.tenantId) {
    return fail(403, "Hanya Super Admin yang dapat mengubah tenantId");
  }
  return { ok: true, data: null };
}

async function applyEmailChange(
  userId: string,
  currentEmail: string,
  nextEmail: string | undefined,
  data: Prisma.UserUncheckedUpdateInput,
): Promise<UserRouteResult<null>> {
  if (!nextEmail || nextEmail === currentEmail) {
    return { ok: true, data: null };
  }
  const globalCheck = await checkGlobalIdentifier(
    nextEmail,
    "EMPLOYEE",
    userId,
  );
  if (globalCheck.exists) {
    return fail(409, `Email sudah terdaftar sebagai ${globalCheck.role}`);
  }
  data.email = nextEmail;
  return { ok: true, data: null };
}

async function applyPasswordChange(
  password: string | undefined,
  data: Prisma.UserUncheckedUpdateInput,
): Promise<void> {
  if (!password) return;
  data.passwordHash = await hash(password, HASH_SALT_ROUNDS);
}

async function publishPermissionUpdate(userId: string): Promise<void> {
  await invalidatePermissionCache(userId);
  void firebaseRealtimeService
    .publish({
      type: "user.permissions_update",
      scope: { kind: "user", id: userId },
      payload: { userId },
    })
    .catch((error) => {
      console.error(
        "[users/update] Failed to publish realtime permissions update",
        error,
      );
    });
}

async function clearUserScheduleCache(userId: string): Promise<void> {
  await redis.del(`${USER_SCHEDULE_CACHE_PREFIX}${userId}`);
}

export class AdminUserRouteService {
  private readonly userRepository: IUserRepository;

  constructor(userRepository: IUserRepository = createUserRepository()) {
    this.userRepository = userRepository;
  }

  /** Get user detail for admin route with site access enforcement. */
  async getAdminUserById(session: AdminSession, userId: string) {
    const user = await this.userRepository.findByIdWithRelations(userId);
    if (!user) return fail(404, USER_NOT_FOUND);
    if (
      session.user.id !== userId &&
      !canAccessSite(session, "users", user.siteId)
    ) {
      return fail(403, "Anda hanya dapat melihat user di site Anda");
    }
    return {
      ok: true,
      data: { user: UserMapper.toDetailDTO(user) },
    } satisfies UserRouteResult<{
      user: ReturnType<typeof UserMapper.toDetailDTO>;
    }>;
  }

  /** Update user from admin route while preserving existing behavior. */
  async updateAdminUser(
    session: AdminSession,
    userId: string,
    payload: UpdateUserPayload,
  ) {
    const currentUser = await this.userRepository.findById(userId);
    if (!currentUser) return fail(404, USER_NOT_FOUND);
    const isSelfUpdate = session.user.id === userId;
    const selfValidation = validateSelfUpdate(
      isSelfUpdate,
      currentUser,
      payload,
    );
    if (!selfValidation.ok) return selfValidation;
    const scopedValidation = validateScopedUpdate(
      session,
      isSelfUpdate,
      currentUser,
      payload,
    );
    if (!scopedValidation.ok) return scopedValidation;

    const data = buildBaseUpdateData(payload);
    const tenantChange = await applyTenantChange(
      session,
      currentUser,
      payload,
      data,
    );
    if (!tenantChange.ok) return tenantChange;
    const emailChange = await applyEmailChange(
      userId,
      currentUser.email,
      payload.email,
      data,
    );
    if (!emailChange.ok) return emailChange;

    await applyPasswordChange(payload.password, data);
    await this.persistUserUpdate(userId, data, payload.userSites);
    await clearUserScheduleCache(userId);
    if (payload.roleId !== undefined) await publishPermissionUpdate(userId);
    return { ok: true, data: { ok: true } } satisfies UserRouteResult<{
      ok: true;
    }>;
  }

  /** Buat user admin lengkap dengan role tenant, sites, dan kuota cuti. */
  async createAdminUser(session: AdminSession, payload: CreateAdminUserInput) {
    const targetTenantId = this.resolveTargetTenantId(
      session,
      payload.tenantId,
    );
    const effectiveRoleId = await this.resolveRoleId(
      payload.roleId,
      targetTenantId,
    );
    const flexibleTargetHour = payload.flexibleTargetHour
      ? Number(payload.flexibleTargetHour)
      : 8;
    const user = await this.createUserEntity(
      payload,
      effectiveRoleId,
      targetTenantId,
      flexibleTargetHour,
    );
    await this.syncNewUserSites(user.id, payload.userSites);
    await this.initializeLeaveQuotas(
      user.id,
      payload.leaveQuotas,
      targetTenantId,
    );
    return user;
  }

  /** Sync newly created user site assignments. */
  async syncNewUserSites(userId: string, userSites?: NewUserSiteAssignment[]) {
    const validUserSites = (userSites ?? []).filter(
      (userSite): userSite is { siteId: string; isPrimary?: boolean } =>
        Boolean(userSite.siteId),
    );
    if (validUserSites.length === 0) return;
    await this.userRepository.syncUserSites(userId, validUserSites);
  }

  /** Delete user from admin route with scoped access enforcement. */
  async deleteAdminUser(session: AdminSession, userId: string) {
    const targetUser = await this.userRepository.findById(userId);
    if (!targetUser) return fail(404, USER_NOT_FOUND);
    const { isRestricted } = checkSiteRestriction(session, "users");
    if (isRestricted && !canAccessSite(session, "users", targetUser.siteId)) {
      return fail(403, "Anda hanya dapat menghapus user di site Anda");
    }
    const deletedUser = await this.userRepository.delete(userId);
    return {
      ok: true,
      data: { ok: true, deletedUserName: deletedUser.name },
    } satisfies UserRouteResult<{ ok: true; deletedUserName: string | null }>;
  }

  /** Build scoped where clause for attendance deletion by user permissions. */
  buildAttendanceUserScope(
    permissions: string[],
    siteId: string | null | undefined,
    departmentId: string | null | undefined,
  ): Prisma.UserWhereInput {
    const scope: Prisma.UserWhereInput = {};
    const hasSiteOnlyScope = permissions.includes("attendance:site_only");
    const hasDepartmentOnlyScope = permissions.includes(
      "attendance:department_only",
    );
    if (hasSiteOnlyScope && !siteId) return { id: NO_SCOPE_MATCH };
    if (hasDepartmentOnlyScope && !departmentId) return { id: NO_SCOPE_MATCH };
    if (hasSiteOnlyScope) scope.siteId = siteId;
    if (hasDepartmentOnlyScope) scope.departmentId = departmentId;
    return scope;
  }

  /** Tentukan tenant tujuan pembuatan user admin. */
  private resolveTargetTenantId(
    session: AdminSession,
    tenantId?: string | null,
  ) {
    if (session.user.isSuperAdmin) return tenantId || undefined;
    return undefined;
  }

  /** Tentukan role efektif untuk user baru. */
  private async resolveRoleId(roleId: string | undefined, tenantId?: string) {
    if (roleId || !tenantId) return roleId;
    return (await getTenantAdminRoleId(prismaAuth, tenantId)) || undefined;
  }

  /** Buat entity user baru melalui service users. */
  private async createUserEntity(
    payload: CreateAdminUserInput,
    roleId: string | undefined,
    tenantId: string | undefined,
    flexibleTargetHour: number,
  ) {
    const userService = new UserService(this.userRepository);
    return userService.createUser({
      ...payload,
      roleId: roleId || payload.roleId,
      tenantId: tenantId || payload.tenantId || null,
      flexibleTargetHour,
    });
  }

  /** Inisialisasi kuota cuti bila dikirim dari route admin. */
  private async initializeLeaveQuotas(
    userId: string,
    quotas?: Record<string, number>,
    tenantId?: string | null,
  ) {
    if (!quotas || Object.keys(quotas).length === 0) return;
    const leaveBalanceService = new AdminLeaveBalanceRouteService();
    await leaveBalanceService.initializeUserQuotas(
      userId,
      quotas as Partial<Record<LeaveType, number>>,
      tenantId,
    );
  }

  /** Persist admin user update including multi-site mutation. */
  private async persistUserUpdate(
    userId: string,
    data: Prisma.UserUncheckedUpdateInput,
    userSites: UpdateUserPayload["userSites"],
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data });
      if (userSites === undefined) return;
      await tx.userSite.deleteMany({ where: { userId } });
      await this.persistUserSites(tx, userId, userSites);
    });
  }

  /** Persist user site assignments and synchronize primary site. */
  private async persistUserSites(
    tx: Prisma.TransactionClient,
    userId: string,
    userSites: NonNullable<UpdateUserPayload["userSites"]>,
  ): Promise<void> {
    if (userSites.length === 0) {
      await tx.user.update({ where: { id: userId }, data: { siteId: null } });
      return;
    }

    await tx.userSite.createMany({
      data: userSites.map((userSite) => ({
        userId,
        siteId: userSite.siteId,
        isPrimary: userSite.isPrimary || false,
      })),
    });

    const primarySite = userSites.find((userSite) => userSite.isPrimary);
    if (!primarySite) return;
    await tx.user.update({
      where: { id: userId },
      data: { siteId: primarySite.siteId },
    });
  }
}
