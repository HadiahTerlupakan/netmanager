import { getTenantAdminRoleId } from "@/modules/mitra";
import { assertCanAssignRoleId } from "./role-assignment-guard";
import { prismaAuth } from "@/modules/database";
import { AdminLeaveBalanceRouteService } from "@/modules/attendance";
import { eventBus, EVENT_NAMES } from "@/lib/event-bus";
import { logger } from "@/lib/logger";

import type { IUserRepository } from "../domain/ports/IUserRepository";
import { UserService } from "./UserService";
import {
  lingkupSiteAdminUser,
  validateKepalaSalesTenant,
} from "./AdminUserRouteService.helpers";
import { AppError } from "@/lib/errors";
import type {
  AdminSession,
  CreateAdminUserInput,
  NewUserSiteAssignment,
} from "./AdminUserRouteService.types";
import type { LeaveType } from "../types/user.enums";
import {
  siteBolehDiakses,
  tanpaDataSamaSekali,
  type LingkupSite,
} from "@/modules/roles";

const DEFAULT_FLEXIBLE_TARGET_HOUR = 8;

/** Menangani flow create user admin dan inisialisasi data turunannya. */
export class AdminUserRouteCreateService {
  constructor(private readonly userRepository: IUserRepository) {}

  /** Buat user admin lengkap dengan role tenant, site, dan kuota cuti. */
  async createUser(session: AdminSession, payload: CreateAdminUserInput) {
    const scopedPayload = this.applyCreateSiteRestriction(session, payload);
    const context = await this.buildCreationContext(session, scopedPayload);

    await this.assertScopedSitesBelongToTenant(
      scopedPayload,
      context.targetTenantId,
    );
    await this.assertKepalaSalesBelongsToTenant(
      scopedPayload.kepalaSalesId,
      context.targetTenantId,
    );

    const validUserSites = this.validateAndPrepareUserSites(
      scopedPayload.userSites,
      lingkupSiteAdminUser(session),
    );

    // Create user dengan sites dalam satu transaksi
    const user = await this.createUserEntityWithSites(
      scopedPayload,
      context,
      validUserSites,
    );

    await this.initializeLeaveQuotas(
      user.id,
      scopedPayload.leaveQuotas,
      context.targetTenantId,
    );

    // Emit USER_CREATED event for cross-module integration (salary, etc.)
    this.emitUserCreatedEvent(user, scopedPayload, context.targetTenantId);

    return user;
  }

  /** Validasi dan prepare userSites sebelum create: semuanya wajib dalam lingkup admin. */
  private validateAndPrepareUserSites(
    userSites: NewUserSiteAssignment[] | undefined,
    lingkup: LingkupSite,
  ): Array<{ siteId: string; isPrimary?: boolean }> {
    const validUserSites = (userSites ?? []).filter(
      (userSite): userSite is { siteId: string; isPrimary?: boolean } =>
        Boolean(userSite.siteId),
    );

    const hasOutOfScopeSite = validUserSites.some(
      (userSite) => !siteBolehDiakses(lingkup, userSite.siteId),
    );
    if (hasOutOfScopeSite) {
      throw new Error(
        "Anda tidak dapat menambahkan user ke site di luar scope Anda",
      );
    }

    return validUserSites;
  }

  /**
   * Admin terbatas wajib menaruh user baru di salah satu site-nya sendiri:
   * `siteId` dari payload harus termasuk seluruh site admin (bukan hanya site
   * utama); bila kosong, dipakai site utama admin (atau site pertamanya).
   */
  private applyCreateSiteRestriction(
    session: AdminSession,
    payload: CreateAdminUserInput,
  ): CreateAdminUserInput {
    const lingkup = lingkupSiteAdminUser(session);
    if (!lingkup.dibatasi) {
      return payload;
    }

    if (tanpaDataSamaSekali(lingkup)) {
      throw new Error("User restricted to site but has no site assigned.");
    }

    if (payload.siteId) {
      if (!siteBolehDiakses(lingkup, payload.siteId)) {
        throw new Error("Anda hanya dapat membuat user untuk site Anda");
      }
      return payload;
    }

    const primarySiteId = session.user.primarySiteId || session.user.siteId;
    const defaultSiteId = siteBolehDiakses(lingkup, primarySiteId)
      ? primarySiteId
      : lingkup.siteIds[0];
    return { ...payload, siteId: defaultSiteId ?? undefined };
  }

  private async buildCreationContext(
    session: AdminSession,
    payload: CreateAdminUserInput,
  ) {
    const targetTenantId = this.resolveTargetTenantId(session, payload);
    const effectiveRoleId = await this.resolveRoleId(
      payload.roleId,
      targetTenantId,
    );

    await assertCanAssignRoleId({
      roleId: effectiveRoleId,
      actorPermissions: session.user.permissions ?? [],
      actorIsSuperAdmin: session.user.isSuperAdmin,
    });

    return {
      targetTenantId,
      effectiveRoleId,
      flexibleTargetHour:
        payload.flexibleTargetHour ?? DEFAULT_FLEXIBLE_TARGET_HOUR,
    };
  }

  private resolveTargetTenantId(
    session: AdminSession,
    payload: CreateAdminUserInput,
  ) {
    if (session.user.isSuperAdmin) {
      return payload.tenantId ?? undefined;
    }

    const sessionTenantId = session.user.tenantId;
    if (!sessionTenantId) {
      throw new Error("Tenant context wajib tersedia");
    }

    return sessionTenantId;
  }

  private async resolveRoleId(roleId: string | undefined, tenantId?: string) {
    if (roleId || !tenantId) {
      return roleId;
    }

    return (await getTenantAdminRoleId(prismaAuth, tenantId)) || undefined;
  }

  private async assertScopedSitesBelongToTenant(
    payload: CreateAdminUserInput,
    tenantId?: string,
  ) {
    if (!tenantId) {
      return;
    }

    if (payload.siteId) {
      const siteCount = await prismaAuth.sites.count({
        where: { id: payload.siteId, tenantId },
      });

      if (siteCount === 0) {
        throw new Error("Site tidak ditemukan di tenant ini");
      }
    }

    const userSiteIds = (payload.userSites ?? [])
      .map((userSite) => userSite.siteId)
      .filter((siteId): siteId is string => Boolean(siteId));

    if (userSiteIds.length === 0) {
      return;
    }

    const siteCount = await prismaAuth.sites.count({
      where: {
        id: { in: userSiteIds },
        tenantId,
      },
    });

    if (siteCount !== userSiteIds.length) {
      throw new Error("Satu atau lebih site tidak ditemukan di tenant ini");
    }
  }

  /** Kepala sales wajib satu tenant dengan user baru (lihat `validateKepalaSalesTenant`). */
  private async assertKepalaSalesBelongsToTenant(
    kepalaSalesId: string | null | undefined,
    tenantId?: string,
  ) {
    const result = await validateKepalaSalesTenant({
      kepalaSalesId,
      tenantId,
      findUser: (id) => this.userRepository.findById(id),
    });

    if (result.ok === false) {
      throw new AppError(
        result.error.message,
        result.error.code,
        "VALIDATION_ERROR",
      );
    }
  }

  private async createUserEntityWithSites(
    payload: CreateAdminUserInput,
    context: {
      targetTenantId?: string;
      effectiveRoleId?: string;
      flexibleTargetHour: number;
    },
    userSites: Array<{ siteId: string; isPrimary?: boolean }>,
  ) {
    const userService = new UserService(this.userRepository);

    const userData = {
      ...payload,
      roleId: context.effectiveRoleId || payload.roleId,
      tenantId: context.targetTenantId ?? null,
      flexibleTargetHour: context.flexibleTargetHour,
    };

    // Jika ada userSites, gunakan createWithSites untuk transaksi atomik
    if (userSites.length > 0) {
      return userService.createUserWithSites(userData, userSites);
    }

    // Jika tidak ada userSites, gunakan create biasa
    return userService.createUser(userData);
  }

  private async initializeLeaveQuotas(
    userId: string,
    quotas?: Record<string, number>,
    tenantId?: string | null,
  ) {
    if (!quotas || Object.keys(quotas).length === 0) {
      return;
    }

    const leaveBalanceService = new AdminLeaveBalanceRouteService();
    await leaveBalanceService.initializeUserQuotas(
      userId,
      quotas as Partial<Record<LeaveType, number>>,
      tenantId,
    );
  }

  /** Emit USER_CREATED event for cross-module integrations (salary profile, etc.). */
  private emitUserCreatedEvent(
    user: { id: string; email: string; name?: string | null },
    payload: CreateAdminUserInput,
    tenantId?: string,
  ) {
    if (!tenantId) return;

    eventBus
      .publish(EVENT_NAMES.USER_CREATED, {
        userId: user.id,
        tenantId,
        name: user.name ?? null,
        email: user.email,
        basicSalary: payload.basicSalary ?? null,
        ptkpStatus: null, // ptkpStatus not part of create payload
        isActive: payload.isActive !== false,
        timestamp: new Date().toISOString(),
      })
      .catch((err) => {
        logger.error(
          `[AdminUserRouteCreateService] Failed to emit USER_CREATED event for ${user.id}:`,
          err,
        );
      });
  }
}
