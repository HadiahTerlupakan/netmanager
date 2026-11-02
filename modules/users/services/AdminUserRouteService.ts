import { Prisma } from "../repositories/prisma-boundary";
import { hasCapability } from "@/lib/permission-aliases";
import { filterSitePrisma, tanpaDataSamaSekali } from "@/modules/roles";
import type { IUserRepository } from "../domain/ports/IUserRepository";
import { createUserRepository } from "../factories/RepositoryFactory";
import { UserMapper } from "../mappers/UserMapper";
import { UserService } from "./UserService";
import {
  canAccessUserSite,
  fail,
  lingkupSiteAdminUser,
} from "./AdminUserRouteService.helpers";
import { AdminUserRouteCreateService } from "./admin-user-route.create";
import { AdminUserRouteUpdateService } from "./admin-user-route.update";
import { eventBus, EVENT_NAMES } from "@/lib/event-bus";
import { logger } from "@/lib/logger";
import type {
  AdminSession,
  AdminSessionUser,
  AdminUserListQuery,
  CreateAdminUserInput,
  UpdateUserPayload,
  UserRouteResult,
} from "./AdminUserRouteService.types";

const USER_NOT_FOUND = "User tidak ditemukan";
const USER_READ_SITE_FORBIDDEN = "Anda hanya dapat melihat user di site Anda";

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
    const lingkup = lingkupSiteAdminUser({
      ...session,
      user: { ...session.user, permissions },
    });
    const tenantId = this.resolveListTenantId(
      session,
      query.tenantId || undefined,
    );
    // Dibatasi tanpa site → daftar kosong (gagal tertutup).
    if (tanpaDataSamaSekali(lingkup)) {
      return this.buildEmptyUserList(query);
    }
    const [result, latestAppVersionCode] = await Promise.all([
      new UserService(this.userRepository).getAllUsers({
        siteIds: filterSitePrisma(lingkup)?.in,
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

  private buildEmptyUserList(query: AdminUserListQuery) {
    type ListedUser = Awaited<
      ReturnType<UserService["getAllUsers"]>
    >["data"][number];
    return {
      users: [] as Array<ListedUser & { latestAppVersionCode: number | null }>,
      meta: {
        total: 0,
        active: 0,
        inactive: 0,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 0,
        latestAppVersionCode: null as number | null,
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

    if (!isOwnProfile && !canAccessUserSite(session, user)) {
      return fail(403, USER_READ_SITE_FORBIDDEN);
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
    // Dengan relasi: lingkup site membaca userSites target, bukan site utama saja.
    const currentUser = await this.userRepository.findByIdWithRelations(userId);
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

    try {
      await this.updateService.persistUpdate(
        userId,
        data.data,
        payload.userSites,
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

    const targetUser =
      await this.userRepository.findByIdWithRelations(targetUserId);
    if (!targetUser) return fail(404, USER_NOT_FOUND);

    if (this.isOtherTenant(session, targetUser)) {
      return fail(403, "Anda tidak memiliki akses ke user tenant lain");
    }

    if (!canAccessUserSite(session, targetUser)) {
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

  /**
   * Memastikan admin boleh membaca data per-user turunan (mis. performa) milik
   * `targetUserId`: akun sendiri selalu boleh; selain itu wajib `users:read`,
   * tenant yang sama, dan target berada di lingkup site admin (gagal
   * tertutup untuk target tanpa site) — sama dengan detail user. `session`
   * boleh `ctx.session` apa adanya; `permissions` digabungkan di sini.
   */
  async checkUserReadAccess(
    session: AdminSessionUser,
    targetUserId: string,
    permissions: string[],
  ): Promise<UserRouteResult<null>> {
    if (session.user.id === targetUserId) return { ok: true, data: null };
    if (!hasCapability(permissions, "users:read")) {
      return fail(403, "Anda tidak memiliki akses untuk melihat data user ini");
    }
    const targetUser =
      await this.userRepository.findByIdWithRelations(targetUserId);
    if (!targetUser) return fail(404, USER_NOT_FOUND);
    if (this.isOtherTenant(session, targetUser)) {
      return fail(404, USER_NOT_FOUND);
    }
    // `checkSiteRestriction` hanya membaca `user`; `expires` sekadar pengisi
    // bentuk `Session` bila sesi berasal dari `createHandler`.
    const sessionWithPermissions: AdminSession = {
      expires: "",
      ...session,
      user: { ...session.user, permissions },
    };
    if (!canAccessUserSite(sessionWithPermissions, targetUser)) {
      return fail(403, USER_READ_SITE_FORBIDDEN);
    }
    return { ok: true, data: null };
  }

  /** Admin dan target sama-sama bertenant, tetapi tenant-nya berbeda. */
  private isOtherTenant(
    session: AdminSessionUser,
    target: { tenantId: string | null },
  ): boolean {
    return Boolean(
      session.user.tenantId &&
      target.tenantId &&
      session.user.tenantId !== target.tenantId,
    );
  }

  /** Delete user from admin route with scoped access enforcement. */
  async deleteAdminUser(session: AdminSession, userId: string) {
    if (session.user.id === userId) {
      return fail(400, "Tidak dapat menghapus akun sendiri");
    }
    const targetUser = await this.userRepository.findByIdWithRelations(userId);
    if (!targetUser) return fail(404, USER_NOT_FOUND);
    if (!canAccessUserSite(session, targetUser)) {
      return fail(403, "Anda hanya dapat menghapus user di site Anda");
    }
    const deletedUser = await this.userRepository.delete(userId);
    return {
      ok: true,
      data: { ok: true, deletedUserName: deletedUser.name },
    } satisfies UserRouteResult<{ ok: true; deletedUserName: string | null }>;
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
