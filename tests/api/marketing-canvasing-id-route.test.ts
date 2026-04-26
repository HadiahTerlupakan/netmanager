import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdminRole: vi.fn(),
  getRequestById: vi.fn(),
  getRequestByIdWithSales: vi.fn(),
  updateRequest: vi.fn(),
  cancelApproval: vi.fn(),
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
      getRequestById: mockFns.getRequestById,
      getRequestByIdWithSales: mockFns.getRequestByIdWithSales,
      updateRequest: mockFns.updateRequest,
      cancelApproval: mockFns.cancelApproval,
    }),
  };
});

import { GET, PATCH } from "@/app/api/marketing/canvasing/[id]/route";

describe("GET /api/marketing/canvasing/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.verifyAuth.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
    });
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.isSuperAdminRole.mockReturnValue(false);
    mockFns.getRequestById.mockResolvedValue({
      id: "cv-1",
      salesId: "sales-1",
      status: "PENDING",
    });
    mockFns.getRequestByIdWithSales.mockResolvedValue({
      id: "cv-1",
      salesId: "sales-1",
      status: "PENDING",
      user: { siteId: "site-1" },
      mitra: null,
    });
  });

  it("mengizinkan verifier melihat detail canvasing", async () => {
    mockFns.getUserPermissions.mockResolvedValue(["canvasing:verify"]);

    const response = await GET(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1", {
        method: "GET",
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: "cv-1" },
    });
  });

  it("menolak detail canvasing bila bukan owner dan tanpa permission read atau verify", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1", {
        method: "GET",
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk melihat data ini",
    });
  });

  it("menolak user site-only melihat detail canvasing site lain", async () => {
    mockFns.verifyAuth.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      siteId: "site-2",
    });
    mockFns.getUserPermissions.mockResolvedValue([
      "canvasing:verify",
      "canvasing:site_only",
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1", {
        method: "GET",
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk melihat data ini",
    });
  });
});

describe("PATCH /api/marketing/canvasing/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.verifyAuth.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
    });
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.isSuperAdminRole.mockReturnValue(false);
    mockFns.getRequestById.mockResolvedValue({
      id: "cv-1",
      salesId: "sales-1",
      status: "PENDING",
    });
    mockFns.getRequestByIdWithSales.mockResolvedValue({
      id: "cv-1",
      salesId: "sales-1",
      status: "PENDING",
      user: { siteId: "site-1" },
      mitra: null,
    });
    mockFns.updateRequest.mockResolvedValue({
      id: "cv-1",
      nama: "Nama Baru",
    });
    mockFns.cancelApproval.mockResolvedValue({
      id: "cv-1",
      status: "PENDING",
    });
  });

  it("mengembalikan 400 ketika payload memakai action reject pada generic PATCH", async () => {
    mockFns.getUserPermissions.mockResolvedValue(["canvasing:update"]);

    const response = await PATCH(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "reject" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Unrecognized key: "action"'),
    });
    expect(mockFns.updateRequest).not.toHaveBeenCalled();
  });

  it("mengembalikan 400 ketika payload membawa status REJECTED", async () => {
    mockFns.getUserPermissions.mockResolvedValue(["canvasing:update"]);

    const response = await PATCH(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "REJECTED" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Perubahan status harus melalui endpoint aksi khusus",
    });
    expect(mockFns.updateRequest).not.toHaveBeenCalled();
  });

  it("mengizinkan owner mengubah field biasa tanpa permission update", async () => {
    mockFns.verifyAuth.mockResolvedValue({
      id: "sales-1",
      role: "MARKETING",
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1", {
        method: "PATCH",
        body: JSON.stringify({ nama: "Nama Baru" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockFns.updateRequest).toHaveBeenCalledWith("cv-1", {
      nama: "Nama Baru",
    });
  });

  it("menolak owner membatalkan approval tanpa permission update", async () => {
    mockFns.verifyAuth.mockResolvedValue({
      id: "sales-1",
      role: "MARKETING",
    });
    mockFns.getRequestById.mockResolvedValue({
      id: "cv-1",
      salesId: "sales-1",
      status: "APPROVED",
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel_approval" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk mengubah data ini",
    });
    expect(mockFns.cancelApproval).not.toHaveBeenCalled();
  });

  it("menolak user site-only mengubah canvasing site lain", async () => {
    mockFns.verifyAuth.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      siteId: "site-2",
    });
    mockFns.getUserPermissions.mockResolvedValue([
      "canvasing:update",
      "canvasing:site_only",
    ]);

    const response = await PATCH(
      new NextRequest("http://localhost/api/marketing/canvasing/cv-1", {
        method: "PATCH",
        body: JSON.stringify({ nama: "Nama Baru" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "cv-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Anda tidak memiliki akses untuk mengubah data ini",
    });
    expect(mockFns.updateRequest).not.toHaveBeenCalled();
  });
});
