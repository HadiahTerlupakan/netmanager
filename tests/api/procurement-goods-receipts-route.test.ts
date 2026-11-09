import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  rbacHasPermission: vi.fn(),
  verifyAuth: vi.fn(),
  authHasPermission: vi.fn(),
  findUser: vi.fn(),
  createFromProcurementPage: vi.fn(),
  create: vi.fn(),
}));

vi.mock("next-auth", async () => {
  const actual = await vi.importActual<typeof import("next-auth")>("next-auth");
  return { ...actual, getServerSession: mocks.getServerSession };
});

vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.rbacHasPermission }));

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    verifyAuth: mocks.verifyAuth,
    hasPermission: mocks.authHasPermission,
  };
});

vi.mock("@/modules/users", () => ({
  UserLookupService: class {
    findById = mocks.findUser;
  },
}));

vi.mock("@/modules/procurement", async () => {
  const actual = await vi.importActual<typeof import("@/modules/procurement")>(
    "@/modules/procurement",
  );
  return {
    ...actual,
    getGoodsReceiptService: () => ({
      createFromProcurementPage: mocks.createFromProcurementPage,
      create: mocks.create,
    }),
  };
});

import { POST } from "@/app/api/admin/procurement/goods-receipts/route";
import { GoodsReceiptRestockOrderError } from "@/modules/procurement";

const validBody = {
  purchaseOrderId: "11111111-1111-4111-8111-111111111111",
  gudangId: "22222222-2222-4222-8222-222222222222",
  items: [
    {
      purchaseOrderItemId: "33333333-3333-4333-8333-333333333333",
      barangId: "44444444-4444-4444-8444-444444444444",
      quantity: 2,
    },
  ],
};

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/admin/procurement/goods-receipts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );
}

describe("POST /api/admin/procurement/goods-receipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", tenantId: "tenant-1" },
    });
    mocks.verifyAuth.mockResolvedValue({ id: "user-1" });
    mocks.rbacHasPermission.mockResolvedValue(true);
    mocks.authHasPermission.mockResolvedValue(true);
    mocks.findUser.mockResolvedValue({ id: "user-1", roleId: "role-1" });
  });

  it("menolak pesanan restock dengan 409 dan pesan yang jelas", async () => {
    mocks.createFromProcurementPage.mockRejectedValue(
      new GoodsReceiptRestockOrderError(),
    );

    const response = await post(validBody);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(JSON.stringify(body)).toContain(
      "Pesanan ini dari pengajuan restock. Catat barang datang dari halaman Restock.",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("mencatat pesanan biasa lewat jalur halaman Pembelian", async () => {
    const now = new Date("2026-11-09T03:00:00.000Z");
    mocks.createFromProcurementPage.mockResolvedValue({
      id: "grn-1",
      grnNumber: "GRN-001",
      purchaseOrderId: validBody.purchaseOrderId,
      gudangId: validBody.gudangId,
      receivedById: "user-1",
      receivedAt: now,
      status: "POSTED",
      notes: null,
      fotoBukti: [],
      createdAt: now,
      updatedAt: now,
      tenantId: "tenant-1",
      items: [],
    });

    const response = await post(validBody);

    expect(response.status).toBe(200);
    expect(mocks.createFromProcurementPage).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseOrderId: validBody.purchaseOrderId,
        receivedById: "user-1",
        tenantId: "tenant-1",
      }),
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
