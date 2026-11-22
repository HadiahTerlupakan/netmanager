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
  generatePOFromPRs: vi.fn(),
  getUserPermissions: vi.fn(),
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
}));

vi.mock("@/lib/distributed-lock", () => ({
  acquireLock: mockFns.acquireLock,
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
  };
});

const mockGrnCreate = vi.fn();
const mockPurchaseOrderDelete = vi.fn();

const procurementErrors = vi.hoisted(() => {
  class PurchaseOrderNotEditableError extends Error {}
  return {
    PurchaseOrderNotEditableError,
    PurchaseOrderHasPurchasesError: class extends PurchaseOrderNotEditableError {},
  };
});

vi.mock("@/modules/procurement", () => ({
  ProcurementService: vi.fn(
    class {
      generatePOFromPRs = mockFns.generatePOFromPRs;
    },
  ),
  getGoodsReceiptService: vi.fn(() => ({ create: mockGrnCreate })),
  getPurchaseOrderService: vi.fn(() => ({ delete: mockPurchaseOrderDelete })),
  PurchaseOrderNotFoundError: class extends Error {},
  PurchaseOrderNotEditableError:
    procurementErrors.PurchaseOrderNotEditableError,
  PurchaseOrderHasPurchasesError:
    procurementErrors.PurchaseOrderHasPurchasesError,
  GoodsReceiptInvalidError: class extends Error {},
  GoodsReceiptExceedsRemainingError: class extends Error {},
  PurchaseRequestAlreadyOrderedError: class extends Error {},
  PurchaseRequestNotOrderableError: class extends Error {},
  SupplierNotActiveError: class extends Error {},
}));

import { PurchaseOrderNotFoundError } from "@/modules/procurement";
import { POST as postRestockRequests } from "@/app/api/inventory/restock/requests/route";
import {
  DELETE as deleteRestockRequestById,
  GET as getRestockRequestById,
  PATCH as patchRestockRequestById,
} from "@/app/api/inventory/restock/requests/[id]/route";
import { PATCH as patchRestockRequestReceive } from "@/app/api/inventory/restock/requests/[id]/receive/route";
import { PUT as putRestockRequestById } from "@/app/api/inventory/restock/requests/[id]/route";

/**
 * Hitungan pengajuan untuk pesanan milik satu pengajuan: jumlah pengajuan di
 * pesanan = 1, dan tidak ada pengajuan lain yang terbuka (hitungan yang
 * mengecualikan pengajuan ini).
 */
function countRequestsOnSingleRequestOrder(args: {
  where: { id?: unknown };
}): Promise<number> {
  return Promise.resolve(args.where.id === undefined ? 1 : 0);
}

const SINGLE_OPEN_REQUEST = {
  id: "pr-1",
  purchaseOrderId: "po-1",
  status: { notIn: ["RECEIVED", "CANCELLED", "REJECTED"] },
};

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
    mockFns.releaseLock.mockResolvedValue(undefined);
    mockFns.acquireLock.mockResolvedValue(mockFns.releaseLock);
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

    it("tidak bisa membatalkan pengajuan untuk gudang site lain", async () => {
      const response = await patchRestockRequestById(
        new NextRequest(
          "http://localhost/api/inventory/restock/requests/pr-1",
          {
            method: "PATCH",
            body: JSON.stringify({
              action: "CANCEL",
              alasan: "Tidak jadi dibutuhkan",
            }),
          },
        ),
        { params: Promise.resolve({ id: "pr-1" }) },
      );

      expect(response.status).toBe(403);
      expect(prismaMock.purchaseRequest.updateMany).not.toHaveBeenCalled();
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
    mockFns.patchRestockRequestLifecycle.mockResolvedValue({
      success: true,
      data: { id: "pr-1", status: "APPROVED" },
    });

    const response = await patchRestockRequestById(
      new NextRequest("http://localhost/api/inventory/restock/requests/pr-1", {
        method: "PATCH",
        body: JSON.stringify({
          action: "APPROVE",
          items: [{ itemId: "item-1", keputusan: "APPROVED", jumlah: 2 }],
        }),
      }),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    expect(mockFns.rbacHasPermission).toHaveBeenCalledWith("restock:approve");
    expect(mockFns.patchRestockRequestLifecycle).toHaveBeenCalledTimes(1);
    expect(mockFns.patchRestockRequestLifecycle).toHaveBeenCalledWith({
      id: "pr-1",
      action: "APPROVE",
      items: [{ itemId: "item-1", keputusan: "APPROVED", jumlah: 2 }],
      jasaItems: [],
      actorId: "user-1",
      tenantId: "tenant-1",
    });
    expect(response.status).toBe(200);
  });

  it("delegates request cancellation with the verify permission and writes the reason", async () => {
    prismaMock.purchaseRequest.findFirst.mockResolvedValue({
      id: "pr-1",
      purchaseOrderId: "po-1",
      gudangId: "gudang-1",
      status: "ORDERED",
      nomorRequest: "PR-20261121-0001",
      items: [
        {
          barangId: "barang-1",
          jumlah: 5,
          barang: { id: "barang-1", nama: "Kabel Fiber" },
        },
      ],
      jasaItems: [],
    });
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      status: "ORDERED",
      paymentStatus: "UNPAID",
      _count: { jasaItems: 0, purchaseRecords: 0 },
      goodsReceipts: [],
      items: [
        {
          id: "po-item-1",
          barangId: "barang-1",
          quantity: 5,
          receivedQuantity: 0,
          cancelledQuantity: 0,
          barang: { id: "barang-1", nama: "Kabel Fiber" },
        },
      ],
    });
    prismaMock.purchaseRequest.count.mockImplementation(
      countRequestsOnSingleRequestOrder,
    );
    prismaMock.purchaseOrderItem.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.purchaseOrder.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.purchaseRequest.updateMany.mockResolvedValue({ count: 1 });

    const response = await patchRestockRequestById(
      new NextRequest("http://localhost/api/inventory/restock/requests/pr-1", {
        method: "PATCH",
        body: JSON.stringify({
          action: "CANCEL",
          alasan: "Tidak jadi dibutuhkan",
        }),
      }),
      { params: Promise.resolve({ id: "pr-1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { id: "pr-1", status: "CANCELLED" },
      message: "Pengajuan dibatalkan.",
    });
    expect(mockFns.rbacHasPermission).toHaveBeenCalledWith("restock:verify");
    expect(mockFns.rbacHasPermission).not.toHaveBeenCalledWith(
      "restock:approve",
    );
    expect(mockFns.patchRestockRequestLifecycle).not.toHaveBeenCalled();
    expect(prismaMock.purchaseOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } }),
    );
    expect(prismaMock.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: SINGLE_OPEN_REQUEST,
      data: { status: "CANCELLED", cancelReason: "Tidak jadi dibutuhkan" },
    });
  });

  describe("entering goods (Lapor Barang Sampai)", () => {
    interface OrderItemRow {
      id: string;
      barangId: string;
      quantity: number;
      receivedQuantity: number;
      cancelledQuantity: number;
      barang: { id: string; nama: string };
    }

    interface ApprovedRequestOverrides {
      request?: Record<string, unknown>;
      order?: Record<string, unknown>;
    }

    const kabel: OrderItemRow = {
      id: "po-item-1",
      barangId: "barang-1",
      quantity: 10,
      receivedQuantity: 0,
      cancelledQuantity: 0,
      barang: { id: "barang-1", nama: "Kabel Fiber" },
    };
    const dropcore: OrderItemRow = {
      id: "po-item-2",
      barangId: "barang-2",
      quantity: 5,
      receivedQuantity: 0,
      cancelledQuantity: 0,
      barang: { id: "barang-2", nama: "Kabel Dropcore" },
    };

    /** Pengajuan disetujui dengan satu baris untuk setiap item pesanan. */
    function requestRow(
      items: OrderItemRow[],
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> {
      return {
        id: "pr-1",
        purchaseOrderId: "po-1",
        gudangId: "gudang-1",
        status: "ORDERED",
        nomorRequest: "PR-20260714-0001",
        items: items.map((item) => ({
          barangId: item.barangId,
          jumlah: item.quantity,
          barang: item.barang,
        })),
        jasaItems: [],
        ...overrides,
      };
    }

    function orderRow(
      items: OrderItemRow[],
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> {
      return {
        id: "po-1",
        poNumber: "PO-001",
        status: "ORDERED",
        paymentStatus: "UNPAID",
        ppnRate: 0,
        grandTotal: 0,
        _count: { jasaItems: 0, purchaseRecords: 0 },
        goodsReceipts: [],
        items,
        ...overrides,
      };
    }

    /** Pengajuan dan pesanannya seperti dibaca repository Lapor Barang Sampai. */
    function mockApprovedRequest(
      items: OrderItemRow[],
      overrides: ApprovedRequestOverrides = {},
    ): void {
      prismaMock.purchaseRequest.findFirst.mockResolvedValue(
        requestRow(items, overrides.request),
      );
      prismaMock.purchaseOrder.findUnique.mockResolvedValue(
        orderRow(items, overrides.order),
      );
      prismaMock.purchaseRequest.count.mockImplementation(
        countRequestsOnSingleRequestOrder,
      );
      prismaMock.purchaseOrderItem.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.purchaseOrder.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.purchaseRequest.updateMany.mockResolvedValue({ count: 1 });
      mockGrnCreate.mockResolvedValue({ id: "grn-1", grnNumber: "GRN-001" });
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

    it("enters every goods line through a GRN and finishes the request", async () => {
      mockApprovedRequest([kabel]);

      const response = await receive({ items: { "barang-1": 10 } });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: { id: "grn-1", grnNumber: "GRN-001" },
        purchaseRequestStatus: "RECEIVED",
        message:
          "Laporan tersimpan. Barang yang sampai sudah masuk stok gudang. Pengajuan selesai.",
      });
      expect(mockGrnCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseOrderId: "po-1",
          gudangId: "gudang-1",
          receivedById: "user-1",
          tenantId: "tenant-1",
          fotoBukti: ["https://img.jpg"],
          items: [
            {
              purchaseOrderItemId: "po-item-1",
              barangId: "barang-1",
              quantity: 10,
            },
          ],
        }),
      );
      expect(prismaMock.purchaseOrder.updateMany).toHaveBeenCalledWith({
        where: { id: "po-1", status: { notIn: ["RECEIVED", "CANCELLED"] } },
        data: { status: "RECEIVED", receivedById: "user-1" },
      });
      expect(prismaMock.purchaseRequest.updateMany).toHaveBeenCalledWith({
        where: SINGLE_OPEN_REQUEST,
        data: { status: "RECEIVED" },
      });
    });

    it("holds the request lock while entering goods", async () => {
      mockApprovedRequest([kabel]);

      await receive({ items: { "barang-1": 10 } });

      expect(mockFns.acquireLock).toHaveBeenCalledWith("restock-request:pr-1", {
        ttlSeconds: 60,
      });
      expect(mockFns.releaseLock).toHaveBeenCalledTimes(1);
    });

    it("answers 409 while another save holds the request lock", async () => {
      mockApprovedRequest([kabel]);
      mockFns.acquireLock.mockResolvedValue(null);

      const response = await receive({ items: { "barang-1": 10 } });

      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe(
        "Pengajuan ini sedang diproses. Coba lagi sebentar.",
      );
      expect(prismaMock.purchaseRequest.findFirst).not.toHaveBeenCalled();
    });

    it("strikes what was not entered with the fixed reason instead of receiving it", async () => {
      mockApprovedRequest([kabel, dropcore]);

      const response = await receive({
        items: { "barang-1": 6, "barang-2": 0 },
      });

      expect(response.status).toBe(200);
      // Stok hanya bertambah sebanyak yang benar-benar masuk.
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
      expect(prismaMock.purchaseOrderItem.updateMany).toHaveBeenCalledWith({
        where: {
          id: "po-item-1",
          purchaseOrderId: "po-1",
          quantity: 10,
          receivedQuantity: 6,
          cancelledQuantity: 0,
        },
        data: {
          cancelledQuantity: { increment: 4 },
          cancelReason: "Tidak sampai",
          cancelledAt: expect.any(Date),
        },
      });
      expect(prismaMock.purchaseOrderItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "po-item-2",
            receivedQuantity: 0,
          }),
          data: expect.objectContaining({
            cancelledQuantity: { increment: 5 },
            cancelReason: "Tidak sampai",
          }),
        }),
      );
    });

    it("on an order shared with another open request: strikes nothing, finishes only this request, leaves the order open", async () => {
      mockApprovedRequest([kabel]);
      prismaMock.purchaseRequest.count.mockImplementation(
        (args: { where: { id?: unknown } }) =>
          Promise.resolve(args.where.id === undefined ? 2 : 1),
      );

      const response = await receive({ items: { "barang-1": 6 } });

      expect(response.status).toBe(200);
      expect(mockGrnCreate).toHaveBeenCalledTimes(1);
      expect(prismaMock.purchaseOrderItem.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.purchaseOrder.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.purchaseRequest.updateMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.purchaseRequest.updateMany).toHaveBeenCalledWith({
        where: SINGLE_OPEN_REQUEST,
        data: { status: "RECEIVED" },
      });
    });

    it("answers 409 with a recovery message when closing fails after the goods receipt was saved", async () => {
      mockApprovedRequest([kabel]);
      prismaMock.purchaseRequest.updateMany.mockRejectedValue(
        new Error("Transaction already closed"),
      );

      const response = await receive({ items: { "barang-1": 6 } });

      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe(
        'Laporan barang sampai sudah tersimpan dan stok sudah bertambah, tetapi pengajuan belum tertutup. Jangan laporkan barang yang sama lagi. Muat ulang halaman, buka Lapor Barang Sampai, isi semua jumlah dengan 0, lalu pilih "Selesaikan tanpa barang tambahan".',
      );
      expect(mockGrnCreate).toHaveBeenCalledTimes(1);
    });

    it("substitutes the ordered barang and keeps the barang that was requested", async () => {
      mockApprovedRequest([kabel]);
      prismaMock.barang.findMany.mockResolvedValue([
        { id: "barang-9", nama: "Kabel Fiber Merek Lain" },
      ]);

      const response = await receive({
        items: { "barang-1": 10 },
        substitutions: { "barang-1": "barang-9" },
      });

      expect(response.status).toBe(200);
      expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledWith({
        where: { id: "po-item-1" },
        data: { barangId: "barang-9" },
      });
      // Baris yang ditolak atasan tidak ikut dipesan, jadi tidak ikut diganti.
      const orderedLines = {
        barangId: "barang-1",
        statusApproval: { not: "REJECTED" },
        purchaseRequest: { purchaseOrderId: "po-1", tenantId: "tenant-1" },
      };
      expect(prismaMock.purchaseRequestItem.updateMany).toHaveBeenCalledWith({
        where: { ...orderedLines, barangIdDiminta: null },
        data: { barangId: "barang-9", barangIdDiminta: "barang-1" },
      });
      expect(prismaMock.purchaseRequestItem.updateMany).toHaveBeenCalledWith({
        where: { ...orderedLines, barangIdDiminta: { not: null } },
        data: { barangId: "barang-9" },
      });
      expect(mockGrnCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            {
              purchaseOrderItemId: "po-item-1",
              barangId: "barang-9",
              quantity: 10,
            },
          ],
        }),
      );
    });

    it("rejects substitution for an item already partially received", async () => {
      mockApprovedRequest([{ ...kabel, quantity: 5, receivedQuantity: 2 }]);

      const response = await receive({
        items: { "barang-1": 3 },
        substitutions: { "barang-1": "barang-9" },
      });

      expect(response.status).toBe(400);
      expect(mockGrnCreate).not.toHaveBeenCalled();
    });

    it("rejects the closing fields of the old receive form with a reload message", async () => {
      mockApprovedRequest([kabel]);

      const response = await receive({
        items: { "barang-1": 6 },
        closePO: true,
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe(
        "Tindakan ini sudah tidak tersedia. Muat ulang halaman, lalu coba lagi.",
      );
      expect(mockGrnCreate).not.toHaveBeenCalled();
    });

    it("asks to cancel instead when nothing arrived on a request that never received anything", async () => {
      mockApprovedRequest([kabel]);

      const response = await receive({
        items: { "barang-1": 0 },
        fotoBukti: [],
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe(
        "Isi jumlah barang yang sampai. Bila tidak ada barang yang datang, batalkan pengajuan.",
      );
      expect(prismaMock.purchaseOrderItem.updateMany).not.toHaveBeenCalled();
    });

    it("refuses a request that still waits for approval", async () => {
      mockApprovedRequest([kabel], {
        request: { status: "DRAFT", purchaseOrderId: null },
      });

      const response = await receive({ items: { "barang-1": 10 } });

      expect(response.status).toBe(409);
      expect((await response.json()).error).toContain("belum disetujui");
      expect(mockFns.generatePOFromPRs).not.toHaveBeenCalled();
      expect(mockGrnCreate).not.toHaveBeenCalled();
    });

    it("creates the order that failed at approval through the same path, then enters goods", async () => {
      mockApprovedRequest([kabel]);
      prismaMock.purchaseRequest.findFirst.mockResolvedValueOnce(
        requestRow([kabel], { status: "APPROVED", purchaseOrderId: null }),
      );
      mockFns.generatePOFromPRs.mockResolvedValue([
        { id: "po-1", poNumber: "PO-001" },
      ]);

      const response = await receive({ items: { "barang-1": 10 } });

      expect(response.status).toBe(200);
      expect(mockFns.generatePOFromPRs).toHaveBeenCalledWith(
        ["pr-1"],
        "user-1",
      );
      expect(mockGrnCreate).toHaveBeenCalledWith(
        expect.objectContaining({ purchaseOrderId: "po-1" }),
      );
    });

    it("returns 500 when the order that failed at approval still cannot be created", async () => {
      mockApprovedRequest([kabel], {
        request: { status: "APPROVED", purchaseOrderId: null },
      });

      const response = await receive({ items: { "barang-1": 10 } });

      expect(response.status).toBe(500);
      expect((await response.json()).error).toBe(
        "Pesanan untuk pengajuan ini belum bisa dibuat, jadi laporan barang sampai belum bisa disimpan. Tidak ada barang yang masuk stok. Hubungi admin.",
      );
      expect(mockGrnCreate).not.toHaveBeenCalled();
    });

    describe("an older order that already received part of it", () => {
      const pigtail: OrderItemRow = {
        id: "po-item-1",
        barangId: "barang-1",
        quantity: 100,
        receivedQuantity: 30,
        cancelledQuantity: 0,
        barang: { id: "barang-1", nama: "Pigtail" },
      };

      function mockOlderOrder(overrides: Record<string, unknown> = {}): void {
        mockApprovedRequest([pigtail], {
          order: {
            poNumber: "PO/2026/10/0008",
            status: "PARTIAL",
            goodsReceipts: [{ id: "grn-lama" }],
            ...overrides,
          },
        });
      }

      it("finishes without a photo or GRN when nothing more arrived", async () => {
        mockOlderOrder();

        const response = await receive({
          items: { "barang-1": 0 },
          fotoBukti: [],
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          data: null,
          purchaseRequestStatus: "RECEIVED",
          message: "Tersimpan. Pengajuan selesai.",
        });
        expect(mockGrnCreate).not.toHaveBeenCalled();
        expect(prismaMock.purchaseOrderItem.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              id: "po-item-1",
              receivedQuantity: 30,
            }),
            data: expect.objectContaining({
              cancelledQuantity: { increment: 70 },
            }),
          }),
        );
      });

      it("refuses without writing statuses when the order changed meanwhile", async () => {
        mockOlderOrder();
        prismaMock.purchaseOrderItem.updateMany.mockResolvedValue({ count: 0 });

        const response = await receive({
          items: { "barang-1": 0 },
          fotoBukti: [],
        });

        expect(response.status).toBe(409);
        expect((await response.json()).error).toContain("baru saja diubah");
        expect(prismaMock.purchaseOrder.updateMany).not.toHaveBeenCalled();
      });

      it("rejects a delivery larger than the outstanding order without a reason", async () => {
        mockOlderOrder();

        const response = await receive({ items: { "barang-1": 100 } });

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          error:
            "Pigtail datang 100, padahal sisa pesanannya cuma 70. Kelebihannya 30. Tulis alasan kenapa barang datang lebih, supaya jumlah di pesanan ikut ditambah.",
        });
        expect(mockGrnCreate).not.toHaveBeenCalled();
        expect(prismaMock.purchaseOrderItem.update).not.toHaveBeenCalled();
      });

      it("raises the PO quantity when a larger delivery has a reason", async () => {
        mockOlderOrder({ grandTotal: 500000 });
        prismaMock.purchaseOrderItem.findFirst.mockResolvedValue({
          ...pigtail,
          unitPrice: 5000,
        });
        prismaMock.purchaseOrderItem.update.mockResolvedValue({
          ...pigtail,
          quantity: 120,
          unitPrice: 5000,
        });
        prismaMock.purchaseOrderItem.findMany.mockResolvedValue([]);
        prismaMock.purchaseOrderJasaItem.findMany.mockResolvedValue([]);

        const response = await receive({
          items: { "barang-1": 90 },
          overReceipts: { "barang-1": "Supplier kirim lebih" },
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
        // Kelebihan menutup seluruh sisa, jadi tidak ada yang dicoret.
        expect(prismaMock.purchaseOrderItem.updateMany).not.toHaveBeenCalled();
      });

      it("refuses to raise the PO for a verifier without purchase_orders:update", async () => {
        mockOlderOrder();
        mockFns.rbacHasPermission.mockImplementation(
          async (permission: string) => permission !== "purchase_orders:update",
        );

        const response = await receive({
          items: { "barang-1": 90 },
          overReceipts: { "barang-1": "Supplier kirim lebih" },
        });

        expect(response.status).toBe(403);
        expect(prismaMock.purchaseOrderItem.update).not.toHaveBeenCalled();
        expect(mockGrnCreate).not.toHaveBeenCalled();
      });

      it("names the barang when a verifier may not raise the PO", async () => {
        mockOlderOrder();
        mockFns.rbacHasPermission.mockImplementation(
          async (permission: string) => permission !== "purchase_orders:update",
        );

        const response = await receive({
          items: { "barang-1": 90 },
          overReceipts: { "barang-1": "Supplier kirim lebih" },
        });

        const json = await response.json();
        expect(json.error).toContain(
          "Pigtail datang lebih banyak dari pesanan",
        );
        expect(json.error).not.toContain("purchase_orders:update");
      });

      it("refuses a cancelled order before any substitution is written", async () => {
        mockOlderOrder({ status: "CANCELLED" });

        const response = await receive({
          items: { "barang-1": 10 },
          substitutions: { "barang-1": "barang-9" },
        });

        expect(response.status).toBe(409);
        expect((await response.json()).error).toContain("sudah dibatalkan");
        expect(prismaMock.purchaseOrderItem.update).not.toHaveBeenCalled();
        expect(mockGrnCreate).not.toHaveBeenCalled();
      });

      it("rejects a fractional quantity instead of failing with 500", async () => {
        mockOlderOrder();

        const response = await receive({ items: { "barang-1": 1.5 } });

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe(
          "Jumlah barang yang sampai harus angka bulat, tanpa koma.",
        );
        expect(mockGrnCreate).not.toHaveBeenCalled();
      });

      it("puts the PO back when the GRN cannot be created after raising it", async () => {
        mockOlderOrder({ paymentStatus: "PAID", grandTotal: 500000 });
        prismaMock.purchaseOrderItem.findFirst
          .mockResolvedValueOnce({ ...pigtail, unitPrice: 5000 })
          .mockResolvedValueOnce({
            ...pigtail,
            quantity: 120,
            unitPrice: 5000,
          });
        prismaMock.purchaseOrderItem.update
          .mockResolvedValueOnce({ ...pigtail, quantity: 120, unitPrice: 5000 })
          .mockResolvedValueOnce({ ...pigtail, quantity: 120, unitPrice: 5000 })
          .mockResolvedValueOnce({ ...pigtail, quantity: 100, unitPrice: 5000 })
          .mockResolvedValueOnce({
            ...pigtail,
            quantity: 100,
            unitPrice: 5000,
          });
        prismaMock.purchaseOrderJasaItem.findMany.mockResolvedValue([]);
        prismaMock.purchaseOrderItem.findMany.mockResolvedValue([
          { quantity: 120, unitPrice: 5000 },
        ]);
        mockGrnCreate.mockRejectedValue(new Error("database unavailable"));

        const response = await receive({
          items: { "barang-1": 90 },
          overReceipts: { "barang-1": "Supplier kirim lebih" },
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
        expect(mockFns.releaseLock).toHaveBeenCalledTimes(1);
      });

      it("logs why a receipt was rejected", async () => {
        mockOlderOrder();
        const warn = vi.spyOn(logger, "warn");

        await receive({ items: { "barang-1": 100 } });

        expect(warn).toHaveBeenCalledWith(
          "[RESTOCK_RECEIVE] Penerimaan ditolak",
          expect.objectContaining({
            purchaseRequestId: "pr-1",
            status: 400,
            reason: expect.stringContaining("padahal sisa pesanannya cuma 70"),
          }),
        );
      });

      it("hides a procurement error behind a plain message but logs its cause", async () => {
        mockOlderOrder();
        const { GoodsReceiptInvalidError } =
          await import("@/modules/procurement");
        mockGrnCreate.mockRejectedValue(
          new GoodsReceiptInvalidError(
            "Barang GRN tidak cocok dengan barang di item PO",
          ),
        );
        const warn = vi.spyOn(logger, "warn");

        const response = await receive({ items: { "barang-1": 10 } });

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

  describe("deleting a request", () => {
    function remove() {
      return deleteRestockRequestById(
        new NextRequest(
          "http://localhost/api/inventory/restock/requests/pr-1",
          { method: "DELETE" },
        ),
        { params: Promise.resolve({ id: "pr-1" }) },
      );
    }

    interface DetailOverrides {
      purchaseOrder?: Record<string, unknown>;
      jasaItems?: Array<Record<string, unknown>>;
    }

    /** Baris detail seperti dibaca read-model: disetujui, pesanannya masih DRAFT. */
    function approvedRequestRow(
      overrides: DetailOverrides = {},
    ): Record<string, unknown> {
      return {
        id: "pr-1",
        nomorRequest: "PR-20261108-0001",
        status: "ORDERED",
        purchaseOrderId: "po-1",
        gudangId: "gudang-1",
        items: [
          {
            id: "item-1",
            barangId: "barang-1",
            jumlah: 5,
            statusApproval: "APPROVED",
          },
        ],
        jasaItems: overrides.jasaItems ?? [],
        purchaseOrder: {
          id: "po-1",
          poNumber: "PO-1",
          status: "DRAFT",
          items: [
            {
              id: "poi-1",
              barangId: "barang-1",
              quantity: 5,
              receivedQuantity: 0,
              cancelledQuantity: 0,
              cancelReason: null,
            },
          ],
          goodsReceipts: [],
          ...overrides.purchaseOrder,
        },
      };
    }

    /** Penghapusan bersyarat: tanpa pesanan, belum Sudah Sampai, tanpa jasa selesai. */
    const DELETABLE_REQUEST_WHERE = {
      id: "pr-1",
      tenantId: "tenant-1",
      purchaseOrderId: null as string | null,
      status: { not: "RECEIVED" },
      jasaItems: {
        none: {
          statusKonfirmasi: "SELESAI",
          statusApproval: { not: "REJECTED" },
        },
      },
    };

    beforeEach(() => {
      prismaMock.purchaseRequest.deleteMany.mockResolvedValue({ count: 1 });
    });

    async function expectRefused(message: string) {
      const response = await remove();
      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe(message);
      expect(prismaMock.purchaseRequest.deleteMany).not.toHaveBeenCalled();
    }

    it("deletes the request together with its unprocessed order, under the request lock", async () => {
      prismaMock.purchaseRequest.findFirst.mockResolvedValue(
        approvedRequestRow(),
      );

      const response = await remove();

      expect(response.status).toBe(200);
      expect(mockFns.acquireLock).toHaveBeenCalledWith("restock-request:pr-1", {
        ttlSeconds: 60,
      });
      expect(prismaMock.purchaseRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pr-1", tenantId: "tenant-1" },
        }),
      );
      expect(mockPurchaseOrderDelete).toHaveBeenCalledWith("po-1");
      expect(prismaMock.purchaseRequest.deleteMany).toHaveBeenCalledWith({
        where: DELETABLE_REQUEST_WHERE,
      });
      expect(mockFns.releaseLock).toHaveBeenCalledTimes(1);
    });

    it("still deletes the request when its order is already gone", async () => {
      prismaMock.purchaseRequest.findFirst.mockResolvedValue(
        approvedRequestRow(),
      );
      mockPurchaseOrderDelete.mockRejectedValueOnce(
        new PurchaseOrderNotFoundError("po-1"),
      );

      const response = await remove();

      expect(response.status).toBe(200);
      expect(prismaMock.purchaseRequest.deleteMany).toHaveBeenCalledWith({
        where: DELETABLE_REQUEST_WHERE,
      });
    });

    it("answers 409 when an order was attached to the request meanwhile", async () => {
      prismaMock.purchaseRequest.findFirst.mockResolvedValue(
        approvedRequestRow(),
      );
      prismaMock.purchaseRequest.deleteMany.mockResolvedValue({ count: 0 });

      const response = await remove();

      expect(response.status).toBe(409);
      expect((await response.json()).error).toContain("baru saja diubah");
    });

    it("answers 409 while Lapor Barang Sampai or Batalkan holds the request lock", async () => {
      mockFns.acquireLock.mockResolvedValue(null);

      const response = await remove();

      expect(response.status).toBe(409);
      expect(prismaMock.purchaseRequest.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.purchaseRequest.deleteMany).not.toHaveBeenCalled();
    });

    it("answers 404 when the request no longer exists", async () => {
      prismaMock.purchaseRequest.findFirst.mockResolvedValue(null);

      const response = await remove();

      expect(response.status).toBe(404);
      expect(mockPurchaseOrderDelete).not.toHaveBeenCalled();
      expect(prismaMock.purchaseRequest.deleteMany).not.toHaveBeenCalled();
    });

    it("refuses once goods of its order have arrived", async () => {
      prismaMock.purchaseRequest.findFirst.mockResolvedValue(
        approvedRequestRow({
          purchaseOrder: {
            goodsReceipts: [
              {
                id: "grn-1",
                grnNumber: "GRN-1",
                fotoBukti: ["/bukti.webp"],
                receivedAt: new Date("2026-11-10T08:00:00Z"),
                receivedBy: null,
                items: [],
              },
            ],
          },
        }),
      );

      await expectRefused(
        "Pengajuan ini tidak bisa dihapus karena sudah ada barang yang dilaporkan sampai atau jasa yang ditandai selesai.",
      );
      expect(mockPurchaseOrderDelete).not.toHaveBeenCalled();
    });

    it("refuses once a service of the request was confirmed done", async () => {
      prismaMock.purchaseRequest.findFirst.mockResolvedValue(
        approvedRequestRow({
          jasaItems: [
            { statusKonfirmasi: "SELESAI", statusApproval: "APPROVED" },
          ],
        }),
      );

      await expectRefused(
        "Pengajuan ini tidak bisa dihapus karena sudah ada barang yang dilaporkan sampai atau jasa yang ditandai selesai.",
      );
    });

    it("refuses an order that was already processed", async () => {
      prismaMock.purchaseRequest.findFirst.mockResolvedValue(
        approvedRequestRow({ purchaseOrder: { status: "ORDERED" } }),
      );

      await expectRefused(
        "Pengajuan ini tidak bisa dihapus karena pesanannya sudah diproses atau dibatalkan. Muat ulang halaman untuk melihat keadaan terbarunya.",
      );
      expect(mockPurchaseOrderDelete).not.toHaveBeenCalled();
    });

    it("refuses an order with old purchase records, which the FK keeps (RESTRICT)", async () => {
      prismaMock.purchaseRequest.findFirst.mockResolvedValue(
        approvedRequestRow(),
      );
      mockPurchaseOrderDelete.mockRejectedValueOnce(
        new procurementErrors.PurchaseOrderHasPurchasesError(),
      );

      await expectRefused(
        "Pengajuan ini punya catatan belanja lama, jadi tidak bisa dihapus. Batalkan pengajuannya saja.",
      );
    });

    it("refuses when goods arrived after the check, as reported by procurement", async () => {
      prismaMock.purchaseRequest.findFirst.mockResolvedValue(
        approvedRequestRow(),
      );
      mockPurchaseOrderDelete.mockRejectedValueOnce(
        new procurementErrors.PurchaseOrderNotEditableError(),
      );

      await expectRefused(
        "Pengajuan ini tidak bisa dihapus karena sudah ada barang yang dilaporkan sampai atau jasa yang ditandai selesai.",
      );
    });
  });

  describe("editing a request that was decided meanwhile", () => {
    function sendEdit() {
      return putRestockRequestById(
        new NextRequest(
          "http://localhost/api/inventory/restock/requests/pr-1",
          {
            method: "PUT",
            body: JSON.stringify({
              gudangId: "gudang-1",
              keterangan: "Stok habis",
              items: [{ barangId: "barang-1", quantity: 10 }],
            }),
          },
        ),
        { params: Promise.resolve({ id: "pr-1" }) },
      );
    }

    beforeEach(() => {
      prismaMock.purchaseRequest.findUnique.mockResolvedValue({
        id: "pr-1",
        gudangId: "gudang-1",
        status: "DRAFT",
      });
    });

    it("keeps the approver's line decisions when the PR was approved after the form opened", async () => {
      prismaMock.purchaseRequest.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.purchaseRequest.findFirst.mockResolvedValue({
        status: "APPROVED",
      });

      const response = await sendEdit();

      expect(response.status).toBe(409);
      expect((await response.json()).error).toContain("sudah disetujui");
      expect(prismaMock.purchaseRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "pr-1",
            tenantId: "tenant-1",
            status: { in: ["DRAFT", "SUBMITTED"] },
            purchaseOrderId: null,
          },
        }),
      );
      expect(prismaMock.purchaseRequestItem.deleteMany).not.toHaveBeenCalled();
      expect(prismaMock.purchaseRequestItem.createMany).not.toHaveBeenCalled();
    });

    it("refuses a request that already has an order, without touching its lines", async () => {
      prismaMock.purchaseRequest.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.purchaseRequest.findFirst.mockResolvedValue({
        status: "DRAFT",
      });

      const response = await sendEdit();

      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe(
        "Pengajuan ini sudah punya pesanan, jadi tidak bisa diubah lagi. Muat ulang halaman untuk melihat keadaan terbarunya.",
      );
      expect(prismaMock.purchaseRequestItem.deleteMany).not.toHaveBeenCalled();
    });

    it("answers 404 when the request was deleted after the form opened", async () => {
      prismaMock.purchaseRequest.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.purchaseRequest.findFirst.mockResolvedValue(null);

      const response = await sendEdit();

      expect(response.status).toBe(404);
      expect(prismaMock.purchaseRequestItem.deleteMany).not.toHaveBeenCalled();
    });

    it("claims the PR row before replacing its lines", async () => {
      const callOrder: string[] = [];
      prismaMock.purchaseRequest.updateMany.mockImplementation((async () => {
        callOrder.push("claim");
        return { count: 1 };
      }) as never);
      prismaMock.purchaseRequestItem.deleteMany.mockImplementation(
        (async () => {
          callOrder.push("deleteItems");
          return { count: 1 };
        }) as never,
      );
      prismaMock.purchaseRequest.findUnique.mockResolvedValue({
        id: "pr-1",
        gudangId: "gudang-1",
        status: "DRAFT",
        nomorRequest: "PR-1",
        items: [],
      });

      const response = await sendEdit();

      expect(response.status).toBe(200);
      expect(callOrder).toEqual(["claim", "deleteItems"]);
    });
  });
});
