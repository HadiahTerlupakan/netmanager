import { getTenantAdminRoleId } from "@/modules/mitra";
import { prismaAuth } from "@/modules/database";
import { AdminLeaveBalanceRouteService } from "@/modules/attendance";

import type { IUserRepository } from "../domain/ports/IUserRepository";
import { UserService } from "./UserService";
import type {
  AdminSession,
  CreateAdminUserInput,
  NewUserSiteAssignment,
} from "./AdminUserRouteService.types";
import type { LeaveType } from "../types/user.enums";
import { checkSiteRestriction } from "@/modules/roles";

const DEFAULT_FLEXIBLE_TARGET_HOUR = 8;

/** Menangani flow create user admin dan inisialisasi data turunannya. */
export class AdminUserRouteCreateService {
  constructor(private readonly userRepository: IUserRepository) {}

  /** Buat user admin lengkap dengan role tenant, site, dan kuota cuti. */
  async createUser(session: AdminSession, payload: CreateAdminUserInput) {
    const scopedPayload = this.applyCreateSiteRestriction(session, payload);
    const context = await this.buildCreationContext(session, scopedPayload);

    const { isRestricted, siteIds } = checkSiteRestriction(session, "users");
    const allowedSiteIds = isRestricted ? siteIds : undefined;

    // Validate dan prepare userSites
    const validUserSites = this.validateAndPrepareUserSites(
      scopedPayload.userSites,
      allowedSiteIds,
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

    return user;
  }

  /** Validasi dan prepare userSites sebelum create. */
  private validateAndPrepareUserSites(
    userSites?: NewUserSiteAssignment[],
    allowedSiteIds?: string[],
  ): Array<{ siteId: string; isPrimary?: boolean }> {
    const validUserSites = (userSites ?? []).filter(
      (userSite): userSite is { siteId: string; isPrimary?: boolean } =>
        Boolean(userSite.siteId),
    );

    if (validUserSites.length === 0) {
      return [];
    }

    // Validate each siteId against allowed scope
    if (allowedSiteIds && allowedSiteIds.length > 0) {
      const invalidSites = validUserSites.filter(
        (us) => !allowedSiteIds.includes(us.siteId),
      );
      if (invalidSites.length > 0) {
        throw new Error(
          "Anda tidak dapat menambahkan user ke site di luar scope Anda",
        );
      }
    }

    return validUserSites;
  }

  private applyCreateSiteRestriction(
    session: AdminSession,
    payload: CreateAdminUserInput,
  ): CreateAdminUserInput {
    const { isRestricted, primarySiteId } = checkSiteRestriction(
      session,
      "users",
    );

    if (!isRestricted) {
      return payload;
    }

    if (!primarySiteId) {
      throw new Error("User restricted to site but has no site assigned.");
    }

    if (payload.siteId && payload.siteId !== primarySiteId) {
      throw new Error("Anda hanya dapat membuat user untuk site Anda");
    }

    return { ...payload, siteId: primarySiteId };
  }

  private async buildCreationContext(
    session: AdminSession,
    payload: CreateAdminUserInput,
  ) {
    const targetTenantId = session.user.isSuperAdmin
      ? payload.tenantId || undefined
      : undefined;
    const effectiveRoleId = await this.resolveRoleId(
      payload.roleId,
      targetTenantId,
    );

    return {
      targetTenantId,
      effectiveRoleId,
      flexibleTargetHour:
        payload.flexibleTargetHour ?? DEFAULT_FLEXIBLE_TARGET_HOUR,
    };
  }

  private async resolveRoleId(roleId: string | undefined, tenantId?: string) {
    if (roleId || !tenantId) {
      return roleId;
    }

    return (await getTenantAdminRoleId(prismaAuth, tenantId)) || undefined;
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
      tenantId: context.targetTenantId || payload.tenantId || null,
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
}
