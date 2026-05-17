"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/hooks/useApi";

interface CustomerSession {
  id: string;
  idPelanggan: string;
  nama: string;
  email?: string | null;
}

interface CustomerApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

interface CustomerApiError {
  success: false;
  error?: string;
  message?: string;
}

function isCustomerApiSuccess<T>(
  payload: CustomerApiSuccess<T> | CustomerApiError,
): payload is CustomerApiSuccess<T> {
  return payload.success;
}

interface CustomerAuthContextType {
  customer: CustomerSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    identifier: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(
  undefined,
);

interface MeResponse {
  customer: CustomerSession;
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading, mutate } = useApi<MeResponse>(
    "/api/customer/auth/me",
  );

  // Derive customer from SWR data; on error (e.g. 401) treat as not authenticated
  const customer: CustomerSession | null =
    !error && data?.customer ? data.customer : null;

  const router = useRouter();

  const login = async (identifier: string, password: string) => {
    try {
      const res = await fetch("/api/customer/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const payload = (await res.json()) as
        | CustomerApiSuccess<{ customer: CustomerSession }>
        | CustomerApiError;

      if (!res.ok) {
        return {
          success: false,
          error:
            payload.message ||
            (!isCustomerApiSuccess(payload) ? payload.error : undefined) ||
            "Login gagal",
        };
      }

      if (!isCustomerApiSuccess(payload)) {
        return { success: false, error: payload.message || "Login gagal" };
      }

      // Update SWR cache with the new customer session
      await mutate({ customer: payload.data.customer }, { revalidate: false });
      return { success: true };
    } catch {
      return { success: false, error: "Terjadi kesalahan jaringan" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/customer/auth/logout", { method: "POST" });
    } catch {
      // Ignore errors
    } finally {
      // Clear SWR cache so customer becomes null immediately
      await mutate(undefined, { revalidate: false });
      router.push("/login");
    }
  };

  const refresh = async () => {
    await mutate();
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        isLoading,
        isAuthenticated: !!customer,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (context === undefined) {
    throw new Error(
      "useCustomerAuth must be used within a CustomerAuthProvider",
    );
  }
  return context;
}
