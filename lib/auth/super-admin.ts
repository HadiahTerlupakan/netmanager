export interface CanonicalAdminUser {
  role?: string | null;
  isSuperAdmin?: boolean | null;
}

export function isSuperAdminUser(
  user: CanonicalAdminUser | undefined | null,
): boolean {
  if (!user) {
    return false;
  }

  if (user.isSuperAdmin === true) {
    return true;
  }

  return user.role === "SUPER_ADMIN" || user.role === "Super Admin";
}

export function isSuperAdmin(
  user: { role?: string | null; isSuperAdmin?: boolean } | undefined | null,
): boolean {
  return isSuperAdminUser(user);
}

export function isSuperAdminRole(roleName: string | undefined | null): boolean {
  return roleName === "SUPER_ADMIN" || roleName === "Super Admin";
}
