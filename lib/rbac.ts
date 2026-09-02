import { logger } from "@/lib/logger";
import { resolveRbacPrincipal } from "@/lib/rbac-principal";
import {
  authConfig,
  getUserPermissions,
  isSuperAdmin as isSuperAdminHelper,
} from "@/lib/auth";
import { getServerSession } from "next-auth";
import type { User } from "next-auth";
import {
  hasPermissionWithAlias,
  expandPermissionsWithAliases,
} from "@/lib/permission-aliases";

interface ExtendedUser extends User {
  id: string;
  role?: string;
  isSuperAdmin?: boolean;
}

/** Ambil user sesi NextAuth, null bila tidak ada. */
async function getSessionUser(): Promise<ExtendedUser | null> {
  const session = await getServerSession(authConfig);
  return (session?.user as ExtendedUser | null) ?? null;
}

/**
 * Ambil principal dari token Bearer mobile lewat header request.
 * Dipakai sebagai cadangan supaya pemanggil Bearer tidak selalu dianggap
 * tidak punya izin — lihat catatan di `lib/rbac-principal.ts`.
 */
async function getBearerUser(): Promise<ExtendedUser | null> {
  const { headers } = await import("next/headers");
  const authHeader = (await headers()).get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length);
  if (!token || token === "null") {
    return null;
  }

  const { verifyMobileToken } = await import("@/lib/mobile-auth");
  const payload = await verifyMobileToken(token);
  if (!payload) {
    return null;
  }

  const claims = payload as Record<string, unknown>;
  return {
    id: (claims.userId as string) || (claims.sub as string) || "",
    role: claims.role as string | undefined,
    isSuperAdmin: Boolean(claims.isSuperAdmin),
  } as ExtendedUser;
}

/** Principal untuk pengecekan permission: eksplisit > sesi > token Bearer. */
async function resolveCurrentUser(
  user?: { id?: string; role?: string; isSuperAdmin?: boolean } | null,
): Promise<ExtendedUser | null> {
  return (await resolveRbacPrincipal({
    explicitUser: user ?? null,
    getSessionUser,
    getBearerUser,
  })) as ExtendedUser | null;
}

export async function hasPermission(
  requiredPermission: string,
  user?: { id?: string; role?: string; isSuperAdmin?: boolean } | null,
  options: { silent?: boolean } = {},
): Promise<boolean> {
  const currentUser = await resolveCurrentUser(user);

  if (!currentUser) {
    if (!options.silent) logger.info("[RBAC] No user found in session");
    return false;
  }

  // Load permissions from database since session doesn't store them
  // Note: SUPER_ADMIN has all permissions from seed, so no bypass needed
  const userId = currentUser.id;
  if (!userId) {
    if (!options.silent) logger.info("[RBAC] No userId found");
    return false;
  }

  // Bypass for SUPER_ADMIN to prevent lockout if permissions are missing in DB
  if (isSuperAdminHelper(currentUser)) {
    return true;
  }

  // Debugging non-super admin access
  const permissions = await getUserPermissions(userId);

  // Check for wildcard permission
  if (permissions.includes("*")) {
    return true;
  }

  // Check permission with alias support
  const has = hasPermissionWithAlias(permissions, requiredPermission);

  if (!has && !options.silent) {
    logger.info(
      `[RBAC] Access Denied. User: ${userId}, Role: ${currentUser.role}, Required: ${requiredPermission}, Has: ${permissions.length} perms`,
    );
  }

  return has;
}

export async function hasAnyPermission(
  requiredPermissions: string[],
  user?: { id?: string; role?: string; isSuperAdmin?: boolean } | null,
): Promise<boolean> {
  // ... same as before ...
  const currentUser = await resolveCurrentUser(user);

  if (!currentUser) return false;

  // Load permissions from database since session doesn't store them
  // Note: SUPER_ADMIN has all permissions from seed, so no bypass needed
  const userId = currentUser.id;
  if (!userId) {
    return false;
  }

  // Bypass for SUPER_ADMIN
  if (isSuperAdminHelper(currentUser)) {
    return true;
  }

  const permissions = await getUserPermissions(userId);

  // Check for wildcard permission
  if (permissions.includes("*")) {
    return true;
  }

  // Expand required permissions with aliases and check if any match
  const expandedRequired = expandPermissionsWithAliases(requiredPermissions);
  return expandedRequired.some((p) => permissions.includes(p));
}

export async function getCurrentUser() {
  const session = await getServerSession(authConfig);
  return session?.user;
}

export async function ensurePermission(
  requiredPermission: string,
  redirectTo: string = "/admin/forbidden",
) {
  const session = await getServerSession(authConfig);
  const user = session?.user as ExtendedUser | null;

  // Pass user explicitly to avoid double session fetch
  const has = await hasPermission(requiredPermission, user);

  if (!has) {
    // Construct detailed error message for debugging
    const reason = encodeURIComponent(
      `Missing permission: ${requiredPermission}`,
    );
    const debugInfo = user
      ? encodeURIComponent(`Role: ${user.role}, IsSuper: ${user.isSuperAdmin}`)
      : "NoSession";

    const { redirect } = await import("next/navigation");
    redirect(`${redirectTo}?reason=${reason}&debug=${debugInfo}`);
  }
}

/**
 * Check if user has ANY of the required permissions
 * Useful for section layouts where user needs at least one submenu permission
 */
export async function ensureAnyPermission(
  requiredPermissions: string[],
  redirectTo: string = "/admin/forbidden",
) {
  const has = await hasAnyPermission(requiredPermissions);
  if (!has) {
    const { redirect } = await import("next/navigation");
    redirect(redirectTo);
  }
}

/**
 * Ensure the current user is from the main tenant
 */
export async function ensureMainTenant(
  redirectTo: string = "/admin/forbidden",
) {
  const session = await getServerSession(authConfig);
  const { MAIN_TENANT_ID } = await import("@/modules/mitra");

  if (session?.user?.tenantId !== MAIN_TENANT_ID) {
    const { redirect } = await import("next/navigation");
    redirect(
      `${redirectTo}?reason=${encodeURIComponent("Hanya untuk tenant utama")}`,
    );
  }
}
