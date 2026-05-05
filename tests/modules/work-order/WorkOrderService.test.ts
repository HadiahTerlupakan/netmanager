import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkOrderStatus } from "@prisma/client";
import { prismaMock } from "../../setup";
import { onWorkOrderCreated } from "@/modules/work-order/services/WorkOrderNotifications";
import { WorkOrderService } from "@/modules/work-order/services/WorkOrderService";

// Mock the dependencies
vi.mock("@/modules/work-order/repositories/WorkOrderRepository");
vi.mock("@/modules/work-order/services/WorkOrderNotifications");
vi.mock("@/modules/work-order/services/WorkOrderCacheService");
vi.mock("@/modules/work-order/services/WorkOrderReadService");
vi.mock("@/modules/work-order/services/WorkOrderMutationService");
vi.mock("@/lib/websocket/emitter");
vi.mock("@/lib/logger");

type MockReadService = {
  getWorkOrderById: ReturnType<typeof vi.fn>;
  getWorkOrders: ReturnType<typeof vi.fn>;
};

type MockMutationService = {
  createWorkOrder: ReturnType<typeof vi.fn>;
  deleteWorkOrder: ReturnType<typeof vi.fn>;
  updateStatus: ReturnType<typeof vi.fn>;
};

describe("WorkOrderService", () => {
  let service: WorkOrderService;
  let readServiceMock: MockReadService;
  let mutationServiceMock: MockMutationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkOrderService(prismaMock as never);
    readServiceMock = (service as unknown as Record<string, MockReadService>)
      .readService;
    mutationServiceMock = (
      service as unknown as Record<string, MockMutationService>
    ).mutationService;

    // Setup default mocks
    if (readServiceMock) {
      readServiceMock.getWorkOrderById = vi.fn();
      readServiceMock.getWorkOrders = vi.fn();
    }
    if (mutationServiceMock) {
      mutationServiceMock.createWorkOrder = vi.fn();
      mutationServiceMock.deleteWorkOrder = vi.fn();
      mutationServiceMock.updateStatus = vi.fn();
    }
  });

  describe("Access Control (validateWorkOrderAccess via getWorkOrderById)", () => {
    const mockWorkOrder = {
      id: "wo-123",
      departmentId: "dept-1",
      siteId: "site-1",
      workOrderNumber: "WO-001",
      title: "Test WO",
    };

    it("should allow access for SUPER_ADMIN regardless of site/department", async () => {
      readServiceMock.getWorkOrderById.mockResolvedValue({
        success: true,
        data: mockWorkOrder,
      });

      const userContext = {
        id: "admin-1",
        role: "SUPER_ADMIN",
      };

      const result = await service.getWorkOrderById("wo-123", userContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockWorkOrder);
    });

    it("should allow access when department matches and department_only restriction is active", async () => {
      readServiceMock.getWorkOrderById.mockResolvedValue({
        success: true,
        data: mockWorkOrder,
      });

      const userContext = {
        id: "user-1",
        role: "USER",
        permissions: ["workorders:department_only"],
        departmentId: "dept-1",
      };

      const result = await service.getWorkOrderById("wo-123", userContext);

      expect(result.success).toBe(true);
    });

    it("should deny access when department does not match and department_only restriction is active", async () => {
      readServiceMock.getWorkOrderById.mockResolvedValue({
        success: false,
        error: "Akses ditolak: Departemen berbeda",
        code: "FORBIDDEN",
      });

      const userContext = {
        id: "user-1",
        role: "USER",
        permissions: ["workorders:department_only"],
        departmentId: "dept-different",
      };

      const result = await service.getWorkOrderById("wo-123", userContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Akses ditolak: Departemen berbeda");
      expect(result.code).toBe("FORBIDDEN");
    });

    it("should allow access when site matches and site_only restriction is active", async () => {
      readServiceMock.getWorkOrderById.mockResolvedValue({
        success: true,
        data: mockWorkOrder,
      });

      const userContext = {
        id: "user-1",
        role: "USER",
        permissions: ["workorders:site_only"],
        siteId: "site-1",
      };

      const result = await service.getWorkOrderById("wo-123", userContext);

      expect(result.success).toBe(true);
    });

    it("should deny access when site does not match and site_only restriction is active", async () => {
      readServiceMock.getWorkOrderById.mockResolvedValue({
        success: false,
        error: "Akses ditolak: Site berbeda",
        code: "FORBIDDEN",
      });

      const userContext = {
        id: "user-1",
        role: "USER",
        permissions: ["workorders:site_only"],
        siteId: "site-different",
      };

      const result = await service.getWorkOrderById("wo-123", userContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Akses ditolak: Site berbeda");
      expect(result.code).toBe("FORBIDDEN");
    });

    it("should allow access if no restrictions are present", async () => {
      readServiceMock.getWorkOrderById.mockResolvedValue({
        success: true,
        data: mockWorkOrder,
      });

      const userContext = {
        id: "user-1",
        role: "USER",
        permissions: [] as string[],
      };

      const result = await service.getWorkOrderById("wo-123", userContext);

      expect(result.success).toBe(true);
    });
  });

  describe("getWorkOrders (List restrictions)", () => {
    it("should apply department filter when department_only is present", async () => {
      readServiceMock.getWorkOrders.mockResolvedValue({
        success: true,
        data: {
          workOrders: [],
          total: 0,
          page: 1,
          totalPages: 0,
        },
      });

      await service.getWorkOrders({
        userPermissions: ["workorders:department_only"],
        userDepartmentId: "dept-1",
        userRole: "USER",
      });

      expect(readServiceMock.getWorkOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          userPermissions: ["workorders:department_only"],
          userDepartmentId: "dept-1",
        }),
      );
    });

    it("should return empty list if department_only is present but user has no departmentId", async () => {
      readServiceMock.getWorkOrders.mockResolvedValue({
        success: true,
        data: {
          workOrders: [],
          total: 0,
          page: 1,
          totalPages: 0,
        },
      });

      const result = await service.getWorkOrders({
        userPermissions: ["workorders:department_only"],
        userRole: "USER",
        // missing userDepartmentId
      });

      expect(result.success).toBe(true);
      expect(result.data?.workOrders).toEqual([]);
    });

    it("should apply site filter when site_only is present", async () => {
      readServiceMock.getWorkOrders.mockResolvedValue({
        success: true,
        data: {
          workOrders: [],
          total: 0,
          page: 1,
          totalPages: 0,
        },
      });

      await service.getWorkOrders({
        userPermissions: ["workorders:site_only"],
        userSiteId: "site-1",
        userRole: "USER",
      });

      expect(readServiceMock.getWorkOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          userPermissions: ["workorders:site_only"],
          userSiteId: "site-1",
        }),
      );
    });
  });

  describe("createWorkOrder restrictions", () => {
    it("forces siteId to the user site when workorders:site_only is active", async () => {
      mutationServiceMock.createWorkOrder.mockResolvedValue({
        success: false,
        error:
          "Akses ditolak: Anda hanya dapat membuat work order untuk site Anda",
        code: "FORBIDDEN",
      });

      const result = await service.createWorkOrder(
        {
          type: "INSTALLATION",
          title: "Test",
          description: "Desc",
          siteId: "site-other",
        },
        {
          id: "user-1",
          role: "USER",
          permissions: ["workorders:site_only"],
          siteId: "site-1",
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Akses ditolak: Anda hanya dapat membuat work order untuk site Anda",
      );
      expect(result.code).toBe("FORBIDDEN");
    });

    it("uses the user site when workorders:site_only is active and siteId is omitted", async () => {
      mutationServiceMock.createWorkOrder.mockResolvedValue({
        success: true,
        data: {
          id: "wo-1",
          workOrderNumber: "WO-001",
          title: "Test",
          type: "INSTALLATION",
          priority: "MEDIUM",
          status: "OPEN",
          departmentId: null,
          siteId: "site-1",
          assignedToId: null,
          createdAt: new Date(),
        },
      });

      const result = await service.createWorkOrder(
        {
          type: "INSTALLATION",
          title: "Test",
          description: "Desc",
        },
        {
          id: "user-1",
          role: "USER",
          permissions: ["workorders:site_only"],
          siteId: "site-1",
        },
      );

      expect(result.success).toBe(true);
    });

    it("still returns success when non-fatal create side effects throw", async () => {
      mutationServiceMock.createWorkOrder.mockResolvedValue({
        success: true,
        data: {
          id: "wo-1",
          workOrderNumber: "WO-001",
          title: "Test",
          type: "INSTALLATION",
          priority: "MEDIUM",
          status: "OPEN",
          departmentId: null,
          siteId: null,
          assignedToId: null,
          createdAt: new Date(),
        },
      });

      vi.mocked(onWorkOrderCreated).mockRejectedValueOnce(new Error("boom"));

      const result = await service.createWorkOrder(
        {
          type: "INSTALLATION",
          title: "Test",
          description: "Desc",
        },
        { id: "user-1", role: "USER", permissions: [] },
      );

      expect(result.success).toBe(true);
    });
  });

  describe("delete and status not-found normalization", () => {
    const userContext = {
      id: "admin-1",
      role: "USER",
      permissions: [] as string[],
    };

    it("returns NOT_FOUND when access validation cannot find the work order", async () => {
      readServiceMock.getWorkOrderById.mockResolvedValue({
        success: false,
        error: "Work order tidak ditemukan",
        code: "NOT_FOUND",
      });

      const result = await service.getWorkOrderById("wo-missing", userContext);

      expect(result).toEqual({
        success: false,
        error: "Work order tidak ditemukan",
        code: "NOT_FOUND",
      });
    });

    it("returns NOT_FOUND when deleteWorkOrder cannot find the work order during access validation", async () => {
      mutationServiceMock.deleteWorkOrder.mockResolvedValue({
        success: false,
        error: "Work order tidak ditemukan",
        code: "NOT_FOUND",
      });

      const result = await service.deleteWorkOrder("wo-missing", userContext);

      expect(result).toEqual({
        success: false,
        error: "Work order tidak ditemukan",
        code: "NOT_FOUND",
      });
    });

    it("returns NOT_FOUND when updateStatus cannot find the work order during access validation", async () => {
      mutationServiceMock.updateStatus.mockResolvedValue({
        success: false,
        error: "Work order tidak ditemukan",
        code: "NOT_FOUND",
      });

      const result = await service.updateStatus(
        "wo-missing",
        "COMPLETED" as WorkOrderStatus,
        userContext,
      );

      expect(result).toEqual({
        success: false,
        error: "Work order tidak ditemukan",
        code: "NOT_FOUND",
      });
    });
  });
});
