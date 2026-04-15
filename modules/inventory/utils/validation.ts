import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";
import type { UserSession } from "@/lib/auth";

interface SiteRef {
  id: string;
}

interface UserSiteAssignment {
  siteId: string;
}

interface InventorySiteScopeInput {
  actorType: "user" | "mitra";
  isSuperAdmin: boolean;
  permissions?: string[];
}

interface InventoryAssignedSiteInput {
  primarySite?: SiteRef | null;
  userSites?: UserSiteAssignment[] | null;
  mitraSiteId?: string | null;
}

/**
 * Validate if user has access to the target Gudang based on RBAC and Site restrictions.
 * Rules:
 * 1. SUPER_ADMIN -> Allowed
 * 2. User WITHOUT 'k_barang:site_only' -> Allowed (Assumes global access or access managed by other means)
 * 3. User WITH 'k_barang:site_only' -> Must have siteId matching one of the Gudang's sites.
 */
export async function validateGudangAccess(
  session: Session,
  gudangId: string,
): Promise<{ allowed: boolean; error?: string }> {
  const user = session.user as UserSession;
  const userRole = user.role;
  if (userRole === "SUPER_ADMIN") {
    return { allowed: true };
  }

  const permissions = user.permissions || [];
  const hasSiteRestriction = permissions.includes("k_barang:site_only");

  if (!hasSiteRestriction) {
    return { allowed: true };
  }

  const assignedSiteIds = [...(user.siteIds || []), user.primarySiteId].filter(
    (siteId): siteId is string => Boolean(siteId),
  );

  if (assignedSiteIds.length === 0) {
    return {
      allowed: false,
      error:
        "User tidak memiliki Site yang ditugaskan namun dibatasi aksesnya per Site.",
    };
  }

  const gudang = await prisma.gudang.findUnique({
    where: { id: gudangId },
    include: { sites: true },
  });

  if (!gudang) {
    return { allowed: false, error: "Gudang tidak ditemukan." };
  }

  const hasAccess = gudang.sites.some((site) =>
    assignedSiteIds.includes(site.id),
  );

  if (!hasAccess) {
    return {
      allowed: false,
      error: "Anda tidak memiliki akses ke Gudang ini (Beda Site).",
    };
  }

  return { allowed: true };
}

export function isInventorySiteRestricted(
  input: InventorySiteScopeInput,
): boolean {
  if (input.actorType === "mitra") {
    return true;
  }

  if (input.isSuperAdmin) {
    return false;
  }

  return (input.permissions || []).includes("k_barang:site_only");
}

export function getAssignedInventorySiteIds(
  input: InventoryAssignedSiteInput,
): string[] {
  const assignedSiteIds = [
    ...(input.userSites?.map((site) => site.siteId) || []),
    input.primarySite?.id,
    input.mitraSiteId,
  ].filter((siteId): siteId is string => Boolean(siteId));

  return Array.from(new Set(assignedSiteIds));
}

export function buildGudangSiteFilter(siteIds: string[]): {
  sites: { some: { id: { in: string[] } } };
} {
  return {
    sites: {
      some: {
        id: { in: siteIds },
      },
    },
  };
}

export function hasGudangSiteAccess(
  gudangSiteIds: string[],
  allowedSiteIds: string[],
): boolean {
  if (allowedSiteIds.length === 0) {
    return false;
  }

  return gudangSiteIds.some((siteId) => allowedSiteIds.includes(siteId));
}
