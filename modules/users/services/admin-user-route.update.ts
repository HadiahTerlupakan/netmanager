import { Prisma } from "../repositories/prisma-boundary";
import { UserRepository } from "../repositories/UserRepository";

import {
  applyEmailChange,
  applyPasswordChange,
  applyTenantChange,
  buildBaseUpdateData,
  clearUserScheduleCache,
  fail,
  publishPermissionUpdate,
  validateKepalaSalesTenant,
  validateScopedUpdate,
  validateSelfUpdate,
} from "./AdminUserRouteService.helpers";
import { validateKepalaSalesAssignment } from "../validators/user";
import type {
  AdminSession,
  UpdateUserPayload,
  UserRouteResult,
} from "./AdminUserRouteService.types";

import { assertCanAssignRoleId } from "./role-assignment-guard";
import { hitungIsSalesDariRole } from "./peran-sales-pengguna";

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
    const pesanKepalaSales = validateKepalaSalesAssignment(
      userId,
      payload.kepalaSalesId,
    );
    if (pesanKepalaSales) return fail(400, pesanKepalaSales);

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
    if (payload.roleId !== undefined) {
      // isSales turunan persona role; nilai isSales dari payload diabaikan.
      data.isSales = await hitungIsSalesDariRole(payload.roleId, (id) =>
        userRepository.findRolePersona(id),
      );
    }
    const tenantChange = await applyTenantChange({
      session,
      currentUser,
      payload,
      data,
    });

    if (!tenantChange.ok) {
      return tenantChange;
    }

    const kepalaSalesCheck = await validateKepalaSalesTenant({
      kepalaSalesId: payload.kepalaSalesId,
      tenantId:
        payload.tenantId === undefined
          ? currentUser.tenantId
          : payload.tenantId,
      findUser: (id) => userRepository.findById(id),
    });

    if (!kepalaSalesCheck.ok) {
      return kepalaSalesCheck;
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
