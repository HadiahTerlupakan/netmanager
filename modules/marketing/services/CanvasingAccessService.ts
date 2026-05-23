import { prismaAuth } from "@/lib/prisma";

type PermissionWithResource = { resource: string };

/**
 * Extract mobile feature flags from an already-loaded permissions array.
 * Pure function — no DB query. Use this when the caller already has
 * permissions loaded (e.g. mobile profile route).
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
 * Resolve mobile features for a user via DB lookup. Used by mobile auth
 * endpoints yang belum punya permissions ter-load (login, /me bootstrap).
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
