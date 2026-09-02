import { Prisma } from "../repositories/prisma-boundary";
import { UserRepository } from "../repositories/UserRepository";

import {
  applyEmailChange,
  applyPasswordChange,
  applyTenantChange,
  buildBaseUpdateData,
  clearUserScheduleCache,
  publishPermissionUpdate,
  validateScopedUpdate,
  validateSelfUpdate,
} from "./AdminUserRouteService.helpers";
import type {
  AdminSession,
  UpdateUserPayload,
  UserRouteResult,
} from "./AdminUserRouteService.types";

import { assertCanAssignRoleId } from "./role-assignment-guard";

const userRepository = new UserRepository();

/** Menangani validasi, persist, dan side effect update user admin. */
export class AdminUserRouteUpdateService {
  /** Validasi update user admin sebelum persist. */
  validateUpdate(
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

    if (!selfValidation.ok) {
      return selfValidation;
    }

    return validateScopedUpdate(session, isSelfUpdate, currentUser, payload);
  }

  /** Bangun payload update aman untuk tabel user. */
  async buildUpdateData(
    session: AdminSession,
    userId: string,
    currentUser: Parameters<typeof validateSelfUpdate>[1],
    payload: UpdateUserPayload,
  ): Promise<UserRouteResult<Prisma.UserUncheckedUpdateInput>> {
    await assertCanAssignRoleId({
      roleId: payload.roleId,
      actorPermissions: session.user.permissions ?? [],
      actorIsSuperAdmin: session.user.isSuperAdmin,
    });

    const data = buildBaseUpdateData(payload);
    const tenantChange = await applyTenantChange({
      session,
      currentUser,
      payload,
      data,
    });

    if (!tenantChange.ok) {
      return tenantChange;
    }

    const emailChange = await applyEmailChange({
      userId,
      currentEmail: currentUser.email,
      nextEmail: payload.email,
      data,
    });

    if (!emailChange.ok) {
      return emailChange;
    }

    await applyPasswordChange(payload.password, data);
    return { ok: true, data };
  }

  /** Simpan update user dan assignment multi-site dalam satu transaksi. */
  async persistUpdate(
    userId: string,
    data: Prisma.UserUncheckedUpdateInput,
    userSites: UpdateUserPayload["userSites"],
    allowedSiteIds?: string[],
  ): Promise<void> {
    if (userSites && allowedSiteIds && allowedSiteIds.length > 0) {
      const invalidSites = userSites.filter(
        (userSite) => !allowedSiteIds.includes(userSite.siteId),
      );
      if (invalidSites.length > 0) {
        throw new Error(
          "Anda tidak dapat menambahkan user ke site di luar scope Anda",
        );
      }
    }

    await userRepository.updateWithSites(userId, data, userSites);
  }

  /** Jalankan side effect setelah update user selesai. */
  async runAfterUpdate(
    userId: string,
    payload: UpdateUserPayload,
  ): Promise<void> {
    await clearUserScheduleCache(userId);
    if (payload.roleId !== undefined) {
      await publishPermissionUpdate(userId);
    }
  }
}
