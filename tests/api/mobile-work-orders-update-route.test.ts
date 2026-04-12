import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  workOrderFindFirst: vi.fn(),
  mitraFindUnique: vi.fn(),
  findById: vi.fn(),
  start: vi.fn(),
  assign: vi.fn(),
  complete: vi.fn(),
  updateStatus: vi.fn(),
  addUpdate: vi.fn(),
  addAttachment: vi.fn(),
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
  },
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    user: {
      findFirst: mockFns.userFindFirst,
    },
    workOrders: {
      findFirst: mockFns.workOrderFindFirst,
    },
  },
  prismaMitra: {
    mitra: {
      findUnique: mockFns.mitraFindUnique,
    },
  },
}));

vi.mock("@/modules/work-order", () => ({
  WorkOrderRepository: class MockWorkOrderRepository {
    constructor() {}
    findById = mockFns.findById;
    start = mockFns.start;
    assign = mockFns.assign;
    complete = mockFns.complete;
    updateStatus = mockFns.updateStatus;
    addUpdate = mockFns.addUpdate;
    addAttachment = mockFns.addAttachment;
  },
}));

vi.mock("@/lib/utils/image-upload", () => ({
  convertAndSaveImage: vi.fn(),
}));

vi.mock("@/modules/notification", () => ({
  notifyAdminsAboutMobileAction: mockFns.notifyAdminsAboutMobileAction,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { POST } from "@/app/api/mobile/work-orders/[id]/update/route";

describe("mobile work orders [id]/update route", () => {
  const session = {
    user: {
      id: "tech-1",
      tenantId: "tenant-1",
      name: "Teknisi Satu",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.userFindFirst.mockResolvedValue({ name: "Teknisi Satu" });
    mockFns.workOrderFindFirst.mockResolvedValue(null);
    mockFns.mitraFindUnique.mockResolvedValue(null);
    mockFns.start.mockResolvedValue({ id: "wo-1" });
    mockFns.assign.mockResolvedValue({ id: "wo-1" });
    mockFns.complete.mockResolvedValue({ id: "wo-1" });
    mockFns.updateStatus.mockResolvedValue({ id: "wo-1" });
    mockFns.addUpdate.mockResolvedValue({ id: "update-1" });
    mockFns.addAttachment.mockResolvedValue({ id: "attachment-1" });
    mockFns.notifyAdminsAboutMobileAction.mockResolvedValue(undefined);
  });

  it("mengembalikan 400 jika id work order kosong", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders//update", {
        method: "POST",
        body: JSON.stringify({ action: "NOTE", notes: "Catatan teknisi" }),
        headers: { "content-type": "application/json" },
      }),
      {
        session,
        params: { id: "" },
      } as never,
    );

    expect(response.status).toBe(400);
    expect(mockFns.findById).not.toHaveBeenCalled();
    expect(mockFns.workOrderFindFirst).not.toHaveBeenCalled();
  });

  it("memakai WorkOrderRepository.findById untuk lookup tenant-aware sebelum memproses NOTE", async () => {
    mockFns.findById.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-001",
      title: "Instalasi Baru",
      status: "IN_PROGRESS",
      assignedToId: "tech-1",
      assignedMitraId: null,
      createdById: "admin-1",
      assignments: [],
      departmentId: "dept-1",
      siteId: "site-1",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/wo-1/update", {
        method: "POST",
        body: JSON.stringify({ action: "NOTE", notes: "Catatan teknisi" }),
        headers: { "content-type": "application/json" },
      }),
      {
        session,
        params: { id: "wo-1" },
      } as never,
    );

    expect(response.status).toBe(200);
    expect(mockFns.findById).toHaveBeenCalledWith("wo-1");
    expect(mockFns.workOrderFindFirst).not.toHaveBeenCalled();
    expect(mockFns.addUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        workOrderId: "wo-1",
        updateType: "NOTE",
        message: "Catatan teknisi",
        createdById: "tech-1",
      }),
    );
  });

  it("mengembalikan 403 jika work order ditemukan tetapi user tidak punya akses", async () => {
    mockFns.findById.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-001",
      title: "Instalasi Baru",
      status: "IN_PROGRESS",
      assignedToId: "tech-lain",
      assignedMitraId: null,
      createdById: "admin-1",
      assignments: [],
      departmentId: "dept-1",
      siteId: "site-1",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/wo-1/update", {
        method: "POST",
        body: JSON.stringify({ action: "NOTE", notes: "Catatan teknisi" }),
        headers: { "content-type": "application/json" },
      }),
      {
        session,
        params: { id: "wo-1" },
      } as never,
    );

    expect(response.status).toBe(403);
    expect(mockFns.findById).toHaveBeenCalledWith("wo-1");
    expect(mockFns.workOrderFindFirst).not.toHaveBeenCalled();
  });
});
