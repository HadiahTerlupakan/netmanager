import { prismaAuth } from "@/lib/prisma";

type PermissionWithResource = { resource: string };
type PermissionPair = { resource: string; action: string };

/** Izin opt-in bagi non-sales (mis. teknisi) untuk mencairkan bonus canvasing. */
export const CANVASING_CASHOUT_PERMISSION = "m_canvasing:cashout";

/**
 * Siapa yang boleh mencairkan bonus canvasing: sales selalu boleh; non-sales
 * hanya bila role-nya diberi `m_canvasing:cashout` (atau super admin).
 * Satu-satunya definisi aturan ini — dipakai route cashout dan profil mobile.
 */
export function canCashoutCanvasingBonus(input: {
  isSales: boolean;
  hasCashoutPermission: boolean;
}): boolean {
  return input.isSales || input.hasCashoutPermission;
}

/** Apakah daftar izin role memuat izin cashout canvasing. */
export function hasCanvasingCashoutPermission(
  permissions: PermissionPair[],
): boolean {
  return permissions.some(
    (p) => `${p.resource}:${p.action}` === CANVASING_CASHOUT_PERMISSION,
  );
}

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
