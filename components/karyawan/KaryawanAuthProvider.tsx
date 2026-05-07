"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { isSuperAdmin } from "@/lib/auth/super-admin";

interface KaryawanSession {
  id: string;
  name: string | null;
  email: string;
  departmentId: string | null;
  siteId: string | null;
  image: string | null;
}

interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  accessEmployeePanel?: boolean;
  departmentId?: string | null;
  siteId?: string | null;
}

interface KaryawanAuthContextType {
  user: KaryawanSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const KaryawanAuthContext = createContext<KaryawanAuthContextType | undefined>(
  undefined,
);

export function KaryawanAuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<KaryawanSession | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      // Strict check: if user has no employee access, treat as unauthenticated (or handle error)
      // Middleware should have caught this, but this is a fail-safe for client transitions
      const sUser = session.user as AuthUser;
      if (!sUser.accessEmployeePanel && !isSuperAdmin(sUser)) {
        router.replace("/karyawan/login?error=AccessDenied");
        return;
      }

      // Use queueMicrotask to avoid synchronous setState
      queueMicrotask(() =>
        setUser({
          id: sUser.id,
          name: sUser.name ?? null,
          email: sUser.email ?? "",
          departmentId: sUser.departmentId ?? null,
          siteId: sUser.siteId ?? null,
          image: sUser.image ?? null,
        }),
      );
    } else if (status === "unauthenticated") {
      queueMicrotask(() => setUser(null));
    }
  }, [session, status, router]);

  const login = async (email: string, password: string) => {
    try {
      const result = await signIn("credentials", {
        identifier: email,
        password,
        portal: "employee",
        redirect: false,
      });

      if (result?.ok) {
        return { success: true };
      } else {
        return { success: false, error: result?.error || "Login gagal" };
      }
    } catch {
      return { success: false, error: "Terjadi kesalahan jaringan" };
    }
  };

  const logout = async () => {
    await signOut({ redirect: false });
    router.push("/karyawan/login");
  };

  return (
    <KaryawanAuthContext.Provider
      value={{
        user,
        isLoading: status === "loading",
        isAuthenticated: status === "authenticated" && !!session?.user,
        login,
        logout,
      }}
    >
      {children}
    </KaryawanAuthContext.Provider>
  );
}

export function useKaryawanAuth() {
  const context = useContext(KaryawanAuthContext);
  if (context === undefined) {
    throw new Error(
      "useKaryawanAuth must be used within a KaryawanAuthProvider",
    );
  }
  return context;
}
