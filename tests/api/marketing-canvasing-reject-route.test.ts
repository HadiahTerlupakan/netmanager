import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdminRole: vi.fn(),
  rejectRequest: vi.fn(),
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
      rejectRequest: mockFns.rejectRequest,
      getRequestByIdWithSales: mockFns.getRequestByIdWithSales,
    }),
  };
});

import { POST } from "@/app/api/marketing/canvasing/[id]/reject/route";

describe("POST /api/marketing/canvasing/[id]/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.verifyAuth.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
    });
    mockFns.getUserPermissions.mockResolvedValue(["canvasing:update"]);
    mockFns.isSuperAdminRole.mockReturnValue(false);
    mockFns.getRequestByIdWithSales.mockResolvedValue({
      id: "cv-1",
      status: "PENDING",
      user: { siteId: "site-1" },
      mitra: null,
    });
  });

  it("menolak akses ketika user tidak punya izin update canvasing", async () => {
    mockFns.getUserPermissions.mockResolvedValue([]);

    const response = await POST(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1/reject", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk menolak canvasing",
    });
    expect(mockFns.rejectRequest).not.toHaveBeenCalled();
  });

  it("mengizinkan permission canvasing:verify untuk reject eksplisit", async () => {
    mockFns.getUserPermissions.mockResolvedValue(["canvasing:verify"]);
    mockFns.rejectRequest.mockResolvedValue({ id: "cv-1", status: "REJECTED" });

    const response = await POST(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1/reject", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockFns.rejectRequest).toHaveBeenCalledWith("cv-1");
  });

  it("menolak user site-only menolak canvasing site lain", async () => {
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
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1/reject", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk menolak canvasing",
    });
    expect(mockFns.rejectRequest).not.toHaveBeenCalled();
  });

  it("mengembalikan 400 ketika service reject gagal karena status bukan PENDING", async () => {
    const { MarketingError } =
      await import("@/modules/marketing/domain/errors/MarketingError");
    mockFns.rejectRequest.mockRejectedValue(
      new MarketingError(
        "invalid_status",
        "Hanya request PENDING yang bisa ditolak",
      ),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1/reject", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Hanya request PENDING yang bisa ditolak",
    });
  });
});
