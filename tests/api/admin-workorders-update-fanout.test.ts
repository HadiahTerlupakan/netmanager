import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  createNotification: vi.fn(),
  onWorkOrderUpdated: vi.fn(),
  addComment: vi.fn(),
  addTask: vi.fn(),
  getWorkOrderById: vi.fn(),
  userFindUnique: vi.fn(),
  workOrderFindUnique: vi.fn(),
  leaveFindFirst: vi.fn(),
  workOrderActivity: vi.fn(),
  updateWorkOrder: vi.fn(),
  logActivity: vi.fn(),
  getUserContext: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (data: unknown, init?: { status?: number; message?: string }) =>
    NextResponse.json(
      { success: true, data, message: init?.message },
      { status: init?.status || 200 },
    ),
  apiError: (message: string, _code?: string, init?: { status?: number }) =>
    NextResponse.json(
      { success: false, error: message },
      { status: init?.status || 500 },
    ),
  ApiErrors: {
    forbidden: (message = "Forbidden") =>
      NextResponse.json({ error: message }, { status: 403 }),
    unauthorized: () =>
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
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

vi.mock("@/modules/notification", () => ({
  createNotification: mockFns.createNotification,
}));

vi.mock("@/modules/work-order", () => ({
  adminWorkOrderRouteService: {
    addComment: mockFns.addComment,
    addTask: mockFns.addTask,
    getUserContext: mockFns.getUserContext,
  },
  getWorkOrderService: () => ({
    getWorkOrderById: mockFns.getWorkOrderById,
  }),
  onWorkOrderUpdated: mockFns.onWorkOrderUpdated,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockFns.userFindUnique,
    },
    workOrders: {
      findUnique: mockFns.workOrderFindUnique,
    },
    leaveRequest: {
      findFirst: mockFns.leaveFindFirst,
    },
  },
  prismaAuth: {
    user: {
      findUnique: mockFns.userFindUnique,
    },
    workOrders: {
      findUnique: mockFns.workOrderFindUnique,
    },
    leaveRequest: {
      findFirst: mockFns.leaveFindFirst,
    },
  },
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    workOrderActivity: mockFns.workOrderActivity,
    updateWorkOrder: mockFns.updateWorkOrder,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    logActivity: mockFns.logActivity,
  },
}));

import { POST as commentPost } from "@/app/api/admin/workorders/[id]/comments/route";
import {
  GET as taskGet,
  POST as taskPost,
} from "@/app/api/admin/workorders/[id]/tasks/route";

describe("admin workorder update fanout", () => {
  const session = {
    user: {
      id: "admin-1",
      role: "ADMIN",
      name: "Admin One",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.getUserContext.mockResolvedValue({
      userId: "admin-1",
      isSuperAdmin: false,
      permissions: ["*"],
      siteId: "site-1",
      departmentId: "dept-1",
    });
    mockFns.userFindUnique.mockResolvedValue({
      siteId: "site-1",
      departmentId: "dept-1",
      role: "ADMIN",
    });
    mockFns.leaveFindFirst.mockResolvedValue(null);
    mockFns.addComment.mockResolvedValue({
      success: true,
      data: {
        id: "comment-1",
        message: "Teknisi tolong cek ulang",
        createdAt: new Date("2026-03-10T10:00:00.000Z"),
        userId: "admin-1",
      },
    });
    mockFns.addTask.mockResolvedValue({
      success: true,
      data: {
        id: "task-1",
        title: "Pasang modem",
        order: 1,
      },
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
      assignedTo: {
        id: "tech-1",
        pushToken: null,
        isActive: true,
      },
    });
  });

  it("comments route notifies assignee even without push token and fans out update to observers", async () => {
    const response = await commentPost(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/comments", {
        method: "POST",
        body: JSON.stringify({ message: "Teknisi tolong cek ulang" }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(201);
    expect(mockFns.addComment).toHaveBeenCalledWith({
      workOrderId: "wo-1",
      message: "Teknisi tolong cek ulang",
      actor: session.user,
      permissions: ["*"],
    });
    expect(mockFns.createNotification).not.toHaveBeenCalled();
    expect(mockFns.onWorkOrderUpdated).not.toHaveBeenCalled();
  });

  it("comments route preserves forbidden service failures", async () => {
    mockFns.addComment.mockResolvedValue({
      success: false,
      error: "Anda tidak memiliki akses ke work order ini",
      code: "FORBIDDEN",
    });

    const response = await commentPost(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/comments", {
        method: "POST",
        body: JSON.stringify({ message: "Teknisi tolong cek ulang" }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(403);
  });

  it("tasks GET route preserves forbidden service failures from getWorkOrderById", async () => {
    mockFns.getWorkOrderById.mockResolvedValue({
      success: false,
      error: "Anda tidak memiliki akses ke work order ini",
      code: "FORBIDDEN",
    });

    const response = await taskGet(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/tasks", {
        method: "GET",
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(403);
  });

  it("tasks GET route preserves not found service failures from getWorkOrderById", async () => {
    mockFns.getWorkOrderById.mockResolvedValue({
      success: false,
      error: "Work order tidak ditemukan",
      code: "NOT_FOUND",
    });

    const response = await taskGet(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/tasks", {
        method: "GET",
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(404);
  });

  it("tasks GET route preserves fetch errors as internal errors", async () => {
    mockFns.getWorkOrderById.mockResolvedValue({
      success: false,
      error: "Gagal mengambil work order",
      code: "FETCH_ERROR",
    });

    const response = await taskGet(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/tasks", {
        method: "GET",
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(500);
  });

  it("tasks route preserves not found service failures from addTask", async () => {
    mockFns.addTask.mockResolvedValue({
      success: false,
      error: "Work order tidak ditemukan",
      code: "NOT_FOUND",
    });

    const response = await taskPost(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: "Pasang modem",
          description: "Segera kerjakan",
        }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(404);
  });

  it("tasks route preserves forbidden service failures from addTask", async () => {
    mockFns.addTask.mockResolvedValue({
      success: false,
      error: "Anda tidak memiliki akses ke work order ini",
      code: "FORBIDDEN",
    });

    const response = await taskPost(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: "Pasang modem",
          description: "Segera kerjakan",
        }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(403);
  });

  it("tasks route notifies assignee even without push token and fans out update to observers", async () => {
    const response = await taskPost(
      new NextRequest("http://localhost/api/admin/workorders/wo-1/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: "Pasang modem",
          description: "Segera kerjakan",
        }),
        headers: { "content-type": "application/json" },
      }),
      { session, params: { id: "wo-1" }, permissions: ["*"] } as never,
    );

    expect(response.status).toBe(201);
    expect(mockFns.addTask).toHaveBeenCalledWith({
      workOrderId: "wo-1",
      title: "Pasang modem",
      description: "Segera kerjakan",
      order: undefined,
      actor: session.user,
      permissions: ["*"],
    });
    expect(mockFns.createNotification).not.toHaveBeenCalled();
    expect(mockFns.onWorkOrderUpdated).not.toHaveBeenCalled();
  });
});
