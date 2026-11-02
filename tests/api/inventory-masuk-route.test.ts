import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
  dbOperation: vi.fn(),
  apiRequest: vi.fn(),
  error: vi.fn(),
  logActivitySafe: vi.fn(),
  addStock: vi.fn(),
  getStockLevel: vi.fn(),
  buildInventoryAccessSession: vi.fn(),
  createMasuk: vi.fn(),
  validateGudangSiteAccess: vi.fn(),
  userFindUnique: vi.fn(),
  inventoryUpdate: vi.fn(),
  publishStockIn: vi.fn(),
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
  },
  logActivitySafe: mockFns.logActivitySafe,
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    user: {
      findUnique: mockFns.userFindUnique,
    },
  },
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    inventoryUpdate: mockFns.inventoryUpdate,
  },
}));

vi.mock("@/modules/events", () => ({
  InventoryEventDispatcher: {
    onStockIn: mockFns.publishStockIn,
  },
}));

vi.mock("@/modules/inventory", () => ({
  InventoryRepository: class {
    addStock = mockFns.addStock;
    getStockLevel = mockFns.getStockLevel;
  },
  buildInventoryAccessSession: mockFns.buildInventoryAccessSession,
  inventoryMasukRouteService: {
    createMasuk: mockFns.createMasuk,
  },
  validateGudangSiteAccess: mockFns.validateGudangSiteAccess,
  describeGudangAccessDenial: (error?: string) => error ?? "ditolak",
  IZIN_PEMBATAS_MASUK: [
    "masuk:site_only",
    "barang:site_only",
    "gudang:site_only",
  ],
  IZIN_PEMBATAS_KELUAR: [
    "keluar:site_only",
    "barang:site_only",
    "gudang:site_only",
  ],
}));

import { POST } from "@/app/api/inventory/masuk/route";

describe("POST /api/inventory/masuk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.isSuperAdmin.mockReturnValue(true);
    mockFns.userFindUnique.mockResolvedValue({
      siteId: "site-1",
      role: "ADMIN",
    });
    mockFns.buildInventoryAccessSession.mockResolvedValue({
      userId: "admin-1",
    });
    mockFns.validateGudangSiteAccess.mockResolvedValue({ allowed: true });
    mockFns.createMasuk.mockResolvedValue({
      success: false,
      status: 400,
      error:
        "Kondisi barang tidak dikenal. Pilih salah satu: Baru, Bekas, atau Rusak.",
    });
    mockFns.addStock.mockResolvedValue({
      id: "masuk-1",
      barang: { nama: "Barang Uji" },
    });
    mockFns.getStockLevel.mockResolvedValue(10);
    mockFns.publishStockIn.mockResolvedValue(undefined);
  });

  it("returns bad request when kondisi is not valid", async () => {
    const request = new NextRequest("http://localhost/api/inventory/masuk", {
      method: "POST",
      body: JSON.stringify({
        barangId: "barang-1",
        gudangId: "gudang-1",
        jumlah: 5,
        kondisi: "cacat",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request, {
      session: {
        user: {
          id: "admin-1",
          role: "ADMIN",
          isSuperAdmin: true,
        },
      },
      params: {},
      permissions: ["masuk:create"],
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error:
        "Kondisi barang tidak dikenal. Pilih salah satu: Baru, Bekas, atau Rusak.",
    });
    expect(mockFns.addStock).not.toHaveBeenCalled();
    expect(mockFns.createMasuk).toHaveBeenCalledWith({
      userId: "admin-1",
      body: expect.objectContaining({ kondisi: "cacat" }),
    });
  });

  it("meneruskan permission ctx dan pembatas daftar barang masuk ke cek akses gudang", async () => {
    const request = new NextRequest("http://localhost/api/inventory/masuk", {
      method: "POST",
      body: JSON.stringify({
        barangId: "barang-1",
        gudangId: "gudang-1",
        jumlah: 5,
      }),
      headers: { "content-type": "application/json" },
    });
    mockFns.validateGudangSiteAccess.mockResolvedValue({
      allowed: false,
      error: "Anda tidak memiliki akses ke Gudang ini (Beda Site).",
    });

    const response = await POST(request, {
      session: { user: { id: "staf-1", role: "STAFF" } },
      params: {},
      permissions: ["masuk:create", "masuk:site_only"],
    } as never);

    expect(response.status).toBe(403);
    expect(mockFns.buildInventoryAccessSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "staf-1" }),
      ["masuk:create", "masuk:site_only"],
    );
    expect(mockFns.validateGudangSiteAccess).toHaveBeenCalledWith(
      expect.anything(),
      "gudang-1",
      ["masuk:site_only", "barang:site_only", "gudang:site_only"],
    );
    expect(mockFns.createMasuk).not.toHaveBeenCalled();
  });
});
