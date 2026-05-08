import { Prisma } from "../repositories/prisma-boundary";
import { prisma } from "@/modules/database";

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
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data });
      if (userSites === undefined) {
        return;
      }

      await tx.userSite.deleteMany({ where: { userId } });
      await persistUserSites(tx, userId, userSites, allowedSiteIds);
    });
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

async function persistUserSites(
  tx: Prisma.TransactionClient,
  userId: string,
  userSites: NonNullable<UpdateUserPayload["userSites"]>,
  allowedSiteIds?: string[],
): Promise<void> {
  if (userSites.length === 0) {
    await tx.user.update({ where: { id: userId }, data: { siteId: null } });
    return;
  }

  // Validate each siteId against allowed scope
  if (allowedSiteIds && allowedSiteIds.length > 0) {
    const invalidSites = userSites.filter(
      (us) => !allowedSiteIds.includes(us.siteId),
    );
    if (invalidSites.length > 0) {
      throw new Error(
        "Anda tidak dapat menambahkan user ke site di luar scope Anda",
      );
    }
  }

  await tx.userSite.createMany({
    data: userSites.map((userSite) => ({
      userId,
      siteId: userSite.siteId,
      isPrimary: userSite.isPrimary || false,
    })),
  });

  const primarySite = userSites.find((userSite) => userSite.isPrimary);
  if (!primarySite) {
    return;
  }

  await tx.user.update({
    where: { id: userId },
    data: { siteId: primarySite.siteId },
  });
}
