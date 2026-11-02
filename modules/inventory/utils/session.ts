import type { Session } from "next-auth";

import { prisma } from "@/modules/database";

const SESSION_DURATION_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

type InventoryAccessUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  siteId?: string | null;
};

/**
 * Bangun sesi akses inventory dengan data site, role, dan permission terbaru.
 *
 * `permissions` wajib dikirim: objek user dari `createHandler` tidak membawa
 * permission (permission ada di `ctx.permissions`). Dulu sesi ini dibangun
 * tanpanya, sehingga `validateGudangSiteAccess` tidak pernah melihat
 * `*:site_only` dan pencatatan barang masuk/keluar/transfer lolos ke gudang
 * site mana pun.
 *
 * Site diambil dari basis data — site utama plus seluruh `userSites` — agar
 * sama dengan yang dipakai jalur daftar dan `bolehAksesGudang`.
 */
export async function buildInventoryAccessSession(
  user: InventoryAccessUser,
  permissions: readonly string[],
): Promise<Session> {
  const persistedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      siteId: true,
      role: true,
      userSites: { select: { siteId: true } },
    },
  });
  const primarySiteId = persistedUser ? persistedUser.siteId : user.siteId;
  const siteIds = [
    ...new Set([
      ...(primarySiteId ? [primarySiteId] : []),
      ...(persistedUser?.userSites.map((userSite) => userSite.siteId) ?? []),
    ]),
  ];

  return {
    user: {
      ...user,
      siteId: primarySiteId,
      primarySiteId,
      siteIds,
      role: persistedUser?.role ?? user.role,
      permissions: [...permissions],
    },
    expires: new Date(
      Date.now() + SESSION_DURATION_IN_MILLISECONDS,
    ).toISOString(),
  } as Session;
}
