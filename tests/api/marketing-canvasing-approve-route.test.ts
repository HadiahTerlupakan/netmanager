import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdminRole: vi.fn(),
  approveRequest: vi.fn(),
  getRequestByIdWithSales: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockFns.verifyAuth,
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/lib/auth-helpers", () => ({
  isSuperAdminRole: mockFns.isSuperAdminRole,
}));

vi.mock("@/modules/marketing", async () => {
  const actual = await vi.importActual<typeof import("@/modules/marketing")>(
    "@/modules/marketing",
  );

  return {
    ...actual,
    createCanvasingService: () => ({
      approveRequest: mockFns.approveRequest,
      getRequestByIdWithSales: mockFns.getRequestByIdWithSales,
    }),
  };
});

import { POST } from "@/app/api/marketing/canvasing/[id]/approve/route";

describe("POST /api/marketing/canvasing/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.verifyAuth.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
    });
    mockFns.getUserPermissions.mockResolvedValue(["canvasing:update"]);
    mockFns.isSuperAdminRole.mockReturnValue(false);
    mockFns.approveRequest.mockResolvedValue({
      id: "cv-1",
      status: "APPROVED",
    });
    mockFns.getRequestByIdWithSales.mockResolvedValue({
      id: "cv-1",
      status: "PENDING",
      user: { siteId: "site-1" },
      mitra: null,
    });
  });

  it("mengizinkan permission canvasing:verify untuk approve eksplisit", async () => {
    mockFns.getUserPermissions.mockResolvedValue(["canvasing:verify"]);

    const response = await POST(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1/approve", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockFns.approveRequest).toHaveBeenCalledWith("cv-1", "user-1");
  });

  it("menolak akses ketika user tidak punya izin review canvasing", async () => {
    mockFns.getUserPermissions.mockResolvedValue([]);

    const response = await POST(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1/approve", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk menyetujui canvasing",
    });
    expect(mockFns.approveRequest).not.toHaveBeenCalled();
  });

  it("menolak user site-only menyetujui canvasing site lain", async () => {
    mockFns.verifyAuth.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      siteId: "site-2",
    });
    mockFns.getUserPermissions.mockResolvedValue([
      "canvasing:verify",
      "canvasing:site_only",
    ]);

    const response = await POST(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1/approve", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk menyetujui canvasing",
    });
    expect(mockFns.approveRequest).not.toHaveBeenCalled();
  });
});
