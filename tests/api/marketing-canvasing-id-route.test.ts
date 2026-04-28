import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdminRole: vi.fn(),
  getDetail: vi.fn(),
  patchDetail: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockFns.verifyAuth,
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/lib/auth-helpers", () => ({
  isSuperAdminRole: mockFns.isSuperAdminRole,
}));

vi.mock("@/modules/marketing", () => ({
  marketingCanvasingDetailRouteService: {
    getDetail: mockFns.getDetail,
    patchDetail: mockFns.patchDetail,
  },
}));

import { GET, PATCH } from "@/app/api/marketing/canvasing/[id]/route";

const baseSession = {
  id: "user-1",
  role: "ADMIN",
};

const routeContext = { params: Promise.resolve({ id: "cv-1" }) };

function createRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/marketing/canvasing/cv-1", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/marketing/canvasing/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.verifyAuth.mockResolvedValue(baseSession);
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.isSuperAdminRole.mockReturnValue(false);
    mockFns.getDetail.mockResolvedValue({
      success: true,
      data: { id: "cv-1" },
    });
  });

  it("mengizinkan verifier melihat detail canvasing", async () => {
    mockFns.getUserPermissions.mockResolvedValue(["canvasing:verify"]);

    const response = await GET(createRequest("GET"), routeContext);

    expect(response.status).toBe(200);
    expect(mockFns.getDetail).toHaveBeenCalledWith({
      id: "cv-1",
      session: baseSession,
      permissions: ["canvasing:verify"],
      isSuperAdmin: false,
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: "cv-1" },
    });
  });

  it("menolak detail canvasing bila bukan owner dan tanpa permission read atau verify", async () => {
    mockFns.getDetail.mockResolvedValue({
      success: false,
      status: 403,
      error: "Anda tidak memiliki akses untuk melihat data ini",
    });

    const response = await GET(createRequest("GET"), routeContext);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk melihat data ini",
    });
  });

  it("menolak user site-only melihat detail canvasing site lain", async () => {
    mockFns.verifyAuth.mockResolvedValue({
      ...baseSession,
      siteId: "site-2",
    });
    mockFns.getUserPermissions.mockResolvedValue([
      "canvasing:verify",
      "canvasing:site_only",
    ]);
    mockFns.getDetail.mockResolvedValue({
      success: false,
      status: 403,
      error: "Anda tidak memiliki akses untuk melihat data ini",
    });

    const response = await GET(createRequest("GET"), routeContext);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk melihat data ini",
    });
  });
});

describe("PATCH /api/marketing/canvasing/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.verifyAuth.mockResolvedValue(baseSession);
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.isSuperAdminRole.mockReturnValue(false);
    mockFns.patchDetail.mockResolvedValue({
      success: true,
      data: { id: "cv-1", nama: "Nama Baru" },
    });
  });

  it("mengembalikan 400 ketika payload memakai action reject pada generic PATCH", async () => {
    mockFns.getUserPermissions.mockResolvedValue(["canvasing:update"]);
    mockFns.patchDetail.mockResolvedValue({
      success: false,
      status: 400,
      code: "VALIDATION_ERROR",
      error: 'Unrecognized key: "action"',
    });

    const response = await PATCH(
      createRequest("PATCH", { action: "reject" }),
      routeContext,
    );

    expect(response.status).toBe(400);
    expect(mockFns.patchDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cv-1",
        body: { action: "reject" },
        permissions: ["canvasing:update"],
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Unrecognized key: "action"'),
    });
  });

  it("mengembalikan 400 ketika payload membawa status REJECTED", async () => {
    mockFns.getUserPermissions.mockResolvedValue(["canvasing:update"]);
    mockFns.patchDetail.mockResolvedValue({
      success: false,
      status: 400,
      error: "Perubahan status harus melalui endpoint aksi khusus",
    });

    const response = await PATCH(
      createRequest("PATCH", { status: "REJECTED" }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Perubahan status harus melalui endpoint aksi khusus",
    });
  });

  it("mengizinkan owner mengubah field biasa tanpa permission update", async () => {
    const salesSession = { id: "sales-1", role: "MARKETING" };
    mockFns.verifyAuth.mockResolvedValue(salesSession);

    const response = await PATCH(
      createRequest("PATCH", { nama: "Nama Baru" }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(mockFns.patchDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cv-1",
        session: salesSession,
        body: { nama: "Nama Baru" },
      }),
    );
  });

  it("menolak owner membatalkan approval tanpa permission update", async () => {
    mockFns.verifyAuth.mockResolvedValue({
      id: "sales-1",
      role: "MARKETING",
    });
    mockFns.patchDetail.mockResolvedValue({
      success: false,
      status: 403,
      error: "Anda tidak memiliki akses untuk mengubah data ini",
    });

    const response = await PATCH(
      createRequest("PATCH", { action: "cancel_approval" }),
      routeContext,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk mengubah data ini",
    });
  });

  it("menolak user site-only mengubah canvasing site lain", async () => {
    mockFns.verifyAuth.mockResolvedValue({
      ...baseSession,
      siteId: "site-2",
    });
    mockFns.getUserPermissions.mockResolvedValue([
      "canvasing:update",
      "canvasing:site_only",
    ]);
    mockFns.patchDetail.mockResolvedValue({
      success: false,
      status: 403,
      error: "Anda tidak memiliki akses untuk mengubah data ini",
    });

    const response = await PATCH(
      createRequest("PATCH", { nama: "Nama Baru" }),
      routeContext,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk mengubah data ini",
    });
  });
});
