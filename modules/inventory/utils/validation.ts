import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";
import type { UserSession } from "@/lib/auth";

export type ValidatedGudangSiteAccessResult = {
  allowed: boolean;
  error?: string;
  gudang?: {
    id: string;
    tenantId: string | null;
    sites: Array<{
      id: string;
    }>;
  };
};

/**
 * Validate site-scoped akses user ke Gudang berdasarkan RBAC dan Site restrictions.
 * Rules:
 * 1. SUPER_ADMIN -> Allowed
 * 2. User WITHOUT 'k_barang:site_only' -> Allowed (Assumes global access or access managed by other means)
 * 3. User WITH 'k_barang:site_only' -> Must have siteId matching one of the Gudang's sites.
 */
function getLegacySiteId(user: UserSession): string | undefined {
  return Reflect.get(user, "siteId") as string | undefined;
}

export async function validateGudangSiteAccess(
  session: Session,
  gudangId: string,
): Promise<ValidatedGudangSiteAccessResult> {
  // 1. Check Super Admin
  const user = session.user as UserSession;
  const userRole = user.role;
  if (userRole === "SUPER_ADMIN") {
    return { allowed: true };
  }

  // 2. Check Permission
  const permissions = user.permissions || [];
  const hasSiteRestriction = permissions.includes("k_barang:site_only");

  if (!hasSiteRestriction) {
    return { allowed: true };
  }

  // 3. Check Site Match
  const userSiteId =
    user.primarySiteId ?? user.siteIds?.[0] ?? getLegacySiteId(user);
  if (!userSiteId) {
    return {
      allowed: false,
      error: "User tidak memiliki Site ID namun dibatasi aksesnya per Site.",
    };
  }

  const gudang = await prisma.gudang.findUnique({
    where: { id: gudangId },
    select: {
      id: true,
      tenantId: true,
      sites: true,
    },
  });

  if (!gudang) {
    return { allowed: false, error: "Gudang tidak ditemukan." };
  }

  const hasAccess = gudang.sites.some((site) => site.id === userSiteId);

  const trustedGudang = {
    id: gudang.id,
    tenantId: gudang.tenantId,
    sites: gudang.sites.map((site) => ({ id: site.id })),
  };

  if (!hasAccess) {
    return {
      allowed: false,
      error: "Anda tidak memiliki akses ke Gudang ini (Beda Site).",
      gudang: trustedGudang,
    };
  }

  return { allowed: true, gudang: trustedGudang };
}
