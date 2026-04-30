import { Prisma } from "@prisma/client";
import { checkSiteRestriction, canAccessSite } from "@/modules/roles";
import { prisma, prismaAuth } from "@/modules/database";
import { getTenantAdminRoleId } from "@/modules/mitra";
import { AdminLeaveBalanceRouteService } from "@/modules/attendance";
import type { LeaveType } from "../types/user.enums";
import type { IUserRepository } from "../domain/ports/IUserRepository";
import { createUserRepository } from "../factories/RepositoryFactory";
import { UserMapper } from "../mappers/UserMapper";
import { UserService } from "./UserService";
import {
  applyEmailChange,
  applyPasswordChange,
  applyTenantChange,
  buildBaseUpdateData,
  clearUserScheduleCache,
  fail,
  publishPermissionUpdate,
  validateScopedUpdate,
  validateSelfUpdate,
} from "./AdminUserRouteService.helpers";
import type {
  AdminSession,
  AdminUserListQuery,
  CreateAdminUserInput,
  NewUserSiteAssignment,
  UpdateUserPayload,
  UserRouteResult,
} from "./AdminUserRouteService.types";

const USER_NOT_FOUND = "User tidak ditemukan";
const NO_SCOPE_MATCH = "__NO_SCOPE_MATCH__";

export class AdminUserRouteService {
  private readonly userRepository: IUserRepository;

  constructor(userRepository: IUserRepository = createUserRepository()) {
    this.userRepository = userRepository;
  }

  /** Get paginated users for admin route with tenant and site scoping. */
  async getAdminUsers(
    session: AdminSession,
    query: AdminUserListQuery,
    permissions: string[],
  ) {
    const { isRestricted, primarySiteId } = checkSiteRestriction(
      { ...session, user: { ...session.user, permissions } },
      "users",
    );
    const result = await new UserService(this.userRepository).getAllUsers({
      siteId: isRestricted ? primarySiteId || undefined : undefined,
      tenantId: this.resolveListTenantId(session, query.tenantId || undefined),
      roleName: query.roleName || undefined,
      page: query.page ? parseInt(query.page) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      search: query.search || undefined,
      isActive: this.resolveStatusFilter(query.status || undefined),
    });

    return {
      users: result.data,
      meta: {
        total: result.total,
        active: result.active,
        inactive: result.inactive,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : result.data.length,
      },
    };
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

    const validation = this.validateAdminUserUpdate(
      session,
      userId,
      currentUser,
      payload,
    );
    if (!validation.ok) return validation;

    const data = await this.buildAdminUserUpdateData(
      session,
      userId,
      currentUser,
      payload,
    );
    if (!data.ok) return data;

    await this.persistUserUpdate(userId, data.data, payload.userSites);
    await this.afterAdminUserUpdate(userId, payload);
    return { ok: true, data: { ok: true } } satisfies UserRouteResult<{
      ok: true;
    }>;
  }

  /** Buat user admin lengkap dengan role tenant, sites, dan kuota cuti. */
  async createAdminUser(session: AdminSession, payload: CreateAdminUserInput) {
    const scopedPayload = this.applyCreateSiteRestriction(session, payload);
    const creationContext = await this.buildAdminUserCreationContext(
      session,
      scopedPayload,
    );
    const user = await this.createUserEntity(
      scopedPayload,
      creationContext.effectiveRoleId,
      creationContext.targetTenantId,
      creationContext.flexibleTargetHour,
    );

    await this.syncNewUserSites(user.id, scopedPayload.userSites);
    await this.initializeLeaveQuotas(
      user.id,
      scopedPayload.leaveQuotas,
      creationContext.targetTenantId,
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

  /** Memvalidasi aturan update user admin sebelum persist. */
  private validateAdminUserUpdate(
    session: AdminSession,
    userId: string,
    currentUser: Parameters<typeof validateSelfUpdate>[1],
    payload: UpdateUserPayload,
  ) {
    const isSelfUpdate = session.user.id === userId;
    const selfValidation = validateSelfUpdate(
      isSelfUpdate,
      currentUser,
      payload,
    );
    if (!selfValidation.ok) return selfValidation;

    return validateScopedUpdate(session, isSelfUpdate, currentUser, payload);
  }

  /** Membangun payload update user admin yang aman dipersist. */
  private async buildAdminUserUpdateData(
    session: AdminSession,
    userId: string,
    currentUser: Parameters<typeof validateSelfUpdate>[1],
    payload: UpdateUserPayload,
  ): Promise<UserRouteResult<Prisma.UserUncheckedUpdateInput>> {
    const data = buildBaseUpdateData(payload);
    const tenantChange = await applyTenantChange({
      session,
      currentUser,
      payload,
      data,
    });
    if (!tenantChange.ok) return tenantChange;

    const emailChange = await applyEmailChange({
      userId,
      currentEmail: currentUser.email,
      nextEmail: payload.email,
      data,
    });
    if (!emailChange.ok) return emailChange;

    await applyPasswordChange(payload.password, data);
    return { ok: true, data };
  }

  /** Menjalankan side effect setelah update user admin selesai. */
  private async afterAdminUserUpdate(
    userId: string,
    payload: UpdateUserPayload,
  ): Promise<void> {
    await clearUserScheduleCache(userId);
    if (payload.roleId !== undefined) {
      await publishPermissionUpdate(userId);
    }
  }

  /** Terapkan pembatasan site saat admin membuat user. */
  private applyCreateSiteRestriction(
    session: AdminSession,
    payload: CreateAdminUserInput,
  ): CreateAdminUserInput {
    const { isRestricted, primarySiteId } = checkSiteRestriction(
      session,
      "users",
    );
    if (!isRestricted) return payload;
    if (!primarySiteId) {
      throw new Error("User restricted to site but has no site assigned.");
    }
    if (payload.siteId && payload.siteId !== primarySiteId) {
      throw new Error("Anda hanya dapat membuat user untuk site Anda");
    }
    return { ...payload, siteId: primarySiteId };
  }

  /** Membangun konteks pembuatan user admin. */
  private async buildAdminUserCreationContext(
    session: AdminSession,
    payload: CreateAdminUserInput,
  ) {
    const targetTenantId = this.resolveTargetTenantId(
      session,
      payload.tenantId,
    );
    return {
      targetTenantId,
      effectiveRoleId: await this.resolveRoleId(payload.roleId, targetTenantId),
      flexibleTargetHour: payload.flexibleTargetHour
        ? Number(payload.flexibleTargetHour)
        : 8,
    };
  }

  /** Tentukan tenant filter daftar user admin. */
  private resolveListTenantId(session: AdminSession, tenantId?: string) {
    if (!session.user.isSuperAdmin) return session.user.tenantId || undefined;
    return tenantId || session.user.tenantId || undefined;
  }

  /** Tentukan status aktif dari query route admin. */
  private resolveStatusFilter(status?: string) {
    if (status === "active") return true;
    if (status === "inactive") return false;
    return undefined;
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
