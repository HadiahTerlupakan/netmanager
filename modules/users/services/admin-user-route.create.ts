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
    const user = await this.createUserEntity(scopedPayload, context);

    await this.syncNewUserSites(user.id, scopedPayload.userSites);
    await this.initializeLeaveQuotas(
      user.id,
      scopedPayload.leaveQuotas,
      context.targetTenantId,
    );

    return user;
  }

  /** Sinkronkan assignment site untuk user baru. */
  async syncNewUserSites(userId: string, userSites?: NewUserSiteAssignment[]) {
    const validUserSites = (userSites ?? []).filter(
      (userSite): userSite is { siteId: string; isPrimary?: boolean } =>
        Boolean(userSite.siteId),
    );

    if (validUserSites.length === 0) {
      return;
    }

    await this.userRepository.syncUserSites(userId, validUserSites);
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

  private createUserEntity(
    payload: CreateAdminUserInput,
    context: {
      targetTenantId?: string;
      effectiveRoleId?: string;
      flexibleTargetHour: number;
    },
  ) {
    const userService = new UserService(this.userRepository);

    return userService.createUser({
      ...payload,
      roleId: context.effectiveRoleId || payload.roleId,
      tenantId: context.targetTenantId || payload.tenantId || null,
      flexibleTargetHour: context.flexibleTargetHour,
    });
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
