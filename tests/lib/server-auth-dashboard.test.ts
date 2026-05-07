import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockGetUserPermissions = vi.hoisted(() => vi.fn());
const mockIsSuperAdminUser = vi.hoisted(() => vi.fn());
const mockRedirect = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  authConfig: {},
  getUserPermissions: mockGetUserPermissions,
  isSuperAdmin: mockIsSuperAdminUser,
}));

describe("ensureAdminDashboardAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdminUser.mockReturnValue(false);
  });

  it("loads permissions from canonical loader for regular admin", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "admin-1",
        tenantId: "tenant-1",
      },
    });
    mockGetUserPermissions.mockResolvedValue(["dashboard:read"]);

    const { ensureAdminDashboardAccess } = await import("@/lib/server-auth");
    const result = await ensureAdminDashboardAccess();

    expect(mockGetUserPermissions).toHaveBeenCalledWith("admin-1");
    expect(result).toMatchObject({
      user: { id: "admin-1" },
      tenantId: "tenant-1",
      permissions: ["dashboard:read"],
      isSuperAdmin: false,
    });
  });

  it("redirects to login access denied when accessAdminPanel is false for non super admin", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "admin-2",
        tenantId: "tenant-1",
        accessAdminPanel: false,
      },
    });

    const { ensureAdminDashboardAccess } = await import("@/lib/server-auth");
    await ensureAdminDashboardAccess();

    expect(mockRedirect).toHaveBeenCalledWith(
      "/admin/login?error=AccessDenied",
    );
  });

  it("redirects to forbidden when dashboard:read is missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "admin-2",
        tenantId: "tenant-1",
        accessAdminPanel: true,
      },
    });
    mockGetUserPermissions.mockResolvedValue(["users:read"]);

    const { ensureAdminDashboardAccess } = await import("@/lib/server-auth");
    await ensureAdminDashboardAccess();

    expect(mockRedirect).toHaveBeenCalledWith("/admin/forbidden");
  });
});
