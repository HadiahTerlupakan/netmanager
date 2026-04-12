import { getServerSession } from "next-auth";
import { authOptions, getUserPermissions, isSuperAdminUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function ensureEmployeeAccess(permission?: string) {
  const session = await getServerSession(authOptions);

  // 1. Check authentication
  if (!session || !session.user) {
    redirect("/karyawan/login");
  }

  // 2. Check Employee Portal Access
  const user = session.user as {
    role: string;
    accessEmployeePanel?: boolean;
    permissions?: string[];
    isSuperAdmin?: boolean;
  };
  // SUPER_ADMIN bypass
  if (
    user.isSuperAdmin ||
    user.role === "SUPER_ADMIN" ||
    user.role === "Super Admin"
  ) {
    return user;
  }

  if (!user.accessEmployeePanel) {
    // If logged in but no access to portal, redirect to error or login with error
    redirect("/karyawan/login?error=AccessDenied");
  }

  // 3. Check Specific Permission
  if (permission) {
    const userPermissions = (user.permissions as string[]) || [];
    const hasPermission = userPermissions.includes(permission);

    if (!hasPermission) {
      // Redirect to dashboard with unauthorized error if trying to access restricted page
      // If already on dashboard, maybe just return null? But this function is for page protection.
      redirect("/karyawan/dashboard?error=Unauthorized");
    }
  }

  return user;
}

export async function ensureAdminAccess(permission?: string) {
  const session = await getServerSession(authOptions);

  // 1. Check authentication
  if (!session || !session.user) {
    redirect("/admin/login");
  }

  // 2. Check Admin Portal Access
  const user = session.user as {
    role: string;
    accessAdminPanel?: boolean;
    permissions?: string[];
    isSuperAdmin?: boolean;
  };

  // SUPER_ADMIN bypass
  if (isSuperAdminUser(user)) {
    return user;
  }

  if (!user.accessAdminPanel) {
    // If logged in but no access to admin portal, redirect to error
    // Important: This handles the "Session Leakage" case where an Employee session
    // is active but tries to access Admin portal.
    redirect("/admin/login?error=AccessDenied");
  }

  // 3. Check Specific Permission
  if (permission) {
    const userPermissions = (user.permissions as string[]) || [];
    const hasPermission = userPermissions.includes(permission);

    if (!hasPermission) {
      redirect("/admin/forbidden");
    }
  }

  return user;
}

export interface AdminDashboardAccess {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string;
    isSuperAdmin?: boolean;
    tenantId?: string | null;
  };
  tenantId: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export async function ensureAdminDashboardAccess(
  permission = "dashboard:read",
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !session.user.tenantId) {
    redirect("/admin/login");
  }

  const user = session.user as {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string;
    isSuperAdmin?: boolean;
    accessAdminPanel?: boolean;
    tenantId?: string | null;
  };

  const isSuperAdmin = isSuperAdminUser(user);

  if (!isSuperAdmin && !user.accessAdminPanel) {
    redirect("/admin/login?error=AccessDenied");
  }

  const permissions = isSuperAdmin ? ["*"] : await getUserPermissions(user.id);

  if (!isSuperAdmin && !permissions.includes(permission)) {
    redirect("/admin/forbidden");
  }

  return {
    user,
    tenantId: user.tenantId,
    permissions,
    isSuperAdmin,
  };
}
