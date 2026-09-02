import { Prisma } from "../repositories/prisma-boundary";
import { hasCapability } from "@/lib/permission-aliases";
import { checkSiteRestriction, canAccessSite } from "@/modules/roles";
import type { IUserRepository } from "../domain/ports/IUserRepository";
import { createUserRepository } from "../factories/RepositoryFactory";
import { UserMapper } from "../mappers/UserMapper";
import { UserService } from "./UserService";
import { fail } from "./AdminUserRouteService.helpers";
import { AdminUserRouteCreateService } from "./admin-user-route.create";
import { AdminUserRouteUpdateService } from "./admin-user-route.update";
import { eventBus, EVENT_NAMES } from "@/lib/event-bus";
import { logger } from "@/lib/logger";
import type {
  AdminSession,
  AdminUserListQuery,
  CreateAdminUserInput,
  UpdateUserPayload,
  UserRouteResult,
} from "./AdminUserRouteService.types";

const USER_NOT_FOUND = "User tidak ditemukan";
const NO_SCOPE_MATCH = "__NO_SCOPE_MATCH__";

export class AdminUserRouteService {
  private readonly userRepository: IUserRepository;

  private readonly createService: AdminUserRouteCreateService;

  private readonly updateService: AdminUserRouteUpdateService;

  constructor(userRepository: IUserRepository = createUserRepository()) {
    this.userRepository = userRepository;
    this.createService = new AdminUserRouteCreateService(userRepository);
    this.updateService = new AdminUserRouteUpdateService();
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
    const tenantId = this.resolveListTenantId(
      session,
      query.tenantId || undefined,
    );
    const [result, latestAppVersionCode] = await Promise.all([
      new UserService(this.userRepository).getAllUsers({
        siteId: isRestricted ? primarySiteId || undefined : undefined,
        tenantId,
        roleName: query.roleName || undefined,
        page: query.page ? parseInt(query.page) : undefined,
        limit: query.limit ? parseInt(query.limit) : undefined,
        search: query.search || undefined,
        isActive: this.resolveStatusFilter(query.status || undefined),
      }),
      this.resolveLatestAndroidVersionCode(tenantId),
    ]);

    const users = result.data.map((user) => ({
      ...user,
      latestAppVersionCode,
    }));

    return {
      users,
      meta: {
        total: result.total,
        active: result.active,
        inactive: result.inactive,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : result.data.length,
        latestAppVersionCode,
      },
    };
  }

  private async resolveLatestAndroidVersionCode(
    tenantId?: string,
  ): Promise<number | null> {
    try {
      const { getAppReleaseServices } = await import("@/modules/app-version");
      const { queryService } = await getAppReleaseServices();
      const latest = await queryService.getLatestActive({
        platform: "android",
        tenantId,
      });
      return latest?.versionCode ?? null;
    } catch {
      return null;
    }
  }

  /** Get user detail for admin route with self-profile and site access enforcement. */
  async getAdminUserById(
    session: AdminSession,
    userId: string,
    permissions: string[] = [],
  ) {
    const user = await this.userRepository.findByIdWithRelations(userId);
    if (!user) return fail(404, USER_NOT_FOUND);

    const isOwnProfile = session.user.id === userId;
    const canReadUsers = hasCapability(permissions, "users:read");

    if (!isOwnProfile && !canReadUsers) {
      return fail(403, "Anda tidak memiliki izin untuk melihat detail user");
    }

    if (!isOwnProfile && !canAccessSite(session, "users", user.siteId)) {
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

    const validation = this.updateService.validateUpdate(
      session,
      userId,
      currentUser,
      payload,
    );
    if (!validation.ok) return validation;

    const data = await this.updateService.buildUpdateData(
      session,
      userId,
      currentUser,
      payload,
    );
    if (!data.ok) return data;

    const { isRestricted, siteIds } = checkSiteRestriction(session, "users");
    const allowedSiteIds = isRestricted ? siteIds : undefined;

    try {
      await this.updateService.persistUpdate(
        userId,
        data.data,
        payload.userSites,
        allowedSiteIds,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return fail(
          409,
          "Site sudah terdaftar untuk user ini, silakan refresh dan coba lagi",
        );
      }
      throw error;
    }
    await this.updateService.runAfterUpdate(userId, payload);

    // Emit user lifecycle events for cross-module integration
    this.emitUserUpdateEvents(userId, currentUser, payload);

    return { ok: true, data: { ok: true } } satisfies UserRouteResult<{
      ok: true;
    }>;
  }

  /** Buat user admin lengkap dengan role tenant, sites, dan kuota cuti. */
  async createAdminUser(session: AdminSession, payload: CreateAdminUserInput) {
    return this.createService.createUser(session, payload);
  }

  async forceLogoutUser(session: AdminSession, targetUserId: string) {
    if (session.user.id === targetUserId) {
      return fail(400, "Tidak dapat force logout diri sendiri");
    }

    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) return fail(404, USER_NOT_FOUND);

    if (
      session.user.tenantId &&
      targetUser.tenantId &&
      session.user.tenantId !== targetUser.tenantId
    ) {
      return fail(403, "Anda tidak memiliki akses ke user tenant lain");
    }

    const { isRestricted } = checkSiteRestriction(session, "users");
    if (isRestricted && !canAccessSite(session, "users", targetUser.siteId)) {
      return fail(403, "Anda hanya dapat force logout user di site Anda");
    }

    const updated =
      await this.userRepository.incrementTokenVersion(targetUserId);
    if (!updated) return fail(404, USER_NOT_FOUND);

    return {
      ok: true as const,
      data: updated,
    };
  }

  /** Delete user from admin route with scoped access enforcement. */
  async deleteAdminUser(session: AdminSession, userId: string) {
    if (session.user.id === userId) {
      return fail(400, "Tidak dapat menghapus akun sendiri");
    }
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

  /** Emit USER_UPDATED or USER_DEACTIVATED events for cross-module sync. */
  private emitUserUpdateEvents(
    userId: string,
    currentUser: { tenantId?: string | null; isActive?: boolean },
    payload: UpdateUserPayload,
  ) {
    const tenantId = payload.tenantId ?? currentUser.tenantId;
    if (!tenantId) return;

    // Detect deactivation: user was active and is now being set to inactive
    const wasActive = currentUser.isActive !== false;
    const isBeingDeactivated = payload.isActive === false && wasActive;

    if (isBeingDeactivated) {
      eventBus
        .publish(EVENT_NAMES.USER_DEACTIVATED, {
          userId,
          tenantId,
          timestamp: new Date().toISOString(),
        })
        .catch((err) => {
          logger.error(
            `[AdminUserRouteService] Failed to emit USER_DEACTIVATED for ${userId}:`,
            err,
          );
        });
      return;
    }

    // Emit USER_UPDATED for salary-relevant field changes
    const changedFields = Object.keys(payload).filter(
      (key) => payload[key as keyof UpdateUserPayload] !== undefined,
    );

    const salaryRelevantFields = ["basicSalary"];
    const hasSalaryChange = changedFields.some((f) =>
      salaryRelevantFields.includes(f),
    );

    if (hasSalaryChange) {
      eventBus
        .publish(EVENT_NAMES.USER_UPDATED, {
          userId,
          tenantId,
          basicSalary: payload.basicSalary,
          changedFields,
          timestamp: new Date().toISOString(),
        })
        .catch((err) => {
          logger.error(
            `[AdminUserRouteService] Failed to emit USER_UPDATED for ${userId}:`,
            err,
          );
        });
    }
  }
}
