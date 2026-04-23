import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  createCustomToken: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/firebase/admin", () => ({
  auth: {
    createCustomToken: mockFns.createCustomToken,
  },
}));

import { POST } from "@/app/api/auth/firebase-token/route";

describe("firebase token route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.createCustomToken.mockResolvedValue("firebase-custom-token");
  });

  it("normalizes super admin claims and publishes the legacy siteId alias", async () => {
    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: "admin-1",
        role: "Super Admin",
        tenantId: "tenant-1",
        departmentId: "department-1",
        siteId: "site-primary",
        primarySiteId: "site-primary",
        accessAdminPanel: true,
        accessEmployeePanel: true,
        isSuperAdmin: true,
      },
    });

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ token: "firebase-custom-token" });
    expect(mockFns.createCustomToken).toHaveBeenCalledWith("admin-1", {
      role: "SUPER_ADMIN",
      tenantId: "tenant-1",
      departmentId: "department-1",
      siteId: "site-primary",
      primarySiteId: "site-primary",
      accessAdminPanel: true,
      accessEmployeePanel: true,
      isSuperAdmin: true,
    });
  });
});
