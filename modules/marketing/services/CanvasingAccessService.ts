import { prismaAuth } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/auth";

/**
 * @deprecated This function implements the old bypass logic and should not be used for access control.
 * Use standard RBAC permissions instead.
 */
export async function canAccessCanvasingMobile(
  userId: string,
): Promise<boolean> {
  const user = await prismaAuth.user.findUnique({
    where: { id: userId },
    select: {
      isSales: true,
      role: {
        select: { name: true },
      },
    },
  });

  if (!user) return false;

  // 1. SUPER_ADMIN bypass - always allowed
  if (isSuperAdminRole(user.role?.name)) return true;

  // 2. isSales = true → Sales or Teknisi merangkap Sales
  return user.isSales === true;
}

/** Permission shape expected by extractMobileFeaturesFromPermissions. */
type PermissionWithResource = { resource: string };

/**
 * Extract mobile feature flags from an already-loaded permissions array.
 * Pure function — no DB query. Use this when the caller already has permissions loaded.
 */
export function extractMobileFeaturesFromPermissions(
  permissions: PermissionWithResource[],
): string[] {
  // Get mobile features only (m_* prefix) from role permissions.
  // Admin resources (non-m_*) are intentionally excluded —
  // mobile app only needs mobile permissions, admin permissions are irrelevant here.
  return [
    ...new Set(
      permissions
        .map((p) => p.resource)
        .filter((resource) => resource.startsWith("m_")),
    ),
  ];
}

/**
 * Get user features for mobile app.
 * Formerly included canvasing bypass logic, now strictly follows RBAC permissions.
 * The 'm_canvasing' feature will only be present if assigned via role permissions.
 *
 * @deprecated Prefer extractMobileFeaturesFromPermissions when user is already loaded.
 */
export async function getUserFeaturesWithCanvasing(
  userId: string,
): Promise<string[]> {
  const user = await prismaAuth.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!user?.role?.permission) return [];

  return extractMobileFeaturesFromPermissions(user.role.permission);
}
