import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
  dbOperation: vi.fn(),
  apiRequest: vi.fn(),
  error: vi.fn(),
  logActivity: vi.fn(),
  resolveRestrictedSiteId: vi.fn(),
  updateBarang: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();

  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (data: unknown, meta?: { message?: string; status?: number }) =>
      NextResponse.json(
        {
          success: true,
          data,
          ...(meta?.message ? { message: meta.message } : {}),
        },
        { status: meta?.status ?? 200 },
      ),
    ApiErrors: {
      badRequest: (message: string) =>
        NextResponse.json({ success: false, error: message }, { status: 400 }),
      forbidden: (message: string) =>
        NextResponse.json({ success: false, error: message }, { status: 403 }),
      notFound: (message: string) =>
        NextResponse.json({ success: false, error: message }, { status: 404 }),
      internalError: (message: string) =>
        NextResponse.json({ success: false, error: message }, { status: 500 }),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  getUserPermissions: mockFns.getUserPermissions,
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    dbOperation: mockFns.dbOperation,
    apiRequest: mockFns.apiRequest,
    error: mockFns.error,
    logActivity: mockFns.logActivity,
  },
}));

vi.mock("@/modules/inventory", () => ({
  getInventoryRouteService: () => ({
    resolveRestrictedSiteId: mockFns.resolveRestrictedSiteId,
  }),
  inventoryBarangRouteService: {
    updateBarang: mockFns.updateBarang,
  },
}));

import { PUT } from "@/app/api/inventory/barang/[id]/route";

describe("PUT /api/inventory/barang/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.isSuperAdmin.mockReturnValue(true);
    mockFns.resolveRestrictedSiteId.mockResolvedValue(undefined);
    mockFns.updateBarang.mockResolvedValue({
      success: false,
      status: 400,
      error: "Satuan barang tidak boleh diubah saat stok masih tersedia",
    });
  });

  it("returns bad request when unit change is blocked by existing stock", async () => {
    const request = new NextRequest(
      "http://localhost/api/inventory/barang/barang-1",
      {
        method: "PUT",
        body: JSON.stringify({
          kode: "BRG-001",
          nama: "Kabel Fiber",
          satuan: "meter",
        }),
        headers: {
          "content-type": "application/json",
        },
      },
    );

    const response = await PUT(request, {
      session: {
        user: {
          id: "admin-1",
          isSuperAdmin: true,
        },
      },
      params: { id: "barang-1" },
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: "Satuan barang tidak boleh diubah saat stok masih tersedia",
    });
  });
});
