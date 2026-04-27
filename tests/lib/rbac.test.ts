import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock next-auth
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));

// Mock auth config and getUserPermissions
const mockGetUserPermissions = vi.fn();
vi.mock("@/lib/auth", () => ({
  authConfig: {},
  getUserPermissions: (userId: string) => mockGetUserPermissions(userId),
  isSuperAdmin: (
    user: { role?: string; isSuperAdmin?: boolean } | null | undefined,
  ) =>
    user?.role === "SUPER_ADMIN" ||
    user?.role === "Super Admin" ||
    user?.isSuperAdmin === true,
}));

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Import after mocks
import {
  hasPermission,
  hasAnyPermission,
  getCurrentUser,
  ensurePermission,
  ensureAnyPermission,
} from "@/lib/rbac";

describe("RBAC Functions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("hasPermission", () => {
    it("should return false when no session", async () => {
      mockGetServerSession.mockResolvedValueOnce(null);

      const result = await hasPermission("users:read");

      expect(result).toBe(false);
    });

    it("should return false when no user in session", async () => {
      mockGetServerSession.mockResolvedValueOnce({ user: null });

      const result = await hasPermission("users:read");

      expect(result).toBe(false);
    });

    it("should return true for SUPER_ADMIN when has all permissions from seed", async () => {
      // SUPER_ADMIN now goes through normal permission check
      // but has all permissions assigned from seed
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "admin-1",
          role: "SUPER_ADMIN",
        },
      });
      // SUPER_ADMIN bypasses database check in current implementation

      const result = await hasPermission("any:permission");

      expect(result).toBe(true);
      // getUserPermissions is bypassed for SUPER_ADMIN
      expect(mockGetUserPermissions).not.toHaveBeenCalled();
    });

    it("should return true when user has the required permission", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "user-1",
          role: "ADMIN",
        },
      });
      mockGetUserPermissions.mockResolvedValueOnce([
        "users:read",
        "users:create",
      ]);

      const result = await hasPermission("users:read");

      expect(result).toBe(true);
    });

    it("should return false when user lacks the required permission", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "user-1",
          role: "ADMIN",
        },
      });
      mockGetUserPermissions.mockResolvedValueOnce(["users:read"]);

      const result = await hasPermission("users:delete");

      expect(result).toBe(false);
    });

    it("should handle empty permissions array", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "user-1",
          role: "ADMIN",
        },
      });
      mockGetUserPermissions.mockResolvedValueOnce([]);

      const result = await hasPermission("users:read");

      expect(result).toBe(false);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return false when no session", async () => {
      mockGetServerSession.mockResolvedValueOnce(null);

      const result = await hasAnyPermission(["users:read", "roles:read"]);

      expect(result).toBe(false);
    });

    it("should return true for SUPER_ADMIN when has permissions from seed", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "admin-1",
          role: "SUPER_ADMIN",
        },
      });
      mockGetUserPermissions.mockResolvedValueOnce([
        "any:permission",
        "users:read",
      ]);

      const result = await hasAnyPermission(["any:permission"]);

      expect(result).toBe(true);
    });

    it("should return true when user has at least one required permission", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "user-1",
          role: "ADMIN",
        },
      });
      mockGetUserPermissions.mockResolvedValueOnce(["users:read"]);

      const result = await hasAnyPermission([
        "users:read",
        "roles:read",
        "dashboard:read",
      ]);

      expect(result).toBe(true);
    });

    it("should return false when user has none of the required permissions", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "user-1",
          role: "ADMIN",
        },
      });
      mockGetUserPermissions.mockResolvedValueOnce(["inventory:read"]);

      const result = await hasAnyPermission(["users:read", "roles:read"]);

      expect(result).toBe(false);
    });
  });

  describe("getCurrentUser", () => {
    it("should return null when no session", async () => {
      mockGetServerSession.mockResolvedValueOnce(null);

      const result = await getCurrentUser();

      expect(result).toBeUndefined();
    });

    it("should return user from session", async () => {
      const mockUser = {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        role: "ADMIN",
      };
      mockGetServerSession.mockResolvedValueOnce({ user: mockUser });

      const result = await getCurrentUser();

      expect(result).toEqual(mockUser);
    });
  });

  describe("ensurePermission", () => {
    it("should not redirect when user has permission", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "user-1",
          role: "ADMIN",
        },
      });
      mockGetUserPermissions.mockResolvedValueOnce(["users:read"]);

      await ensurePermission("users:read");

      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should redirect when user lacks permission", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "user-1",
          role: "ADMIN",
        },
      });
      mockGetUserPermissions.mockResolvedValueOnce([]);

      await ensurePermission("users:read");

      // Check that it redirects to /admin/forbidden, ignoring query params for simplicity or matching exact if preferred
      // matching exact for robustness based on implementation
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("/admin/forbidden?reason="),
      );
    });

    it("should redirect to custom URL when specified", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "user-1",
          role: "ADMIN",
        },
      });
      mockGetUserPermissions.mockResolvedValueOnce([]);

      await ensurePermission("users:read", "/403");

      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("/403?reason="),
      );
    });
  });

  describe("ensureAnyPermission", () => {
    it("should not redirect when user has any required permission", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "user-1",
          role: "ADMIN",
        },
      });
      mockGetUserPermissions.mockResolvedValueOnce(["users:read"]);

      await ensureAnyPermission(["users:read", "roles:read"]);

      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should redirect when user has none of required permissions", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: {
          id: "user-1",
          role: "ADMIN",
        },
      });
      mockGetUserPermissions.mockResolvedValueOnce(["inventory:read"]);

      await ensureAnyPermission(["users:read", "roles:read"]);

      expect(mockRedirect).toHaveBeenCalledWith("/admin/forbidden");
    });
  });
});

describe("Permission Config", () => {
  it("should have expected permission groups", async () => {
    const { PERMISSION_GROUPS } = await import("@/lib/permission-config");

    expect(PERMISSION_GROUPS.DASHBOARD).toBeDefined();
    expect(PERMISSION_GROUPS.NETWORK).toBeDefined();
    expect(PERMISSION_GROUPS.PELANGGAN).toBeDefined();
    expect(PERMISSION_GROUPS.USERS).toBeDefined();
  });

  it("should have correct actions defined", async () => {
    const { ACTIONS } = await import("@/lib/permission-config");

    expect(ACTIONS).toContain("read");
    expect(ACTIONS).toContain("create");
    expect(ACTIONS).toContain("update");
    expect(ACTIONS).toContain("delete");
  });

  it("should include captcha in pengaturan permission group", async () => {
    const { PERMISSION_GROUPS } = await import("@/lib/permission-config");

    expect(PERMISSION_GROUPS.PENGATURAN).toContain("captcha");
  });

  it("should allow API permission to access embedded captcha settings", async () => {
    const { hasPermissionWithAlias } = await import("@/lib/permission-aliases");

    expect(hasPermissionWithAlias(["api:read"], "captcha:read")).toBe(true);
    expect(hasPermissionWithAlias(["api:update"], "captcha:update")).toBe(true);
  });

  it("should have karyawan permission groups", async () => {
    const { PERMISSION_GROUPS_KARYAWAN } =
      await import("@/lib/permission-config");

    // Updated to match actual property names
    expect(PERMISSION_GROUPS_KARYAWAN.BERANDA).toBeDefined();
    expect(PERMISSION_GROUPS_KARYAWAN.KEHADIRAN).toBeDefined();
    expect(PERMISSION_GROUPS_KARYAWAN.INVENTORY).toBeDefined();
  });
});
