import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  hasPermission: vi.fn(),
  deleteSite: vi.fn(),
  getSiteById: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/modules/roles/services/SiteService", () => ({
  SiteService: class {
    deleteSite = mockFns.deleteSite;
    getSiteById = mockFns.getSiteById;
  },
}));

import { DELETE, GET } from "@/app/api/admin/sites/[id]/route";

describe("admin site id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: "admin-1",
        email: "admin@example.com",
        permissions: ["site:delete"],
      },
    });
    mockFns.getUserPermissions.mockResolvedValue(["site:delete"]);
    mockFns.hasPermission.mockResolvedValue(true);
  });

  it("returns 404 when deleteSite reports missing site in Indonesian", async () => {
    mockFns.deleteSite.mockResolvedValue({
      success: false,
      code: "NOT_FOUND",
      error: "Site tidak ditemukan",
    });

    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/sites/site-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ id: "site-1" }),
      },
    );

    expect(response.status).toBe(404);
  });

  it("meneruskan lingkup site:site_only pengguna ke service saat membaca & menghapus", async () => {
    const izin = ["site:read", "site:delete", "site:site_only"];
    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: "kepala-1",
        email: "kepala@example.com",
        siteIds: ["site-1"],
        permissions: izin,
      },
    });
    mockFns.getUserPermissions.mockResolvedValue(izin);
    mockFns.getSiteById.mockResolvedValue({
      success: false,
      code: "NOT_FOUND",
      error: "Site tidak ditemukan",
    });
    mockFns.deleteSite.mockResolvedValue({
      success: false,
      code: "NOT_FOUND",
      error: "Site tidak ditemukan",
    });
    const lingkup = { dibatasi: true, siteIds: ["site-1"] };

    const dibaca = await GET(
      new NextRequest("http://localhost/api/admin/sites/site-2"),
      { params: Promise.resolve({ id: "site-2" }) },
    );
    const dihapus = await DELETE(
      new NextRequest("http://localhost/api/admin/sites/site-2", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "site-2" }) },
    );

    expect(dibaca.status).toBe(404);
    expect(dihapus.status).toBe(404);
    expect(mockFns.getSiteById).toHaveBeenCalledWith("site-2", lingkup);
    expect(mockFns.deleteSite).toHaveBeenCalledWith(
      "site-2",
      "kepala-1",
      lingkup,
    );
  });
});
