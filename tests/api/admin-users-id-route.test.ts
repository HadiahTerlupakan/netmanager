import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  hasPermission: vi.fn(),
  invalidatePermissionCache: vi.fn(),
  publish: vi.fn(),
  logActivity: vi.fn(),
  checkSiteRestriction: vi.fn(),
  canAccessSite: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mockFns.getUserPermissions,
  invalidatePermissionCache: mockFns.invalidatePermissionCache,
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: mockFns.publish,
  },
}));

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: mockFns.checkSiteRestriction,
  canAccessSite: mockFns.canAccessSite,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    apiRequest: vi.fn(),
    logActivity: mockFns.logActivity,
  },
}));

import { PATCH } from "@/app/api/admin/users/[id]/route";

describe("admin users id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(console.error).mockImplementation((...args: unknown[]) => {
      const formatted = args
        .map((arg) => {
          if (arg instanceof Error) return arg.stack || arg.message;
          if (typeof arg === "object" && arg !== null) {
            return JSON.stringify(arg, Object.getOwnPropertyNames(arg));
          }
          return String(arg);
        })
        .join(" ");
      process.stderr.write(`${formatted}\n`);
    });

    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: "admin-1",
        email: "admin@example.com",
        permissions: ["users:update"],
        role: "ADMIN",
      },
    });
    mockFns.getUserPermissions.mockResolvedValue(["users:update"]);
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.invalidatePermissionCache.mockResolvedValue(undefined);
    mockFns.publish.mockResolvedValue(undefined);
    mockFns.logActivity.mockResolvedValue(undefined);
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: false,
      siteId: "site-1",
    });
    mockFns.canAccessSite.mockReturnValue(true);

    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      roleId: "role-old",
      siteId: "site-1",
      departmentId: "dept-1",
      isActive: true,
      tenantId: "tenant-1",
    });
    prismaMock.user.update.mockResolvedValue({ id: "user-1" });

    mockFns.publish.mockResolvedValue(undefined);
  });

  it("publishes the permissions update through canonical Firebase realtime without waiting for the legacy socket producer", async () => {
    const request = new NextRequest("http://localhost/api/admin/users/user-1", {
      method: "PATCH",
      body: JSON.stringify({ roleId: "role-new" }),
      headers: { "content-type": "application/json" },
    });

    const responsePromise = PATCH(request, {
      params: Promise.resolve({ id: "user-1" }),
    });

    const result = await Promise.race([
      responsePromise.then(() => "response"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 0)),
    ]);

    expect(result).toBe("response");

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(mockFns.publish).toHaveBeenCalledWith({
      type: "user.permissions_update",
      scope: { kind: "user", id: "user-1" },
      payload: { userId: "user-1" },
    });
  });
});
