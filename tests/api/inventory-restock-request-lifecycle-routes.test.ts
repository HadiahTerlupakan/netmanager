import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
      error: "Catatan / Keterangan wajib diisi",
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
        },
      ],
    });

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
      error: "Gagal membuat Purchase Order. Coba lagi atau hubungi admin.",
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
      error: "Purchase Request belum memiliki Purchase Order untuk diproses",
    });
    expect(mockFns.patchRestockRequestStatus).not.toHaveBeenCalled();
  });
});
