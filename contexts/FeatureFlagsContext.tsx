"use client";

import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { FeatureModuleCode } from "@/lib/feature-modules";
import { clientLogger } from "@/lib/client-logger";

interface FeatureFlagsState {
  disabledFeatures: FeatureModuleCode[];
  isLoading: boolean;
}

interface FeatureFlagsContextValue extends FeatureFlagsState {
  isFeatureEnabled: (feature: string) => boolean;
}

const EMPTY_STATE: FeatureFlagsState = {
  disabledFeatures: [],
  isLoading: false,
};

const LOADING_STATE: FeatureFlagsState = {
  disabledFeatures: [],
  isLoading: true,
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(
  null,
);

/**
 * Provider feature flag per-tenant. Mengikuti pola `PermissionContext`:
 * sync state via render-time auth-key comparator (bukan useEffect) supaya
 * state segar saat session berubah tanpa effect yang setState.
 */
export function FeatureFlagsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  const isSuperAdmin =
    (session?.user as { isSuperAdmin?: boolean } | undefined)?.isSuperAdmin ===
    true;

  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const authKey = `${
    isAuthLoading ? "loading" : isAuthenticated ? "auth" : "unauth"
  }|${userId ?? ""}|${isSuperAdmin ? "super" : "normal"}`;

  const [state, setState] = useState<FeatureFlagsState>(LOADING_STATE);
  const [prevAuthKey, setPrevAuthKey] = useState<string | null>(null);

  if (prevAuthKey !== authKey) {
    setPrevAuthKey(authKey);

    if (isAuthLoading) {
      // Pertahankan loading state
    } else if (!isAuthenticated || !session?.user) {
      setState(EMPTY_STATE);
    } else if (isSuperAdmin) {
      setState(EMPTY_STATE);
    } else {
      setState(LOADING_STATE);

      const fetchFlags = async (): Promise<void> => {
        try {
          const response = await fetch("/api/tenant/feature-flags", {
            credentials: "include",
          });
          if (!response.ok) {
            clientLogger.error(
              "[FeatureFlagsProvider] Fetch failed:",
              response.status,
            );
            setState(EMPTY_STATE);
            return;
          }

          const json = await response.json();
          const data = (json?.data ?? json) as {
            disabledFeatures?: FeatureModuleCode[];
          };
          setState({
            disabledFeatures: data.disabledFeatures ?? [],
            isLoading: false,
          });
        } catch (error) {
          clientLogger.error("[FeatureFlagsProvider] Error:", error);
          setState(EMPTY_STATE);
        }
      };

      void fetchFlags();
    }
  }

  const isFeatureEnabled = useCallback(
    (feature: string) => {
      // Default open: jika sedang loading atau tidak ada data, biarkan tampil.
      // Backend gate tetap mem-block bila modul disable.
      if (state.isLoading) return true;
      return !state.disabledFeatures.includes(feature as FeatureModuleCode);
    },
    [state],
  );

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      ...state,
      isFeatureEnabled,
    }),
    [state, isFeatureEnabled],
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    // Safe fallback agar komponen tidak crash bila provider belum dipasang.
    return {
      disabledFeatures: [],
      isLoading: false,
      isFeatureEnabled: () => true,
    };
  }
  return context;
}
