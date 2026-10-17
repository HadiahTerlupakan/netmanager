import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  addComment: vi.fn(),
  updateStatus: vi.fn(),
  getWorkOrderById: vi.fn(),
  getUserContext: vi.fn(),
  sendReminder: vi.fn(),
  recordWorkOrderExport: vi.fn(),
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

vi.mock("@/lib/rbac", () => ({ hasPermission: mockFns.hasPermission }));

vi.mock("@/modules/work-order", () => ({
  workOrderExportLogSchema: {},
  getAdminWorkOrderRouteService: () => ({
    getUserContext: mockFns.getUserContext,
    sendReminder: mockFns.sendReminder,
  }),
  getWorkOrderService: () => ({
    addComment: mockFns.addComment,
    updateStatus: mockFns.updateStatus,
    getWorkOrderById: mockFns.getWorkOrderById,
  }),
  recordWorkOrderExport: mockFns.recordWorkOrderExport,
}));

const SESSION = {
  user: { id: "admin-1", tenantId: "tenant-1", role: "admin", name: "Admin" },
};

function jsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Log Aktivitas route admin work order", () => {
  beforeEach(() => {
    Object.values(mockFns).forEach((fn) => fn.mockReset());
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.getUserContext.mockResolvedValue({ id: "admin-1" });
  });

  it("meneruskan alasan tolak hasil pekerjaan ke perubahan status", async () => {
    mockFns.updateStatus.mockResolvedValue({ success: true });
    mockFns.getWorkOrderById.mockResolvedValue({ success: true, data: {} });
    const { PATCH } = await import("@/app/api/admin/workorders/[id]/route");

    const response = await PATCH(
      jsonRequest("http://localhost/api/admin/workorders/wo-1", "PATCH", {
        status: "IN_PROGRESS",
        rejectionReason: "Foto ODP tidak jelas",
      }),
      { session: SESSION, params: { id: "wo-1" } } as never,
    );

    expect(response.status).toBe(200);
    expect(mockFns.updateStatus).toHaveBeenCalledWith(
      "wo-1",
      "IN_PROGRESS",
      { id: "admin-1" },
      "Foto ODP tidak jelas",
    );
  });

  it("menyertakan pengirim saat mengirim reminder", async () => {
    mockFns.sendReminder.mockResolvedValue({
      success: true,
      data: { sentCount: 2 },
    });
    const { POST } =
      await import("@/app/api/admin/workorders/[id]/reminder/route");

    await POST(
      jsonRequest(
        "http://localhost/api/admin/workorders/wo-1/reminder",
        "POST",
        { departmentId: "dept-noc" },
      ),
      { session: SESSION, params: { id: "wo-1" } } as never,
    );

    expect(mockFns.sendReminder).toHaveBeenCalledWith({
      workOrderId: "wo-1",
      customMessage: undefined,
      targetDepartmentId: "dept-noc",
      actorId: "admin-1",
    });
  });

  it("mencatat unduhan PDF daftar work order", async () => {
    const { POST } = await import("@/app/api/admin/workorders/exports/route");
    const body = {
      format: "PDF",
      exportedCount: 120,
      total: 135,
      filters: ["Status: Selesai"],
    };

    const response = await POST(
      jsonRequest(
        "http://localhost/api/admin/workorders/exports",
        "POST",
        body,
      ),
      { session: SESSION, params: {}, validated: body } as never,
    );

    expect(response.status).toBe(201);
    expect(mockFns.recordWorkOrderExport).toHaveBeenCalledWith({
      ...body,
      actorId: "admin-1",
      tenantId: "tenant-1",
    });
  });

  it("menolak pencatatan unduhan tanpa izin baca work order", async () => {
    mockFns.hasPermission.mockResolvedValue(false);
    const { POST } = await import("@/app/api/admin/workorders/exports/route");

    const response = await POST(
      jsonRequest("http://localhost/api/admin/workorders/exports", "POST", {}),
      { session: SESSION, params: {}, validated: {} } as never,
    );

    expect(response.status).toBe(403);
    expect(mockFns.recordWorkOrderExport).not.toHaveBeenCalled();
  });
});
