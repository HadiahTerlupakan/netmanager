import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  workOrderFindFirst: vi.fn(),
  workOrderTaskFindFirst: vi.fn(),
  mitraFindUnique: vi.fn(),
  findById: vi.fn(),
  start: vi.fn(),
  assign: vi.fn(),
  complete: vi.fn(),
  updateStatus: vi.fn(),
  updateTask: vi.fn(),
  addUpdate: vi.fn(),
  addAttachment: vi.fn(),
  notifyAdminsAboutMobileAction: vi.fn(),
  getMobileAuthPayload: vi.fn(),
  getMobileWorkOrderDetail: vi.fn(),
  socketUpdateWorkOrder: vi.fn(),
  syncWoStatusToTicket: vi.fn(),
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

vi.mock("@/lib/api-response", () => ({
  apiError: (message: string, _code?: string, init?: { status?: number }) =>
    NextResponse.json(
      { success: false, error: message },
      { status: init?.status || 500 },
    ),
  ErrorCodes: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    NOT_FOUND: "NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
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
    workOrderTasks: {
      findFirst: mockFns.workOrderTaskFindFirst,
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
    updateTask = mockFns.updateTask;
    addUpdate = mockFns.addUpdate;
    addAttachment = mockFns.addAttachment;
  },
  validateMobileAssignedWorkOrderAccess: async ({
    repository,
    workOrderId,
    userContext,
    allowedStatuses,
    invalidStatusMessage,
  }: {
    repository: {
      findById: (id: string) => Promise<{
        tenantId?: string | null;
        assignedToId?: string | null;
        assignments?: Array<{ userId: string; status: string }>;
        status: string;
      } | null>;
    };
    workOrderId: string;
    userContext: {
      id: string;
      tenantId?: string | undefined;
      isSuperAdmin?: boolean;
    };
    allowedStatuses: string[];
    invalidStatusMessage: string;
  }) => {
    const workOrder = await repository.findById(workOrderId);

    if (!workOrder) {
      throw new Error("Work order tidak ditemukan");
    }

    if (
      !userContext.isSuperAdmin &&
      (!userContext.tenantId ||
        !workOrder.tenantId ||
        workOrder.tenantId !== userContext.tenantId)
    ) {
      throw new Error("Akses ditolak: Tenant berbeda");
    }

    const isAssignedTo = workOrder.assignedToId === userContext.id;
    const isApprovedPartner = workOrder.assignments?.some(
      (assignment: { userId: string; status: string }) =>
        assignment.userId === userContext.id &&
        assignment.status === "APPROVED",
    );

    if (!isAssignedTo && !isApprovedPartner) {
      throw new Error(
        "Akses ditolak: Work order ini bukan tanggung jawab Anda",
      );
    }

    if (!allowedStatuses.includes(workOrder.status)) {
      throw new Error(invalidStatusMessage);
    }

    return workOrder;
  },
  syncWoStatusToTicket: mockFns.syncWoStatusToTicket,
  getEmployeeWorkOrderQueryService: () => ({
    getMobileWorkOrderDetail: mockFns.getMobileWorkOrderDetail,
  }),
  MobileWorkOrderActionService: class MockMobileWorkOrderActionService {
    updateTaskStatus = mockFns.updateTask;
    handleAction = mockFns.updateStatus;
  },
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}));

vi.mock("@/lib/utils/image-upload", () => ({
  convertAndSaveImage: vi.fn(),
}));

vi.mock("@/modules/notification", () => ({
  notifyAdminsAboutMobileAction: mockFns.notifyAdminsAboutMobileAction,
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    updateWorkOrder: mockFns.socketUpdateWorkOrder,
  },
}));

vi.mock("@/modules/work-order/services/WorkOrderSyncService", () => ({
  syncWoStatusToTicket: mockFns.syncWoStatusToTicket,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { GET as getWorkOrderDetail } from "@/app/api/mobile/work-orders/[id]/route";
import { PATCH as updateWorkOrderTask } from "@/app/api/mobile/work-orders/[id]/tasks/route";
import { POST as updateWorkOrder } from "@/app/api/mobile/work-orders/[id]/update/route";

describe("mobile work order routes", () => {
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
    mockFns.workOrderTaskFindFirst.mockResolvedValue(null);
    mockFns.mitraFindUnique.mockResolvedValue(null);
    mockFns.start.mockResolvedValue({ id: "wo-1" });
    mockFns.assign.mockResolvedValue({ id: "wo-1" });
    mockFns.complete.mockResolvedValue({ id: "wo-1" });
    mockFns.updateStatus.mockResolvedValue({ id: "wo-1" });
    mockFns.updateTask.mockResolvedValue({ id: "task-1" });
    mockFns.addUpdate.mockResolvedValue({ id: "update-1" });
    mockFns.addAttachment.mockResolvedValue({ id: "attachment-1" });
    mockFns.notifyAdminsAboutMobileAction.mockResolvedValue(undefined);
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "tech-1",
      tenantId: "tenant-1",
      name: "Teknisi Satu",
    });
    mockFns.getMobileWorkOrderDetail.mockResolvedValue({ id: "wo-1" });
    mockFns.syncWoStatusToTicket.mockResolvedValue(undefined);
  });

  describe("GET /api/mobile/work-orders/[id]", () => {
    it("mengembalikan 403 saat user mobile bukan lead atau partner approved", async () => {
      mockFns.getMobileWorkOrderDetail.mockRejectedValueOnce(
        new Error("Akses ditolak: Work order ini bukan tanggung jawab Anda"),
      );

      const response = await getWorkOrderDetail(
        new NextRequest("http://localhost/api/mobile/work-orders/wo-1"),
        {
          session,
          params: { id: "wo-1" },
        } as never,
      );

      expect(response.status).toBe(403);
    });

    it("mengembalikan 500 saat detail work order gagal dimuat karena error internal", async () => {
      mockFns.getMobileWorkOrderDetail.mockRejectedValueOnce(
        new Error("Koneksi database gagal"),
      );

      const response = await getWorkOrderDetail(
        new NextRequest("http://localhost/api/mobile/work-orders/wo-1"),
        {
          session,
          params: { id: "wo-1" },
        } as never,
      );

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Koneksi database gagal",
      });
    });

    it("mengembalikan 403 saat status work order tidak diizinkan untuk detail mobile", async () => {
      mockFns.getMobileWorkOrderDetail.mockRejectedValueOnce(
        new Error("Work order tidak dapat diakses pada status ini"),
      );

      const response = await getWorkOrderDetail(
        new NextRequest("http://localhost/api/mobile/work-orders/wo-1"),
        {
          session,
          params: { id: "wo-1" },
        } as never,
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: "Work order tidak dapat diakses pada status ini",
      });
    });
  });

  describe("POST /api/mobile/work-orders/[id]/update", () => {
    it("mengembalikan 400 jika id work order kosong", async () => {
      const response = await updateWorkOrder(
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
        tenantId: "tenant-1",
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

      const response = await updateWorkOrder(
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
      expect(mockFns.updateStatus).toHaveBeenCalledWith({
        workOrderId: "wo-1",
        tenantId: "tenant-1",
        actor: expect.objectContaining({ id: "tech-1" }),
        payload: expect.objectContaining({
          action: "NOTE",
          notes: "Catatan teknisi",
        }),
      });
      expect(mockFns.workOrderFindFirst).not.toHaveBeenCalled();
    });

    it("mengembalikan 403 jika requester hanya creator tetapi bukan teknisi assigned atau partner approved", async () => {
      mockFns.findById.mockResolvedValue({
        id: "wo-1",
        tenantId: "tenant-1",
        workOrderNumber: "WO-001",
        title: "Instalasi Baru",
        status: "IN_PROGRESS",
        assignedToId: "tech-lain",
        assignedMitraId: null,
        createdById: "tech-1",
        assignments: [],
        departmentId: "dept-1",
        siteId: "site-1",
      });
      mockFns.updateStatus.mockRejectedValueOnce(
        new Error("Akses ditolak: Work order ini bukan tanggung jawab Anda"),
      );

      const response = await updateWorkOrder(
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
      expect(mockFns.addUpdate).not.toHaveBeenCalled();
    });

    it("menyinkronkan ticket saat action START berhasil", async () => {
      mockFns.findById.mockResolvedValue({
        id: "wo-1",
        tenantId: "tenant-1",
        workOrderNumber: "WO-001",
        title: "Instalasi Baru",
        status: "ASSIGNED",
        assignedToId: "tech-1",
        assignedMitraId: null,
        createdById: "admin-1",
        assignments: [],
        departmentId: "dept-1",
        siteId: "site-1",
        ticket: { ticketNumber: "TCK-001" },
      });

      const response = await updateWorkOrder(
        new NextRequest("http://localhost/api/mobile/work-orders/wo-1/update", {
          method: "POST",
          body: JSON.stringify({ action: "START" }),
          headers: { "content-type": "application/json" },
        }),
        {
          session,
          params: { id: "wo-1" },
        } as never,
      );

      expect(response.status).toBe(200);
      expect(mockFns.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          workOrderId: "wo-1",
          payload: expect.objectContaining({ action: "START" }),
        }),
      );
    });

    it("mengembalikan 403 jika work order ditemukan tetapi user tidak punya akses", async () => {
      mockFns.findById.mockResolvedValue({
        id: "wo-1",
        tenantId: "tenant-1",
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
      mockFns.updateStatus.mockRejectedValueOnce(
        new Error("Akses ditolak: Work order ini bukan tanggung jawab Anda"),
      );

      const response = await updateWorkOrder(
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
      expect(mockFns.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ workOrderId: "wo-1" }),
      );
      expect(mockFns.workOrderFindFirst).not.toHaveBeenCalled();
    });

    it("mengembalikan 403 saat CLAIM diminta oleh user yang tidak assigned atau partner approved", async () => {
      mockFns.findById.mockResolvedValue({
        id: "wo-1",
        tenantId: "tenant-1",
        workOrderNumber: "WO-001",
        title: "Instalasi Baru",
        status: "PENDING",
        assignedToId: null,
        assignedMitraId: null,
        createdById: "admin-1",
        assignments: [],
        departmentId: "dept-1",
        siteId: "site-1",
      });
      mockFns.updateStatus.mockRejectedValueOnce(
        new Error("Akses ditolak: Work order ini bukan tanggung jawab Anda"),
      );

      const response = await updateWorkOrder(
        new NextRequest("http://localhost/api/mobile/work-orders/wo-1/update", {
          method: "POST",
          body: JSON.stringify({ action: "CLAIM" }),
          headers: { "content-type": "application/json" },
        }),
        {
          session,
          params: { id: "wo-1" },
        } as never,
      );

      expect(response.status).toBe(403);
      expect(mockFns.assign).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/mobile/work-orders/[id]/tasks", () => {
    it("mengembalikan 403 saat user mobile bukan lead atau partner approved", async () => {
      mockFns.findById.mockResolvedValue({
        id: "wo-1",
        tenantId: "tenant-1",
        workOrderNumber: "WO-001",
        title: "Instalasi Baru",
        status: "IN_PROGRESS",
        assignedToId: "tech-lain",
        assignedMitraId: null,
        assignments: [],
        departmentId: "dept-1",
        siteId: "site-1",
      });
      mockFns.workOrderTaskFindFirst.mockResolvedValue({ title: "Task 1" });
      mockFns.updateTask.mockRejectedValueOnce(
        new Error("Akses ditolak: Work order ini bukan tanggung jawab Anda"),
      );

      const response = await updateWorkOrderTask(
        new NextRequest("http://localhost/api/mobile/work-orders/wo-1/tasks", {
          method: "PATCH",
          body: JSON.stringify({ taskId: "task-1", isCompleted: true }),
          headers: { "content-type": "application/json" },
        }),
        {
          session,
          params: { id: "wo-1" },
        } as never,
      );

      expect(response.status).toBe(403);
      expect(mockFns.updateTask).toHaveBeenCalledWith({
        workOrderId: "wo-1",
        taskId: "task-1",
        isCompleted: true,
        tenantId: "tenant-1",
        actor: expect.objectContaining({
          id: "tech-1",
          tenantId: "tenant-1",
          isSuperAdmin: false,
        }),
      });
    });

    it("mengembalikan 404 saat task tidak termasuk ke work order yang diminta", async () => {
      mockFns.findById.mockResolvedValue({
        id: "wo-1",
        tenantId: "tenant-1",
        workOrderNumber: "WO-001",
        title: "Instalasi Baru",
        status: "IN_PROGRESS",
        assignedToId: "tech-1",
        assignedMitraId: null,
        assignments: [],
        departmentId: "dept-1",
        siteId: "site-1",
      });
      mockFns.workOrderTaskFindFirst.mockResolvedValue(null);
      mockFns.updateTask.mockRejectedValueOnce(new Error("TASK_NOT_FOUND"));

      const response = await updateWorkOrderTask(
        new NextRequest("http://localhost/api/mobile/work-orders/wo-1/tasks", {
          method: "PATCH",
          body: JSON.stringify({ taskId: "task-lain", isCompleted: true }),
          headers: { "content-type": "application/json" },
        }),
        {
          session,
          params: { id: "wo-1" },
        } as never,
      );

      expect(response.status).toBe(404);
      expect(mockFns.updateTask).toHaveBeenCalledWith({
        workOrderId: "wo-1",
        taskId: "task-lain",
        isCompleted: true,
        tenantId: "tenant-1",
        actor: expect.objectContaining({
          id: "tech-1",
          tenantId: "tenant-1",
          isSuperAdmin: false,
        }),
      });
    });
  });
});
