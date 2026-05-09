import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  workOrdersFindFirst: vi.fn(),
  workOrdersUpdate: vi.fn(),
  workOrdersUpdateMany: vi.fn(),
  workOrderAssignmentsFindFirst: vi.fn(),
  workOrderAssignmentsCreate: vi.fn(),
  workOrderUpdatesCreate: vi.fn(),
  mitraFindUnique: vi.fn(),
  notifyAdminsAboutMobileAction: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (data: unknown, init?: { message?: string; status?: number }) =>
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
    notFound: (message = "Not found") =>
      NextResponse.json({ error: message }, { status: 404 }),
  },
  ErrorCodes: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    FORBIDDEN: "FORBIDDEN",
  },
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        workOrders: {
          updateMany: mockFns.workOrdersUpdateMany,
        },
        workOrderAssignments: {
          create: mockFns.workOrderAssignmentsCreate,
        },
      }),
    user: {
      findFirst: mockFns.userFindFirst,
    },
    workOrders: {
      findFirst: mockFns.workOrdersFindFirst,
      update: mockFns.workOrdersUpdate,
      updateMany: mockFns.workOrdersUpdateMany,
    },
    workOrderAssignments: {
      findFirst: mockFns.workOrderAssignmentsFindFirst,
      create: mockFns.workOrderAssignmentsCreate,
    },
    workOrderUpdates: {
      create: mockFns.workOrderUpdatesCreate,
    },
  },
  prismaMitra: {
    mitra: {
      findUnique: mockFns.mitraFindUnique,
    },
  },
}));

vi.mock("@/modules/notification", () => ({
  notifyAdminsAboutMobileAction: mockFns.notifyAdminsAboutMobileAction,
}));

import { POST } from "@/app/api/mobile/work-orders/available/route";

describe("mobile work orders available route", () => {
  const session = {
    user: {
      id: "tech-1",
      tenantId: "tenant-1",
      name: "Teknisi Satu",
      role: "TEKNISI",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.userFindFirst.mockResolvedValue({
      departmentId: "dept-1",
      siteId: "site-1",
      name: "Teknisi Satu",
      userSites: [],
    });
    mockFns.workOrdersFindFirst.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-001",
      title: "Gangguan Internet",
      status: "PENDING",
      assignedToId: null,
      assignedMitraId: null,
      departmentId: "dept-1",
      siteId: "site-1",
      tenantId: "tenant-1",
    });
    mockFns.workOrdersUpdate.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-001",
      title: "Gangguan Internet",
      status: "ASSIGNED",
      assignedToId: "tech-1",
      assignedMitraId: null,
      departmentId: "dept-1",
      siteId: "site-1",
      tenantId: "tenant-1",
    });
    mockFns.workOrdersUpdateMany.mockResolvedValue({ count: 1 });
    mockFns.workOrderAssignmentsFindFirst.mockResolvedValue(null);
    mockFns.workOrderAssignmentsCreate.mockResolvedValue({
      id: "assignment-1",
    });
    mockFns.workOrderUpdatesCreate.mockResolvedValue({ id: "update-1" });
    mockFns.mitraFindUnique.mockResolvedValue(null);
    mockFns.notifyAdminsAboutMobileAction.mockResolvedValue(undefined);
  });

  it("mengembalikan 400 tanpa membuat assignment saat claim kalah race", async () => {
    mockFns.workOrdersUpdateMany.mockResolvedValueOnce({ count: 0 });

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/available", {
        method: "POST",
        body: JSON.stringify({ workOrderId: "wo-1" }),
        headers: { "content-type": "application/json" },
      }),
      { session } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Work order sudah tidak tersedia",
    });
    expect(mockFns.workOrderAssignmentsCreate).not.toHaveBeenCalled();
    expect(mockFns.workOrderUpdatesCreate).not.toHaveBeenCalled();
    expect(mockFns.notifyAdminsAboutMobileAction).not.toHaveBeenCalled();
  });

  it("tetap sukses saat create assignment terkena duplicate unique constraint", async () => {
    mockFns.workOrderAssignmentsCreate.mockRejectedValueOnce({
      code: "P2002",
      message: "Unique constraint failed",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/available", {
        method: "POST",
        body: JSON.stringify({ workOrderId: "wo-1" }),
        headers: { "content-type": "application/json" },
      }),
      { session } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Work order sudah tidak tersedia",
    });
    expect(mockFns.workOrderUpdatesCreate).not.toHaveBeenCalled();
    expect(mockFns.notifyAdminsAboutMobileAction).not.toHaveBeenCalled();
  });
});
