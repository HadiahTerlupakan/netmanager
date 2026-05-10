import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const mockFns = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  departmentsFindFirst: vi.fn(),
  workOrderRepoCreateRequest: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    user: {
      findFirst: mockFns.userFindFirst,
      findMany: vi.fn().mockResolvedValue([]),
    },
    departments: {
      findFirst: mockFns.departmentsFindFirst,
    },
  } as unknown as PrismaClient,
}));

vi.mock("@/modules/notification", () => ({
  createNotification: vi.fn().mockResolvedValue({}),
  sendPushToUsers: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    newWorkOrder: vi.fn(),
  },
}));

import { MobileWorkOrderRequestService } from "@/modules/work-order/services/MobileWorkOrderRequestService";
import type { MobileWorkOrderRequestSessionUser } from "@/modules/work-order/services/MobileWorkOrderRequestService";
import { WorkOrderRepository } from "@/modules/work-order/repositories/WorkOrderRepository";

vi.spyOn(WorkOrderRepository.prototype, "createRequest").mockImplementation(
  mockFns.workOrderRepoCreateRequest,
);

describe("Mobile Work Order Request - Department Routing", () => {
  let service: MobileWorkOrderRequestService;
  const TENANT_ID = "tenant-1";
  const TECHNICAL_DEPT_ID = "dept-technical";
  const CS_DEPT_ID = "dept-cs";
  const USER_ID = "user-cs-1";

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MobileWorkOrderRequestService();

    // Default: user dari CS department
    mockFns.userFindFirst.mockResolvedValue({
      id: USER_ID,
      departmentId: CS_DEPT_ID,
    });

    // Mock work order creation
    mockFns.workOrderRepoCreateRequest.mockResolvedValue({
      id: "wo-1",
      workOrderNumber: "WO-001",
      title: "Test WO",
      type: "DISCONNECTION",
      status: "REQUESTED",
      priority: "NORMAL",
      departmentId: TECHNICAL_DEPT_ID,
      createdAt: new Date(),
    });
  });

  it("DISCONNECTION (dismantle) harus diarahkan ke departemen Technical, bukan departemen user", async () => {
    // Mock: Technical department exists
    mockFns.departmentsFindFirst.mockResolvedValueOnce({
      id: TECHNICAL_DEPT_ID,
      name: "Technical",
    });

    const userSession: MobileWorkOrderRequestSessionUser = {
      id: USER_ID,
      name: "CS User",
      tenantId: TENANT_ID,
      siteId: null,
    };

    const requestBody = {
      type: "DISCONNECTION" as const,
      title: "Request Dismantle: Customer A",
      description: "Permintaan pembongkaran perangkat untuk pelanggan",
      priority: "HIGH" as const,
      contactName: "Customer A",
      contactPhone: "08123456789",
      locationAddress: "Jl. Test No. 123",
    };

    await service.createRequest(requestBody, userSession);

    // Verifikasi: createRequest dipanggil dengan departmentId = Technical
    expect(mockFns.workOrderRepoCreateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DISCONNECTION",
        departmentId: TECHNICAL_DEPT_ID,
      }),
    );

    // Verifikasi: Technical department dicari
    expect(mockFns.departmentsFindFirst).toHaveBeenCalledWith({
      where: {
        name: "Technical",
        tenantId: TENANT_ID,
      },
      select: { id: true },
    });
  });

  it("INSTALLATION harus diarahkan ke departemen Technical", async () => {
    mockFns.departmentsFindFirst.mockResolvedValueOnce({
      id: TECHNICAL_DEPT_ID,
      name: "Technical",
    });

    const userSession: MobileWorkOrderRequestSessionUser = {
      id: USER_ID,
      name: "CS User",
      tenantId: TENANT_ID,
      siteId: null,
    };

    const requestBody = {
      type: "INSTALLATION" as const,
      title: "Request Instalasi: Customer B",
      description: "Permintaan instalasi baru",
      priority: "NORMAL" as const,
    };

    await service.createRequest(requestBody, userSession);

    expect(mockFns.workOrderRepoCreateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "INSTALLATION",
        departmentId: TECHNICAL_DEPT_ID,
      }),
    );
  });

  it("TROUBLESHOOT harus diarahkan ke departemen Technical", async () => {
    mockFns.departmentsFindFirst.mockResolvedValueOnce({
      id: TECHNICAL_DEPT_ID,
      name: "Technical",
    });

    const userSession: MobileWorkOrderRequestSessionUser = {
      id: USER_ID,
      name: "CS User",
      tenantId: TENANT_ID,
      siteId: null,
    };

    const requestBody = {
      type: "TROUBLESHOOT" as const,
      title: "Troubleshoot: Internet Down",
      description: "Internet pelanggan mati",
      priority: "HIGH" as const,
    };

    await service.createRequest(requestBody, userSession);

    expect(mockFns.workOrderRepoCreateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "TROUBLESHOOT",
        departmentId: TECHNICAL_DEPT_ID,
      }),
    );
  });

  it("OTHER type tanpa departmentId harus menggunakan departemen user", async () => {
    // Technical dept tidak ditemukan untuk type OTHER
    mockFns.departmentsFindFirst.mockResolvedValueOnce(null);

    const userSession: MobileWorkOrderRequestSessionUser = {
      id: USER_ID,
      name: "CS User",
      tenantId: TENANT_ID,
      siteId: null,
    };

    const requestBody = {
      type: "OTHER" as const,
      title: "Request Lainnya",
      description: "Request yang tidak spesifik",
      priority: "NORMAL" as const,
    };

    await service.createRequest(requestBody, userSession);

    // Verifikasi: menggunakan departemen user (CS)
    expect(mockFns.workOrderRepoCreateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OTHER",
        departmentId: CS_DEPT_ID,
      }),
    );
  });

  it("Jika departmentId dikirim eksplisit, harus menggunakan departmentId tersebut", async () => {
    const userSession: MobileWorkOrderRequestSessionUser = {
      id: USER_ID,
      name: "CS User",
      tenantId: TENANT_ID,
      siteId: null,
    };

    const requestBody = {
      type: "DISCONNECTION" as const,
      title: "Request Dismantle dengan dept eksplisit",
      description: "Test override departemen",
      priority: "NORMAL" as const,
      departmentId: CS_DEPT_ID, // Override ke CS
    };

    await service.createRequest(requestBody, userSession);

    // Verifikasi: menggunakan departmentId yang eksplisit
    expect(mockFns.workOrderRepoCreateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        departmentId: CS_DEPT_ID,
      }),
    );

    // Verifikasi: Technical department TIDAK dicari karena sudah ada departmentId
    expect(mockFns.departmentsFindFirst).not.toHaveBeenCalled();
  });
});
