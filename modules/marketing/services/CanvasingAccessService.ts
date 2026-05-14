import { prismaAuth } from "@/lib/prisma";

/** Permission shape expected by extractMobileFeaturesFromPermissions. */
type PermissionWithResource = { resource: string };

/**
 * Extract mobile feature flags from an already-loaded permissions array.
 * Pure function — no DB query. Use this when the caller already has permissions loaded.
 */
export function extractMobileFeaturesFromPermissions(
  permissions: PermissionWithResource[],
): string[] {
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
 * Strictly follows RBAC permissions — 'm_canvasing' only present if assigned via role.
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
