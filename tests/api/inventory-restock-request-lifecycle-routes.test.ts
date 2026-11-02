import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import { prismaMock } from "@/tests/setup";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  rbacHasPermission: vi.fn(),
  verifyAuth: vi.fn(),
  authHasPermission: vi.fn(),
  createRestockRequest: vi.fn(),
  getRestockRequestDetail: vi.fn(),
  patchRestockRequestLifecycle: vi.fn(),
  patchRestockRequestStatus: vi.fn(),
  generatePOFromPRs: vi.fn(),
  getUserPermissions: vi.fn(),
}));

vi.mock("next-auth", async () => {
  const actual = await vi.importActual<typeof import("next-auth")>("next-auth");
  return {
    ...actual,
    getServerSession: mockFns.getServerSession,
  };
});

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.rbacHasPermission,
}));

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    verifyAuth: mockFns.verifyAuth,
    hasPermission: mockFns.authHasPermission,
    getUserPermissions: mockFns.getUserPermissions,
  };
});

vi.mock("@/modules/inventory", async () => {
  const actual = await vi.importActual<typeof import("@/modules/inventory")>(
    "@/modules/inventory",
  );

  return {
    ...actual,
    createRestockRequest: mockFns.createRestockRequest,
    getRestockRequestDetail: mockFns.getRestockRequestDetail,
    patchRestockRequestLifecycle: mockFns.patchRestockRequestLifecycle,
    patchRestockRequestStatus: mockFns.patchRestockRequestStatus,
  };
});

const mockGrnCreate = vi.fn();

vi.mock("@/modules/procurement", () => ({
  ProcurementService: vi.fn(
    class {
      generatePOFromPRs = mockFns.generatePOFromPRs;
    },
  ),
  getGoodsReceiptService: vi.fn(() => ({ create: mockGrnCreate })),
  PurchaseOrderNotFoundError: class extends Error {},
  GoodsReceiptInvalidError: class extends Error {},
}));

import { POST as postRestockRequests } from "@/app/api/inventory/restock/requests/route";
import {
  GET as getRestockRequestById,
  PATCH as patchRestockRequestById,
} from "@/app/api/inventory/restock/requests/[id]/route";
import { PATCH as patchRestockRequestProcess } from "@/app/api/inventory/restock/requests/[id]/process/route";
import { PATCH as patchRestockRequestReceive } from "@/app/api/inventory/restock/requests/[id]/receive/route";

describe("inventory restock request lifecycle routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getServerSession.mockResolvedValue({
      user: { id: "user-1", tenantId: "tenant-1" },
    });
    mockFns.rbacHasPermission.mockResolvedValue(true);
    mockFns.verifyAuth.mockResolvedValue({ id: "user-1" });
    mockFns.authHasPermission.mockResolvedValue(true);
    mockFns.generatePOFromPRs.mockResolvedValue([]);
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.createRestockRequest.mockResolvedValue(
      NextResponse.json(
        { id: "pr-1", nomorRequest: "PR-20260311-0001" },
        { status: 201 },
      ),
    );
  });

  it("delegates request creation to shared restock request helper", async () => {
    const response = await postRestockRequests(
      new NextRequest("http://localhost/api/inventory/restock/requests", {
        method: "POST",
        body: JSON.stringify({
          gudangId: "gudang-1",
          items: [
            {
              barangId: "barang-1",
              quantity: 3,
              keterangan: "Untuk ODP baru",
            },
          ],
          keterangan: "Restock Order: Barang 1",
        }),
      }),
    );

    expect(mockFns.createRestockRequest).toHaveBeenCalledWith({
      items: [
        {
          barangId: "barang-1",
          quantity: 3,
          keterangan: "Untuk ODP baru",
        },
      ],
      jasaItems: [],
      gudangId: "gudang-1",
      keterangan: "Restock Order: Barang 1",
      requesterId: "user-1",
      tenantId: "tenant-1",
      apiPath: "/api/inventory/restock/requests",
    });
    expect(response.status).toBe(201);
  });

  it("rejects request creation when keterangan is empty", async () => {
    const response = await postRestockRequests(
      new NextRequest("http://localhost/api/inventory/restock/requests", {
        method: "POST",
        body: JSON.stringify({
          gudangId: "gudang-1",
          items: [{ barangId: "barang-1", quantity: 3 }],
          keterangan: "   ",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Catatan belum diisi. Tulis untuk apa barang ini dibeli.",
    });
    expect(mockFns.createRestockRequest).not.toHaveBeenCalled();
  });

  it("delegates request detail reads to shared purchase request helper", async () => {
    mockFns.getRestockRequestDetail.mockResolvedValue(
      NextResponse.json({ id: "pr-1" }, { status: 200 }),
    );

    const response = await getRestockRequestById(
      new NextRequest("http://localhost/api/inventory/restock/requests/pr-1"),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    expect(mockFns.getRestockRequestDetail).toHaveBeenCalledTimes(1);
    expect(mockFns.getRestockRequestDetail).toHaveBeenCalledWith(
      "pr-1",
      "tenant-1",
    );
    expect(response.status).toBe(200);
  });

  describe("role restock:site_only", () => {
    beforeEach(() => {
      mockFns.getUserPermissions.mockResolvedValue(["restock:site_only"]);
      prismaMock.purchaseRequest.findUnique.mockResolvedValue({
        id: "pr-1",
        gudangId: "gudang-lain",
        status: "SUBMITTED",
      });
      prismaMock.user.findUnique.mockResolvedValue({
        siteId: "site-1",
        userSites: [],
      });
      prismaMock.gudang.findFirst.mockResolvedValue(null);
    });

    it("tidak bisa membuka pengajuan untuk gudang site lain", async () => {
      const response = await getRestockRequestById(
        new NextRequest("http://localhost/api/inventory/restock/requests/pr-1"),
        { params: Promise.resolve({ id: "pr-1" }) },
      );

      expect(response.status).toBe(403);
      expect(mockFns.getRestockRequestDetail).not.toHaveBeenCalled();
    });

    it("tidak bisa memproses pengajuan untuk gudang site lain", async () => {
      const response = await patchRestockRequestById(
        new NextRequest(
          "http://localhost/api/inventory/restock/requests/pr-1",
          {
            method: "PATCH",
            body: JSON.stringify({ action: "APPROVE" }),
          },
        ),
        { params: Promise.resolve({ id: "pr-1" }) },
      );

      expect(response.status).toBe(403);
      expect(mockFns.patchRestockRequestLifecycle).not.toHaveBeenCalled();
    });

    it("tidak bisa membuat pengajuan untuk gudang site lain", async () => {
      const response = await postRestockRequests(
        new NextRequest("http://localhost/api/inventory/restock/requests", {
          method: "POST",
          body: JSON.stringify({
            gudangId: "gudang-lain",
            items: [{ barangId: "barang-1", quantity: 3 }],
            keterangan: "Untuk ODP baru",
          }),
        }),
      );

      expect(response.status).toBe(403);
      expect(mockFns.createRestockRequest).not.toHaveBeenCalled();
    });
  });

  it("delegates request approval updates to shared purchase request helper", async () => {
    mockFns.patchRestockRequestLifecycle.mockResolvedValue(
      NextResponse.json({ id: "pr-1", status: "APPROVED" }, { status: 200 }),
    );

    const response = await patchRestockRequestById(
      new NextRequest("http://localhost/api/inventory/restock/requests/pr-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    expect(mockFns.patchRestockRequestLifecycle).toHaveBeenCalledTimes(1);
    expect(mockFns.patchRestockRequestLifecycle).toHaveBeenCalledWith({
      id: "pr-1",
      action: "APPROVE",
      catatan: undefined,
      actorId: "user-1",
      tenantId: "tenant-1",
    });
    expect(response.status).toBe(200);
  });

  it("maps request receive to goods receipt creation", async () => {
    prismaMock.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      purchaseOrderId: "po-1",
      gudangId: "gudang-1",
      status: "ORDERED",
      nomorRequest: "PR-20260714-0001",
    });

    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      status: "ORDERED",
      items: [
        {
          id: "po-item-1",
          barangId: "barang-1",
          quantity: 2,
          receivedQuantity: 0,
          cancelledQuantity: 0,
        },
      ],
    });
    prismaMock.purchaseOrderItem.findMany.mockResolvedValue([]);

    mockGrnCreate.mockResolvedValue({ id: "grn-1", grnNumber: "GRN-001" });
    prismaMock.purchaseOrder.update.mockResolvedValue({ status: "RECEIVED" });
    prismaMock.purchaseRequest.update.mockResolvedValue({});

    const response = await patchRestockRequestReceive(
      new NextRequest(
        "http://localhost/api/inventory/restock/requests/pr-1/receive",
        {
          method: "PATCH",
          body: JSON.stringify({
            items: { "barang-1": 2 },
            closePO: true,
            fotoBukti: ["https://img.jpg"],
          }),
        },
      ),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    expect(mockGrnCreate).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("substitutes the ordered barang when a different item arrives", async () => {
    prismaMock.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prismaMock);
      }
      return callback;
    });
    prismaMock.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      purchaseOrderId: "po-1",
      gudangId: "gudang-1",
      status: "ORDERED",
      nomorRequest: "PR-20260714-0001",
    });

    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-001",
      status: "ORDERED",
      items: [
        {
          id: "po-item-1",
          barangId: "barang-1",
          quantity: 2,
          receivedQuantity: 0,
          cancelledQuantity: 0,
          barang: { id: "barang-1", nama: "Kabel Fiber" },
        },
      ],
    });
    prismaMock.purchaseOrderItem.findMany.mockResolvedValue([]);
    prismaMock.barang.findMany.mockResolvedValue([
      { id: "barang-9", nama: "Kabel Fiber Merek Lain" },
    ]);

    mockGrnCreate.mockResolvedValue({ id: "grn-1", grnNumber: "GRN-001" });
    prismaMock.purchaseOrder.update.mockResolvedValue({ status: "RECEIVED" });
    prismaMock.purchaseRequest.update.mockResolvedValue({});

    const response = await patchRestockRequestReceive(
      new NextRequest(
        "http://localhost/api/inventory/restock/requests/pr-1/receive",
        {
          method: "PATCH",
          body: JSON.stringify({
            items: { "barang-1": 2 },
            substitutions: { "barang-1": "barang-9" },
            closePO: true,
            fotoBukti: ["https://img.jpg"],
          }),
        },
      ),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledWith({
      where: { id: "po-item-1" },
      data: { barangId: "barang-9" },
    });
    expect(prismaMock.purchaseRequestItem.updateMany).toHaveBeenCalledWith({
      where: {
        barangId: "barang-1",
        purchaseRequest: { purchaseOrderId: "po-1", tenantId: "tenant-1" },
      },
      data: { barangId: "barang-9" },
    });
    expect(mockGrnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            purchaseOrderItemId: "po-item-1",
            barangId: "barang-9",
            quantity: 2,
          },
        ],
      }),
    );
  });

  it("rejects substitution for an item already partially received", async () => {
    prismaMock.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      purchaseOrderId: "po-1",
      gudangId: "gudang-1",
      status: "ORDERED",
      nomorRequest: "PR-20260714-0001",
    });

    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-001",
      status: "ORDERED",
      items: [
        {
          id: "po-item-1",
          barangId: "barang-1",
          quantity: 5,
          receivedQuantity: 2,
          cancelledQuantity: 0,
          barang: { id: "barang-1", nama: "Kabel Fiber" },
        },
      ],
    });

    const response = await patchRestockRequestReceive(
      new NextRequest(
        "http://localhost/api/inventory/restock/requests/pr-1/receive",
        {
          method: "PATCH",
          body: JSON.stringify({
            items: { "barang-1": 3 },
            substitutions: { "barang-1": "barang-9" },
            closePO: false,
            fotoBukti: ["https://img.jpg"],
          }),
        },
      ),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    expect(response.status).toBe(400);
    expect(mockGrnCreate).not.toHaveBeenCalled();
  });

  it("cancels the outstanding quantity of an item that was not purchased", async () => {
    prismaMock.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prismaMock);
      }
      return callback;
    });
    prismaMock.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      purchaseOrderId: "po-1",
      gudangId: "gudang-1",
      status: "ORDERED",
      nomorRequest: "PR-20260714-0001",
    });

    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-001",
      status: "ORDERED",
      items: [
        {
          id: "po-item-1",
          barangId: "barang-1",
          quantity: 10,
          receivedQuantity: 0,
          cancelledQuantity: 0,
          barang: { id: "barang-1", nama: "Kabel Fiber" },
        },
        {
          id: "po-item-2",
          barangId: "barang-2",
          quantity: 5,
          receivedQuantity: 0,
          cancelledQuantity: 0,
          barang: { id: "barang-2", nama: "Kabel Dropcore" },
        },
      ],
    });
    prismaMock.purchaseOrderItem.findMany.mockResolvedValue([]);

    mockGrnCreate.mockResolvedValue({ id: "grn-1", grnNumber: "GRN-001" });
    prismaMock.purchaseOrder.update.mockResolvedValue({ status: "RECEIVED" });
    prismaMock.purchaseRequest.update.mockResolvedValue({});

    const response = await patchRestockRequestReceive(
      new NextRequest(
        "http://localhost/api/inventory/restock/requests/pr-1/receive",
        {
          method: "PATCH",
          body: JSON.stringify({
            items: { "barang-1": 6, "barang-2": 0 },
            cancellations: {
              "barang-1": "Stok supplier kosong",
              "barang-2": "Tidak dibelikan",
            },
            closePO: false,
            fotoBukti: ["https://img.jpg"],
          }),
        },
      ),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    expect(response.status).toBe(200);
    // Sisa item yang dianulir tidak boleh ikut menambah stok lewat GRN.
    expect(mockGrnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            purchaseOrderItemId: "po-item-1",
            barangId: "barang-1",
            quantity: 6,
          },
        ],
      }),
    );
    expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledWith({
      where: { id: "po-item-1" },
      data: expect.objectContaining({
        cancelledQuantity: { increment: 4 },
        cancelReason: "Stok supplier kosong",
      }),
    });
    expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledWith({
      where: { id: "po-item-2" },
      data: expect.objectContaining({
        cancelledQuantity: { increment: 5 },
        cancelReason: "Tidak dibelikan",
      }),
    });
  });

  it("does not top up a cancelled item when the order is closed", async () => {
    prismaMock.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prismaMock);
      }
      return callback;
    });
    prismaMock.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      purchaseOrderId: "po-1",
      gudangId: "gudang-1",
      status: "ORDERED",
      nomorRequest: "PR-20260714-0001",
    });

    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-001",
      status: "ORDERED",
      items: [
        {
          id: "po-item-1",
          barangId: "barang-1",
          quantity: 10,
          receivedQuantity: 0,
          cancelledQuantity: 0,
          barang: { id: "barang-1", nama: "Kabel Fiber" },
        },
      ],
    });
    prismaMock.purchaseOrderItem.findMany.mockResolvedValue([]);

    mockGrnCreate.mockResolvedValue({ id: "grn-1", grnNumber: "GRN-001" });
    prismaMock.purchaseOrder.update.mockResolvedValue({ status: "RECEIVED" });
    prismaMock.purchaseRequest.update.mockResolvedValue({});

    const response = await patchRestockRequestReceive(
      new NextRequest(
        "http://localhost/api/inventory/restock/requests/pr-1/receive",
        {
          method: "PATCH",
          body: JSON.stringify({
            items: { "barang-1": 6 },
            cancellations: { "barang-1": "Tidak dibelikan" },
            closePO: true,
            fotoBukti: ["https://img.jpg"],
          }),
        },
      ),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockGrnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            purchaseOrderItemId: "po-item-1",
            barangId: "barang-1",
            quantity: 6,
          },
        ],
      }),
    );
  });

  it("maps request process to linked purchase order start-shopping helper", async () => {
    prismaMock.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      purchaseOrderId: "po-1",
    });

    mockFns.patchRestockRequestStatus.mockResolvedValue(
      NextResponse.json({ id: "po-1", status: "ORDERED" }, { status: 200 }),
    );

    const response = await patchRestockRequestProcess(
      new NextRequest(
        "http://localhost/api/inventory/restock/requests/pr-1/process",
        {
          method: "PATCH",
        },
      ),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    expect(prismaMock.purchaseRequest.findFirst).toHaveBeenCalledWith({
      where: { id: "pr-1", tenantId: "tenant-1" },
      select: { purchaseOrderId: true, status: true },
    });
    expect(mockFns.patchRestockRequestStatus).toHaveBeenCalledWith({
      purchaseOrderId: "po-1",
      action: "START_SHOPPING",
      actorId: "user-1",
    });
    expect(response.status).toBe(200);
  });

  it("returns 500 when auto-generate PO fails for receive flow", async () => {
    prismaMock.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      purchaseOrderId: null,
      gudangId: "gudang-1",
      status: "APPROVED",
      nomorRequest: "PR-20260714-0001",
    });

    const response = await patchRestockRequestReceive(
      new NextRequest(
        "http://localhost/api/inventory/restock/requests/pr-1/receive",
        {
          method: "PATCH",
          body: JSON.stringify({ items: {}, closePO: true }),
        },
      ),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json).toMatchObject({
      error:
        "Pesanan pembelian (PO) untuk pengajuan ini belum bisa dibuat, jadi barang belum bisa diterima. Tidak ada stok yang berubah. Minta bagian pembelian membuat PO-nya, lalu coba lagi.",
    });
    expect(mockGrnCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when request has no linked purchase order for process flow", async () => {
    prismaMock.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      purchaseOrderId: null,
    });

    const response = await patchRestockRequestProcess(
      new NextRequest(
        "http://localhost/api/inventory/restock/requests/pr-1/process",
        {
          method: "PATCH",
        },
      ),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json).toMatchObject({
      error:
        "Pengajuan ini belum punya pesanan pembelian (PO). Setujui pengajuannya dulu, nanti PO dibuat otomatis.",
    });
    expect(mockFns.patchRestockRequestStatus).not.toHaveBeenCalled();
  });

  describe("receiving a partial or larger delivery", () => {
    function mockOrder(items: Array<Record<string, unknown>>) {
      prismaMock.$transaction.mockImplementation(async (callback: unknown) =>
        typeof callback === "function" ? callback(prismaMock) : callback,
      );
      prismaMock.purchaseRequest.findFirst.mockResolvedValue({
        id: "pr-1",
        purchaseOrderId: "po-1",
        gudangId: "gudang-1",
        status: "ORDERED",
        nomorRequest: "PR-20261012-0001",
      });
      prismaMock.purchaseOrder.findUnique.mockResolvedValue({
        id: "po-1",
        poNumber: "PO/2026/10/0008",
        status: "PARTIAL",
        items,
      });
      prismaMock.purchaseOrderItem.findMany.mockResolvedValue([]);
      mockGrnCreate.mockResolvedValue({ id: "grn-1", grnNumber: "GRN-001" });
      prismaMock.purchaseOrder.update.mockResolvedValue({ status: "RECEIVED" });
      prismaMock.purchaseRequest.update.mockResolvedValue({});
    }

    function receive(body: Record<string, unknown>) {
      return patchRestockRequestReceive(
        new NextRequest(
          "http://localhost/api/inventory/restock/requests/pr-1/receive",
          {
            method: "PATCH",
            body: JSON.stringify({ fotoBukti: ["https://img.jpg"], ...body }),
          },
        ),
        { params: Promise.resolve({ id: "pr-1" }) },
      );
    }

    const pigtail = {
      id: "po-item-1",
      barangId: "barang-1",
      quantity: 100,
      receivedQuantity: 30,
      cancelledQuantity: 0,
      barang: { id: "barang-1", nama: "Pigtail" },
    };
    const ont = {
      id: "po-item-2",
      barangId: "barang-2",
      quantity: 100,
      receivedQuantity: 0,
      cancelledQuantity: 0,
      barang: { id: "barang-2", nama: "ONT XPON F609V9" },
    };

    it("closing the order cancels what did not arrive instead of receiving it", async () => {
      mockOrder([pigtail, ont]);

      const response = await receive({
        items: { "barang-1": 50 },
        closePO: true,
      });

      expect(response.status).toBe(200);
      // Stok hanya bertambah sebanyak yang benar-benar datang.
      expect(mockGrnCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            {
              purchaseOrderItemId: "po-item-1",
              barangId: "barang-1",
              quantity: 50,
            },
          ],
        }),
      );
      expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledWith({
        where: { id: "po-item-1" },
        data: expect.objectContaining({
          cancelledQuantity: { increment: 20 },
          cancelReason: "Pesanan ditutup",
        }),
      });
      expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledWith({
        where: { id: "po-item-2" },
        data: expect.objectContaining({
          cancelledQuantity: { increment: 100 },
          cancelReason: "Pesanan ditutup",
        }),
      });
    });

    it("keeps the operator's own cancel reason when the order is closed", async () => {
      mockOrder([pigtail, ont]);

      await receive({
        items: { "barang-1": 70 },
        cancellations: { "barang-2": "Supplier tidak punya stok" },
        closePO: true,
      });

      expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledWith({
        where: { id: "po-item-2" },
        data: expect.objectContaining({
          cancelledQuantity: { increment: 100 },
          cancelReason: "Supplier tidak punya stok",
        }),
      });
      expect(prismaMock.purchaseOrderItem.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "po-item-1" } }),
      );
    });

    it("rejects a delivery larger than the outstanding order without a reason", async () => {
      mockOrder([pigtail]);

      const response = await receive({
        items: { "barang-1": 100 },
        closePO: false,
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error:
          "Pigtail datang 100, padahal sisa pesanannya cuma 70. Kelebihannya 30. Tulis alasan kenapa barang datang lebih, supaya jumlah di pesanan ikut ditambah.",
      });
      expect(mockGrnCreate).not.toHaveBeenCalled();
      expect(prismaMock.purchaseOrderItem.update).not.toHaveBeenCalled();
    });

    it("raises the PO quantity when a larger delivery has a reason", async () => {
      mockOrder([pigtail]);
      prismaMock.purchaseOrderItem.findFirst.mockResolvedValue({
        ...pigtail,
        unitPrice: 5000,
      });
      prismaMock.purchaseOrderItem.update.mockResolvedValue({
        ...pigtail,
        quantity: 120,
        unitPrice: 5000,
      });
      prismaMock.purchaseOrderJasaItem.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.findUnique.mockResolvedValue({
        id: "po-1",
        poNumber: "PO/2026/10/0008",
        status: "PARTIAL",
        items: [pigtail],
        ppnRate: 0,
        paymentStatus: "UNPAID",
        grandTotal: 500000,
      });

      const response = await receive({
        items: { "barang-1": 90 },
        overReceipts: { "barang-1": "Supplier kirim lebih" },
        closePO: false,
      });

      expect(response.status).toBe(200);
      expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledWith({
        where: { id: "po-item-1" },
        data: { quantity: { increment: 20 } },
      });
      expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledWith({
        where: { id: "po-item-1" },
        data: { totalPrice: 600000 },
      });
      expect(mockGrnCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            {
              purchaseOrderItemId: "po-item-1",
              barangId: "barang-1",
              quantity: 90,
            },
          ],
          notes: expect.stringContaining(
            "Kelebihan kiriman: Pigtail +20 (Supplier kirim lebih)",
          ),
        }),
      );
    });

    it("refuses to raise the PO for a verifier without purchase_orders:update", async () => {
      mockOrder([pigtail]);
      mockFns.rbacHasPermission.mockImplementation(
        async (permission: string) => permission !== "purchase_orders:update",
      );

      const response = await receive({
        items: { "barang-1": 90 },
        overReceipts: { "barang-1": "Supplier kirim lebih" },
        closePO: false,
      });

      expect(response.status).toBe(403);
      expect(prismaMock.purchaseOrderItem.update).not.toHaveBeenCalled();
      expect(mockGrnCreate).not.toHaveBeenCalled();
    });

    it("refuses to raise a PO that is already closed", async () => {
      mockOrder([pigtail]);
      prismaMock.purchaseOrder.findUnique.mockResolvedValue({
        id: "po-1",
        poNumber: "PO/2026/10/0008",
        status: "CANCELLED",
        items: [pigtail],
      });

      const response = await receive({
        items: { "barang-1": 90 },
        overReceipts: { "barang-1": "Supplier kirim lebih" },
        closePO: false,
      });

      expect(response.status).toBe(400);
      expect(prismaMock.purchaseOrderItem.update).not.toHaveBeenCalled();
    });

    it("rejects a fractional received quantity instead of failing with 500", async () => {
      mockOrder([pigtail]);

      const response = await receive({
        items: { "barang-1": 1.5 },
        closePO: false,
      });

      expect(response.status).toBe(400);
      expect(mockGrnCreate).not.toHaveBeenCalled();
    });

    it("rejects a cancellation with nothing left to cancel before stock is posted", async () => {
      mockOrder([pigtail]);

      const response = await receive({
        items: { "barang-1": 90 },
        overReceipts: { "barang-1": "Supplier kirim lebih" },
        cancellations: { "barang-1": "Tidak jadi" },
        closePO: false,
      });

      // Ditolak sebelum PO dinaikkan dan GRN dibuat, jadi mengulang aman.
      expect(response.status).toBe(400);
      expect(prismaMock.purchaseOrderItem.update).not.toHaveBeenCalled();
      expect(mockGrnCreate).not.toHaveBeenCalled();
    });

    it("puts the PO back when the GRN cannot be created after raising it", async () => {
      mockOrder([pigtail]);
      prismaMock.purchaseOrderItem.findFirst
        .mockResolvedValueOnce({ ...pigtail, unitPrice: 5000 })
        .mockResolvedValueOnce({ ...pigtail, quantity: 120, unitPrice: 5000 });
      prismaMock.purchaseOrderItem.update
        .mockResolvedValueOnce({ ...pigtail, quantity: 120, unitPrice: 5000 })
        .mockResolvedValueOnce({ ...pigtail, quantity: 120, unitPrice: 5000 })
        .mockResolvedValueOnce({ ...pigtail, quantity: 100, unitPrice: 5000 })
        .mockResolvedValueOnce({ ...pigtail, quantity: 100, unitPrice: 5000 });
      prismaMock.purchaseOrderJasaItem.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.findUnique.mockResolvedValue({
        id: "po-1",
        poNumber: "PO/2026/10/0008",
        status: "PARTIAL",
        items: [pigtail],
        ppnRate: 0,
        paymentStatus: "PAID",
        grandTotal: 500000,
      });
      prismaMock.purchaseOrderItem.findMany.mockResolvedValue([
        { quantity: 120, unitPrice: 5000 },
      ]);
      mockGrnCreate.mockRejectedValue(new Error("database unavailable"));

      const response = await receive({
        items: { "barang-1": 90 },
        overReceipts: { "barang-1": "Supplier kirim lebih" },
        closePO: false,
      });

      expect(response.status).toBe(500);
      expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledWith({
        where: { id: "po-item-1" },
        data: { quantity: { increment: -20 } },
      });
      expect(prismaMock.purchaseOrderItem.update).toHaveBeenLastCalledWith({
        where: { id: "po-item-1" },
        data: { totalPrice: 500000 },
      });
      expect(prismaMock.purchaseOrder.updateMany).toHaveBeenCalledWith({
        where: { id: "po-1", paymentStatus: "PARTIAL" },
        data: { paymentStatus: "PAID" },
      });
    });

    it("logs why a receipt was rejected", async () => {
      mockOrder([pigtail]);
      const warn = vi.spyOn(logger, "warn");

      await receive({ items: { "barang-1": 100 }, closePO: false });

      expect(warn).toHaveBeenCalledWith(
        "[RESTOCK_RECEIVE] Penerimaan ditolak",
        expect.objectContaining({
          purchaseRequestId: "pr-1",
          status: 400,
          reason: expect.stringContaining("padahal sisa pesanannya cuma 70"),
        }),
      );
    });

    it("names the barang when a verifier may not raise the PO", async () => {
      mockOrder([pigtail]);
      mockFns.rbacHasPermission.mockImplementation(
        async (permission: string) => permission !== "purchase_orders:update",
      );

      const response = await receive({
        items: { "barang-1": 90 },
        overReceipts: { "barang-1": "Supplier kirim lebih" },
        closePO: false,
      });

      const json = await response.json();
      expect(json.error).toContain("Pigtail datang lebih banyak dari pesanan");
      expect(json.error).not.toContain("purchase_orders:update");
    });

    it("refuses a cancelled order before any substitution is written", async () => {
      mockOrder([pigtail]);
      prismaMock.purchaseOrder.findUnique.mockResolvedValue({
        id: "po-1",
        poNumber: "PO/2026/10/0008",
        status: "CANCELLED",
        items: [pigtail],
      });

      const response = await receive({
        items: { "barang-1": 10 },
        substitutions: { "barang-1": "barang-9" },
        closePO: false,
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("sudah dibatalkan");
      expect(prismaMock.purchaseOrderItem.update).not.toHaveBeenCalled();
      expect(mockGrnCreate).not.toHaveBeenCalled();
    });

    it("hides a procurement error behind a plain message but logs its cause", async () => {
      mockOrder([pigtail]);
      const { GoodsReceiptInvalidError } =
        await import("@/modules/procurement");
      mockGrnCreate.mockRejectedValue(
        new GoodsReceiptInvalidError(
          "Barang GRN tidak cocok dengan barang di item PO",
        ),
      );
      const warn = vi.spyOn(logger, "warn");

      const response = await receive({
        items: { "barang-1": 10 },
        closePO: false,
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe(
        "Data barang yang diterima tidak cocok dengan pesanan. Muat ulang halaman, lalu coba lagi. Kalau masih muncul, lapor ke admin.",
      );
      expect(warn).toHaveBeenCalledWith(
        "[RESTOCK_RECEIVE] Penerimaan ditolak",
        expect.objectContaining({
          cause: "Barang GRN tidak cocok dengan barang di item PO",
        }),
      );
    });

    it("answers an unreadable body with a plain 400", async () => {
      const response = await patchRestockRequestReceive(
        new NextRequest(
          "http://localhost/api/inventory/restock/requests/pr-1/receive",
          { method: "PATCH", body: "bukan json" },
        ),
        { params: Promise.resolve({ id: "pr-1" }) },
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe(
        "Data yang dikirim tidak terbaca. Muat ulang halaman, lalu coba lagi.",
      );
    });
  });

  it("reports every invalid row of a new request at once", async () => {
    const response = await postRestockRequests(
      new NextRequest("http://localhost/api/inventory/restock/requests", {
        method: "POST",
        body: JSON.stringify({
          gudangId: "gudang-1",
          keterangan: "",
          items: [
            { barangId: "barang-1", quantity: 2 },
            { barangId: "", quantity: 0 },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      [
        "Catatan belum diisi. Tulis untuk apa barang ini dibeli.",
        "Barang ke-2: Barangnya belum dipilih. Pilih barangnya dulu.",
        "Barang ke-2: Jumlah barang paling sedikit 1.",
      ].join("\n"),
    );
    expect(mockFns.createRestockRequest).not.toHaveBeenCalled();
  });
});
