"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { isSuperAdmin } from "@/lib/auth/super-admin";
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

const EMPTY_PERMISSION_STATE: PermissionState = {
  permissions: [],
  isSuperAdmin: false,
  isLoading: false,
};

const INITIAL_PERMISSION_STATE: PermissionState = {
  ...EMPTY_PERMISSION_STATE,
  isLoading: true,
};

const SUPER_ADMIN_PERMISSION_STATE: PermissionState = {
  permissions: ["*"],
  isSuperAdmin: true,
  isLoading: false,
};

export function usePermission() {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const [permissionState, setPermissionState] = useState<PermissionState>(
    INITIAL_PERMISSION_STATE,
  );

  useEffect(() => {
    // Keep loading state until we have session
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated || !session?.user) {
      queueMicrotask(() => {
        setPermissionState(EMPTY_PERMISSION_STATE);
      });
      return;
    }

    const user = session.user as { role?: string; isSuperAdmin?: boolean };
    if (isSuperAdmin(user)) {
      queueMicrotask(() => {
        setPermissionState(SUPER_ADMIN_PERMISSION_STATE);
      });
      return;
    }

    // Keep loading state true while fetching
    queueMicrotask(() => {
      setPermissionState(INITIAL_PERMISSION_STATE);
    });

    async function fetchPermissions(): Promise<void> {
      try {
        const response = await fetch("/api/user/permissions", {
          credentials: "include",
        });

        if (!response.ok) {
          clientLogger.error(
            "[usePermission] Failed to fetch permissions:",
            response.status,
          );
          setPermissionState(EMPTY_PERMISSION_STATE);
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
        setPermissionState(EMPTY_PERMISSION_STATE);
      }
    }

    void fetchPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAuthLoading]); // Remove `session` from deps - only depend on auth status

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
