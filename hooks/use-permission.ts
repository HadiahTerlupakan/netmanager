"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import {
  hasPermissionWithAlias,
  expandPermissionsWithAliases,
} from "@/lib/permission-aliases";
import { clientLogger } from "@/lib/client-logger";

interface PermissionState {
  permissions: string[];
  isSuperAdmin: boolean;
  isLoading: boolean;
}

/**
 * Client-side helper to check if user is Super Admin
 * Mirrors the server-side logic in lib/auth.ts
 */
function checkIsSuperAdmin(
  user: { role?: string | null; isSuperAdmin?: boolean } | null | undefined,
): boolean {
  if (!user) return false;
  // Check the boolean flag first (new schema)
  if (user.isSuperAdmin === true) return true;
  // Fallback to legacy string check
  if (!user.role) return false;
  return user.role === "SUPER_ADMIN" || user.role === "Super Admin";
}

export function usePermission() {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const [permissionState, setPermissionState] = useState<PermissionState>({
    permissions: [],
    isSuperAdmin: false,
    isLoading: true,
  });

  // Fetch permissions from API when session is available
  useEffect(() => {
    if (!isAuthenticated || !session?.user) {
      // Defer state update to avoid synchronous setState in effect
      requestAnimationFrame(() => {
        setPermissionState({
          permissions: [],
          isSuperAdmin: false,
          isLoading: false,
        });
      });
      return;
    }

    // Check if user is super admin from session (quick check)
    const user = session.user as { role?: string; isSuperAdmin?: boolean };
    // Use centralized helper function
    if (checkIsSuperAdmin(user)) {
      // Defer state update to avoid synchronous setState in effect
      requestAnimationFrame(() => {
        setPermissionState({
          permissions: ["*"],
          isSuperAdmin: true,
          isLoading: false,
        });
      });
      return;
    }

    // Fetch permissions from API
    const fetchPermissions = async () => {
      try {
        const response = await fetch("/api/user/permissions", {
          credentials: "include",
        });

        if (!response.ok) {
          clientLogger.error(
            "[usePermission] Failed to fetch permissions:",
            response.status,
          );
          setPermissionState({
            permissions: [],
            isSuperAdmin: false,
            isLoading: false,
          });
          return;
        }

        const data = await response.json();
        setPermissionState({
          permissions: data.permissions || [],
          isSuperAdmin: data.isSuperAdmin || false,
          isLoading: false,
        });
      } catch (error) {
        clientLogger.error(
          "[usePermission] Error fetching permissions:",
          error,
        );
        setPermissionState({
          permissions: [],
          isSuperAdmin: false,
          isLoading: false,
        });
      }
    };

    fetchPermissions();
  }, [isAuthenticated, session]);

  const hasPermission = useCallback(
    (requiredPermission: string) => {
      // Super Admin has all permissions
      if (permissionState.isSuperAdmin) return true;
      if (permissionState.permissions.includes("*")) return true;

      // Use alias-aware permission check
      return hasPermissionWithAlias(
        permissionState.permissions,
        requiredPermission,
      );
    },
    [permissionState],
  );

  const hasAnyPermission = useCallback(
    (requiredPermissions: string[]) => {
      // Super Admin has all permissions
      if (permissionState.isSuperAdmin) return true;
      if (permissionState.permissions.includes("*")) return true;

      // Expand permissions with aliases and check if any match
      const expandedRequired =
        expandPermissionsWithAliases(requiredPermissions);
      return expandedRequired.some((p) =>
        permissionState.permissions.includes(p),
      );
    },
    [permissionState],
  );

  return {
    hasPermission,
    hasAnyPermission,
    isLoading: isAuthLoading || permissionState.isLoading,
    isAuthenticated,
    user: session?.user,
    role: session?.user?.role,
    permissions: permissionState.permissions,
    isSuperAdmin: permissionState.isSuperAdmin,
  };
}
