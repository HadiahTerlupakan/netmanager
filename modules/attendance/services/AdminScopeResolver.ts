import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { UserLookupService } from "@/modules/users";

export type AdminScope = {
  isSuperAdmin: boolean;
  siteId?: string;
  departmentId?: string;
};

/** Resolve site/department restriction scope for an admin user. */
export async function resolveAdminScope(
  user: { id: string; role?: string | null; isSuperAdmin?: boolean | null },
  permissionKeys: { siteOnly: string; departmentOnly: string },
  userLookup: UserLookupService = new UserLookupService(),
): Promise<AdminScope> {
  if (isSuperAdmin(user)) {
    return { isSuperAdmin: true };
  }

  const [permissions, dbUser] = await Promise.all([
    getUserPermissions(user.id),
    userLookup.findById(user.id),
  ]);

  const scope: AdminScope = { isSuperAdmin: false };

  if (permissions.includes(permissionKeys.siteOnly)) {
    scope.siteId = dbUser?.siteId || "";
  }
  if (permissions.includes(permissionKeys.departmentOnly)) {
    scope.departmentId = dbUser?.departmentId || "";
  }

  return scope;
}
