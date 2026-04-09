import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  isSuperAdmin: vi.fn(),
  createNotification: vi.fn(),
  sendPushToUsers: vi.fn(),
  onWorkOrderStatusChanged: vi.fn(),
  getWorkOrderById: vi.fn(),
  assignWorkOrder: vi.fn(),
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  deleteWorkOrder: vi.fn(),
  updateStatus: vi.fn(),
  updateWorkOrder: vi.fn(),
  findById: vi.fn(),
  userFindUnique: vi.fn(),
  workOrderFindUnique: vi.fn(),
  invalidateAllCaches: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (data: unknown, init?: { message?: string }) =>
    NextResponse.json({ success: true, data, message: init?.message }),
  apiError: (message: string, _code?: string, init?: { status?: number }) =>
    NextResponse.json(
      { success: false, error: message },
      { status: init?.status || 500 },
    ),
  ApiErrors: {
    unauthorized: () =>
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    forbidden: (message = "Forbidden") =>
      NextResponse.json({ error: message }, { status: 403 }),
    notFound: (message = "Not found") =>
      NextResponse.json({ error: message }, { status: 404 }),
  },
  ErrorCodes: {
    INTERNAL_ERROR: "INTERNAL_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
  },
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/modules/notification", () => ({
  createNotification: mockFns.createNotification,
  sendPushToUsers: mockFns.sendPushToUsers,
}));

vi.mock("@/modules/work-order/services/WorkOrderNotifications", () => ({
  onWorkOrderStatusChanged: mockFns.onWorkOrderStatusChanged,
}));

vi.mock("@/modules/work-order", () => ({
  getWorkOrderService: () => ({
    getWorkOrderById: mockFns.getWorkOrderById,
    assignWorkOrder: mockFns.assignWorkOrder,
    approveRequest: mockFns.approveRequest,
    rejectRequest: mockFns.rejectRequest,
    deleteWorkOrder: mockFns.deleteWorkOrder,
    updateStatus: mockFns.updateStatus,
    updateWorkOrder: mockFns.updateWorkOrder,
  }),
  WorkOrderRepository: class MockWorkOrderRepository {
    constructor() {}
    findById = mockFns.findById;
  },
  workOrderCacheService: {
    invalidateAllCaches: mockFns.invalidateAllCaches,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    canvasing: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: mockFns.userFindUnique,
    },
    workOrders: {
      findUnique: mockFns.workOrderFindUnique,
    },
  },
  prismaAuth: {
    canvasing: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: mockFns.userFindUnique,
    },
    workOrders: {
      findUnique: mockFns.workOrderFindUnique,
    },
  },
}));

vi.mock("@/modules/work-order/services/WorkOrderCacheService", () => ({
  workOrderCacheService: {
    invalidateAllCaches: mockFns.invalidateAllCaches,
  },
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { logActivity: vi.fn() },
}));

import { POST as assignPost } from "@/app/api/admin/workorders/[id]/assign/route";
import { POST as approvePost } from "@/app/api/admin/workorders/[id]/approve/route";
import {
  PATCH as workOrderPatch,
  DELETE as workOrderDelete,
} from "@/app/api/admin/workorders/[id]/route";

describe("admin workorder notification dedup", () => {
  const session = {
    user: {
      id: "admin-1",
      role: "ADMIN",
      permissions: ["*"],
      siteId: "site-1",
      departmentId: "dept-1",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.userFindUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === "tech-1") {
          return {
            id: "tech-1",
            siteId: "site-1",
            departmentId: "dept-1",
            isActive: true,
          };
        }
        return {
          id: "admin-1",
          siteId: "site-1",
          departmentId: "dept-1",
          isActive: true,
        };
      },
    );
    mockFns.findById.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-001",
      title: "Instalasi Baru",
      type: "INSTALLATION",
      priority: "NORMAL",
      departmentId: "dept-1",
      siteId: "site-1",
      assignedToId: "tech-1",
      status: "ASSIGNED",
    });
    mockFns.assignWorkOrder.mockResolvedValue({
      success: true,
      data: { id: "wo-1" },
    });
    mockFns.approveRequest.mockResolvedValue({
      success: true,
      data: { id: "wo-1" },
    });
    mockFns.rejectRequest.mockResolvedValue({
      success: true,
      data: { id: "wo-1" },
    });
    mockFns.deleteWorkOrder.mockResolvedValue({ success: true });
    mockFns.updateStatus.mockResolvedValue({
      success: true,
      data: { id: "wo-1" },
    });
    mockFns.updateWorkOrder.mockResolvedValue({ success: true });
    mockFns.getWorkOrderById.mockResolvedValue({
      success: true,
      data: {
        id: "wo-1",
        workOrderNumber: "WO-001",
        title: "Instalasi Baru",
        type: "INSTALLATION",
        priority: "NORMAL",
        departmentId: "dept-1",
        siteId: "site-1",
        assignedToId: "tech-1",
        status: "ASSIGNED",
      },
    });
    mockFns.workOrderFindUnique.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-001",
      title: "Instalasi Baru",
      type: "INSTALLATION",
      priority: "NORMAL",
      departmentId: "dept-1",
      siteId: "site-1",
      assignedToId: "tech-1",
      assignedTo: { id: "tech-1", isActive: true, pushToken: "push-1" },
      status: "ASSIGNED",
    });
  });

  it("does not emit an extra direct notification in assign route", async () => {
    const response = await assignPost(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/assign", {
        method: "POST",
        body: JSON.stringify({ employeeId: "tech-1" }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(200);
    expect(mockFns.createNotification).not.toHaveBeenCalled();
  });

  it("does not emit extra status notifications in patch route", async () => {
    const response = await workOrderPatch(
      new NextRequest("http://localhost/api/admin/workorders/wo-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "VERIFIED" }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(200);
    expect(mockFns.createNotification).not.toHaveBeenCalled();
    expect(mockFns.onWorkOrderStatusChanged).not.toHaveBeenCalled();
  });

  it("does not emit extra cancel notifications in delete route", async () => {
    const response = await workOrderDelete(
      new NextRequest(
        "http://localhost/api/admin/workorders/wo-1?reason=Cancelled",
        {
          method: "DELETE",
        },
      ),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(200);
    expect(mockFns.createNotification).not.toHaveBeenCalled();
    expect(mockFns.onWorkOrderStatusChanged).not.toHaveBeenCalled();
  });

  it("returns 404 when permanent delete reports missing work order", async () => {
    mockFns.deleteWorkOrder.mockResolvedValue({
      success: false,
      error: "Work order tidak ditemukan",
      code: "NOT_FOUND",
    });

    const response = await workOrderDelete(
      new NextRequest(
        "http://localhost/api/admin/workorders/wo-1?permanent=true",
        {
          method: "DELETE",
        },
      ),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when cancel delete reports missing work order", async () => {
    mockFns.updateStatus.mockResolvedValue({
      success: false,
      error: "Work order tidak ditemukan",
      code: "NOT_FOUND",
    });

    const response = await workOrderDelete(
      new NextRequest(
        "http://localhost/api/admin/workorders/wo-1?reason=Cancelled",
        {
          method: "DELETE",
        },
      ),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when assign route service denies access", async () => {
    mockFns.getWorkOrderById.mockResolvedValue({
      success: false,
      error: "Akses ditolak: Site berbeda",
      code: "FORBIDDEN",
    });

    const response = await assignPost(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/assign", {
        method: "POST",
        body: JSON.stringify({ employeeId: "tech-1" }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 when patch route service denies access", async () => {
    mockFns.findById.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-001",
      title: "Instalasi Baru",
      type: "INSTALLATION",
      priority: "NORMAL",
      departmentId: "dept-1",
      siteId: "site-1",
      assignedToId: "tech-1",
      status: "ASSIGNED",
    });
    mockFns.updateStatus.mockResolvedValue({
      success: false,
      error: "Akses ditolak: Site berbeda",
      code: "FORBIDDEN",
    });

    const response = await workOrderPatch(
      new NextRequest("http://localhost/api/admin/workorders/wo-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "VERIFIED" }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 when approve route service denies access", async () => {
    mockFns.getWorkOrderById.mockResolvedValue({
      success: false,
      error: "Akses ditolak: Site berbeda",
      code: "FORBIDDEN",
    });

    const response = await approvePost(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/approve", {
        method: "POST",
        body: JSON.stringify({ action: "APPROVE" }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 when approve route service reports missing work order", async () => {
    mockFns.approveRequest.mockResolvedValue({
      success: false,
      error: "Work order tidak ditemukan",
      code: "NOT_FOUND",
    });
    mockFns.getWorkOrderById.mockResolvedValue({
      success: true,
      data: {
        id: "wo-1",
        workOrderNumber: "WO-001",
        title: "Instalasi Baru",
        type: "INSTALLATION",
        priority: "NORMAL",
        departmentId: "dept-1",
        siteId: "site-1",
        assignedToId: "tech-1",
        requestedById: "requester-1",
        status: "REQUESTED",
      },
    });

    const response = await approvePost(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/approve", {
        method: "POST",
        body: JSON.stringify({ action: "APPROVE" }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when cancel delete service denies access", async () => {
    mockFns.updateStatus.mockResolvedValue({
      success: false,
      error: "Akses ditolak: Site berbeda",
      code: "FORBIDDEN",
    });

    const response = await workOrderDelete(
      new NextRequest(
        "http://localhost/api/admin/workorders/wo-1?reason=Cancelled",
        {
          method: "DELETE",
        },
      ),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(403);
  });
});
