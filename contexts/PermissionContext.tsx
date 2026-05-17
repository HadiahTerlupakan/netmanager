"use client";

import { useSession } from "next-auth/react";
import { createContext, useContext, useState, useCallback } from "react";
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

interface PermissionContextValue extends PermissionState {
  hasPermission: (requiredPermission: string) => boolean;
  hasAnyPermission: (requiredPermissions: string[]) => boolean;
  isAuthenticated: boolean;
  user: unknown;
  role: unknown;
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

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const [permissionState, setPermissionState] = useState<PermissionState>(
    INITIAL_PERMISSION_STATE,
  );

  // Auth state key untuk deteksi perubahan via render-time comparator (pattern C)
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const authKey = `${isAuthLoading ? "loading" : isAuthenticated ? "auth" : "unauth"}|${userId ?? ""}`;
  const [prevAuthKey, setPrevAuthKey] = useState<string | null>(null);

  if (prevAuthKey !== authKey) {
    setPrevAuthKey(authKey);

    if (isAuthLoading) {
      // Tetap loading; jangan ubah state
    } else if (!isAuthenticated || !session?.user) {
      setPermissionState(EMPTY_PERMISSION_STATE);
    } else {
      const user = session.user as { role?: string; isSuperAdmin?: boolean };
      if (isSuperAdmin(user)) {
        setPermissionState(SUPER_ADMIN_PERMISSION_STATE);
      } else {
        setPermissionState(INITIAL_PERMISSION_STATE);

        const fetchPermissions = async (): Promise<void> => {
          try {
            const response = await fetch("/api/user/permissions", {
              credentials: "include",
            });

            if (!response.ok) {
              clientLogger.error(
                "[PermissionProvider] Failed to fetch permissions:",
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
              "[PermissionProvider] Error fetching permissions:",
              error,
            );
            setPermissionState(EMPTY_PERMISSION_STATE);
          }
        };

        void fetchPermissions();
      }
    }
  }

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

  const value: PermissionContextValue = {
    ...permissionState,
    hasPermission,
    hasAnyPermission,
    isAuthenticated,
    user: session?.user,
    role: session?.user?.role,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error("usePermission must be used within PermissionProvider");
  }

  return context;
}
