import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkOrderService } from "@/modules/work-order/services/WorkOrderService";
import type { WorkOrderActivityService } from "@/modules/work-order/services/WorkOrderActivityService";
import type { WorkOrderMaterialService } from "@/modules/work-order/services/WorkOrderMaterialService";
import type { WorkOrderMutationService } from "@/modules/work-order/services/WorkOrderMutationService";
import type { WorkOrderReadService } from "@/modules/work-order/services/WorkOrderReadService";
import type {
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  UserContext,
  ServiceResult,
} from "@/modules/work-order/services/work-order-service.contracts";
import type { WorkOrderWithRelations } from "@/modules/work-order/domain/ports/IWorkOrderRepository";
import type { WorkOrderStatus } from "@/modules/work-order/types/work-order.enums";

// Mock factory
vi.mock("@/modules/work-order/services/work-order-service.factory", () => ({
  buildWorkOrderServiceDependencies: vi.fn(),
  initializeWorkOrderTemplateRepository: vi.fn(),
}));

describe("WorkOrderService", () => {
  let workOrderService: WorkOrderService;
  let mockActivityService: WorkOrderActivityService;
  let mockMaterialService: WorkOrderMaterialService;
  let mockMutationService: WorkOrderMutationService;
  let mockReadService: WorkOrderReadService;
  let mockRepository: Record<string, unknown>;

  const mockUserContext: UserContext = {
    id: "user-1",
    siteId: "site-1",
  };

  const mockWorkOrder: WorkOrderWithRelations = {
    id: "wo-1",
    workOrderNumber: "WO-2026-001",
    title: "Test Work Order",
    description: "Test Description",
    type: "MAINTENANCE",
    status: "PENDING",
    priority: "NORMAL",
    tenantId: "tenant-1",
    rejectionReason: null,
    approvedAt: null,
    approvedById: null,
    slaId: null,
    warrantyOwnerId: null,
    isWarranty: false,
    pelangganId: null,
    siteId: null,
    departmentId: null,
    assignedToId: null,
    assignedMitraId: null,
    locationAddress: null,
    locationLat: null,
    locationLng: null,
    contactName: null,
    contactPhone: null,
    scheduledDate: null,
    scheduledTimeStart: null,
    scheduledTimeEnd: null,
    estimatedHours: null,
    actualHours: null,
    estimatedCost: null,
    actualCost: null,
    requiredMaterials: null,
    usedMaterials: null,
    returnedMaterials: null,
    templateId: null,
    requestedAt: null,
    heldAt: null,
    holdReason: null,
    resumedAt: null,
    warrantySla: null,
    internalNotes: null,
    resolutionNotes: null,
    customerFeedback: null,
    rating: null,
    disconnectionReason: null,
    ticketId: null,
    isInternal: false,
    requestedById: null,
    createdById: "user-1",
    startedAt: null,
    completedAt: null,
    verifiedAt: null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockServiceResult: ServiceResult<WorkOrderWithRelations> = {
    success: true,
    data: mockWorkOrder,
  };

  beforeEach(async () => {
    // Mock repository
    mockRepository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    // Mock services
    mockActivityService = {
      addComment: vi.fn(),
      addTask: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
    } as unknown as WorkOrderActivityService;

    mockMaterialService = {
      addMaterial: vi.fn(),
      addMobileMaterials: vi.fn(),
      returnMobileMaterials: vi.fn(),
    } as unknown as WorkOrderMaterialService;

    mockMutationService = {
      createWorkOrder: vi.fn(),
      updateWorkOrder: vi.fn(),
      updateStatus: vi.fn(),
      assignWorkOrder: vi.fn(),
      approveRequest: vi.fn(),
      rejectRequest: vi.fn(),
      deleteWorkOrder: vi.fn(),
    } as unknown as WorkOrderMutationService;

    mockReadService = {
      getWorkOrders: vi.fn(),
      getWorkOrderRequests: vi.fn(),
      getStatistics: vi.fn(),
      getRecentWorkOrders: vi.fn(),
      getWorkOrderById: vi.fn(),
    } as unknown as WorkOrderReadService;

    // Mock factory to return our mocked services
    const { buildWorkOrderServiceDependencies } =
      await import("@/modules/work-order/services/work-order-service.factory");
    vi.mocked(buildWorkOrderServiceDependencies).mockReturnValue({
      repository: mockRepository as never,
      activityService: mockActivityService,
      materialService: mockMaterialService,
      mutationService: mockMutationService,
      readService: mockReadService,
    });

    workOrderService = new WorkOrderService();
  });

  describe("Read Operations", () => {
    it("harus delegate getWorkOrders ke readService", async () => {
      const options = { page: 1, limit: 10 };
      const mockResult = {
        success: true,
        data: {
          workOrders: [mockWorkOrder],
          total: 1,
          page: 1,
          totalPages: 1,
          summary: { total: 1, open: 1, closed: 0 },
        },
      };

      vi.mocked(mockReadService.getWorkOrders).mockResolvedValue(
        mockResult as never,
      );

      const result = await workOrderService.getWorkOrders(options);

      expect(result).toEqual(mockResult);
      expect(mockReadService.getWorkOrders).toHaveBeenCalledWith(options);
    });

    it("harus delegate getWorkOrderRequests ke readService", async () => {
      const filters = { departmentId: "dept-1", search: "test" };
      const mockResult = {
        success: true,
        data: {
          workOrders: [] as WorkOrderWithRelations[],
          total: 0,
          page: 1,
          totalPages: 0,
        },
      };

      vi.mocked(mockReadService.getWorkOrderRequests).mockResolvedValue(
        mockResult as never,
      );

      const result = await workOrderService.getWorkOrderRequests(
        filters,
        1,
        20,
      );

      expect(result).toEqual(mockResult);
      expect(mockReadService.getWorkOrderRequests).toHaveBeenCalledWith(
        filters,
        1,
        20,
      );
    });

    it("harus delegate getStatistics ke readService", async () => {
      const filters = { departmentId: "dept-1" };
      const mockStats = {
        success: true,
        data: { total: 10, open: 5, closed: 5 },
      };

      vi.mocked(mockReadService.getStatistics).mockResolvedValue(
        mockStats as never,
      );

      const result = await workOrderService.getStatistics(filters);

      expect(result).toEqual(mockStats);
      expect(mockReadService.getStatistics).toHaveBeenCalledWith(filters);
    });

    it("harus delegate getRecentWorkOrders ke readService", async () => {
      const filters = { departmentId: "dept-1" };
      const mockResult = {
        success: true,
        data: [mockWorkOrder],
      };

      vi.mocked(mockReadService.getRecentWorkOrders).mockResolvedValue(
        mockResult as never,
      );

      const result = await workOrderService.getRecentWorkOrders(5, filters);

      expect(result).toEqual(mockResult);
      expect(mockReadService.getRecentWorkOrders).toHaveBeenCalledWith(
        5,
        filters,
      );
    });

    it("harus delegate getWorkOrderById ke readService", async () => {
      vi.mocked(mockReadService.getWorkOrderById).mockResolvedValue(
        mockServiceResult,
      );

      const result = await workOrderService.getWorkOrderById(
        "wo-1",
        mockUserContext,
      );

      expect(result).toEqual(mockServiceResult);
      expect(mockReadService.getWorkOrderById).toHaveBeenCalledWith(
        "wo-1",
        mockUserContext,
      );
    });
  });

  describe("Mutation Operations", () => {
    it("harus delegate createWorkOrder ke mutationService", async () => {
      const input: CreateWorkOrderInput = {
        type: "MAINTENANCE",
        title: "New Work Order",
        description: "Description",
        priority: "HIGH",
      };

      vi.mocked(mockMutationService.createWorkOrder).mockResolvedValue(
        mockServiceResult,
      );

      const result = await workOrderService.createWorkOrder(
        input,
        mockUserContext,
      );

      expect(result).toEqual(mockServiceResult);
      expect(mockMutationService.createWorkOrder).toHaveBeenCalledWith(
        input,
        mockUserContext,
      );
    });

    it("harus delegate updateWorkOrder ke mutationService", async () => {
      const input: UpdateWorkOrderInput = {
        title: "Updated Title",
      };

      vi.mocked(mockMutationService.updateWorkOrder).mockResolvedValue(
        mockServiceResult,
      );

      const result = await workOrderService.updateWorkOrder(
        "wo-1",
        input,
        mockUserContext,
      );

      expect(result).toEqual(mockServiceResult);
      expect(mockMutationService.updateWorkOrder).toHaveBeenCalledWith(
        "wo-1",
        input,
        mockUserContext,
      );
    });

    it("harus delegate updateStatus ke mutationService", async () => {
      const status: WorkOrderStatus = "in_progress" as WorkOrderStatus;

      vi.mocked(mockMutationService.updateStatus).mockResolvedValue(
        mockServiceResult,
      );

      const result = await workOrderService.updateStatus(
        "wo-1",
        status,
        mockUserContext,
        "Notes",
      );

      expect(result).toEqual(mockServiceResult);
      expect(mockMutationService.updateStatus).toHaveBeenCalledWith(
        "wo-1",
        status,
        mockUserContext,
        "Notes",
      );
    });

    it("harus delegate assignWorkOrder ke mutationService", async () => {
      vi.mocked(mockMutationService.assignWorkOrder).mockResolvedValue(
        mockServiceResult,
      );

      const result = await workOrderService.assignWorkOrder(
        "wo-1",
        "emp-1",
        mockUserContext,
        "technician",
      );

      expect(result).toEqual(mockServiceResult);
      expect(mockMutationService.assignWorkOrder).toHaveBeenCalledWith(
        "wo-1",
        "emp-1",
        mockUserContext,
        "technician",
      );
    });

    it("harus delegate approveRequest ke mutationService", async () => {
      vi.mocked(mockMutationService.approveRequest).mockResolvedValue(
        mockServiceResult,
      );

      const result = await workOrderService.approveRequest(
        "wo-1",
        mockUserContext,
      );

      expect(result).toEqual(mockServiceResult);
      expect(mockMutationService.approveRequest).toHaveBeenCalledWith(
        "wo-1",
        mockUserContext,
      );
    });

    it("harus delegate rejectRequest ke mutationService", async () => {
      vi.mocked(mockMutationService.rejectRequest).mockResolvedValue(
        mockServiceResult,
      );

      const result = await workOrderService.rejectRequest(
        "wo-1",
        mockUserContext,
        "Not approved",
      );

      expect(result).toEqual(mockServiceResult);
      expect(mockMutationService.rejectRequest).toHaveBeenCalledWith(
        "wo-1",
        mockUserContext,
        "Not approved",
      );
    });

    it("harus delegate deleteWorkOrder ke mutationService", async () => {
      const mockDeleteResult: ServiceResult<void> = {
        success: true,
        data: undefined,
      };

      vi.mocked(mockMutationService.deleteWorkOrder).mockResolvedValue(
        mockDeleteResult,
      );

      const result = await workOrderService.deleteWorkOrder(
        "wo-1",
        mockUserContext,
      );

      expect(result).toEqual(mockDeleteResult);
      expect(mockMutationService.deleteWorkOrder).toHaveBeenCalledWith(
        "wo-1",
        mockUserContext,
      );
    });
  });

  describe("Material Operations", () => {
    it("harus delegate addMaterial ke materialService", async () => {
      const mockResult: ServiceResult<Record<string, unknown>> = {
        success: true,
        data: {},
      };

      vi.mocked(mockMaterialService.addMaterial).mockResolvedValue(
        mockResult as never,
      );

      const result = await workOrderService.addMaterial(
        "wo-1",
        "item-1",
        5,
        mockUserContext,
        "notes",
        "gudang-1",
      );

      expect(result).toEqual(mockResult);
      expect(mockMaterialService.addMaterial).toHaveBeenCalledWith(
        "wo-1",
        "item-1",
        5,
        mockUserContext,
        "notes",
        "gudang-1",
      );
    });

    it("harus delegate addMobileMaterials ke materialService", async () => {
      const items: Array<{
        barangId: string;
        gudangId: string;
        jumlah: number;
      }> = [{ barangId: "item-1", gudangId: "gudang-1", jumlah: 5 }];
      const mockResult: ServiceResult<{ items: unknown[] }> = {
        success: true,
        data: { items: [] },
      };

      vi.mocked(mockMaterialService.addMobileMaterials).mockResolvedValue(
        mockResult as never,
      );

      const result = await workOrderService.addMobileMaterials(
        "wo-1",
        items as never,
        mockUserContext,
        "Tech 1",
      );

      expect(result).toEqual(mockResult);
      expect(mockMaterialService.addMobileMaterials).toHaveBeenCalledWith(
        "wo-1",
        items,
        mockUserContext,
        "Tech 1",
      );
    });

    it("harus delegate returnMobileMaterials ke materialService", async () => {
      const items: Array<{
        barangId: string;
        gudangId: string;
        jumlah: number;
      }> = [{ barangId: "item-1", gudangId: "gudang-1", jumlah: 2 }];
      const mockResult: ServiceResult<{ items: unknown[] }> = {
        success: true,
        data: { items: [] },
      };

      vi.mocked(mockMaterialService.returnMobileMaterials).mockResolvedValue(
        mockResult as never,
      );

      const result = await workOrderService.returnMobileMaterials(
        "wo-1",
        items as never,
        mockUserContext,
        "Tech 1",
      );

      expect(result).toEqual(mockResult);
      expect(mockMaterialService.returnMobileMaterials).toHaveBeenCalledWith(
        "wo-1",
        items,
        mockUserContext,
        "Tech 1",
      );
    });
  });

  describe("Activity Operations", () => {
    it("harus delegate addComment ke activityService", async () => {
      const mockResult = { success: true, data: {} };

      vi.mocked(mockActivityService.addComment).mockResolvedValue(mockResult);

      const result = await workOrderService.addComment(
        "wo-1",
        "Test comment",
        mockUserContext,
      );

      expect(result).toEqual(mockResult);
      expect(mockActivityService.addComment).toHaveBeenCalledWith(
        "wo-1",
        "Test comment",
        mockUserContext,
      );
    });

    it("harus delegate addTask ke activityService", async () => {
      const taskData = { title: "Task 1", description: "Do something" };
      const mockResult = { success: true, data: {} };

      vi.mocked(mockActivityService.addTask).mockResolvedValue(mockResult);

      const result = await workOrderService.addTask(
        "wo-1",
        taskData,
        mockUserContext,
      );

      expect(result).toEqual(mockResult);
      expect(mockActivityService.addTask).toHaveBeenCalledWith(
        "wo-1",
        taskData,
        mockUserContext,
      );
    });

    it("harus delegate addAttachment ke activityService", async () => {
      const attachmentData = {
        fileName: "file.pdf",
        filePath: "/path/to/file.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        caption: "Document",
      };
      const mockResult = { success: true, data: {} };

      vi.mocked(mockActivityService.addAttachment).mockResolvedValue(
        mockResult,
      );

      const result = await workOrderService.addAttachment(
        "wo-1",
        attachmentData,
        mockUserContext,
      );

      expect(result).toEqual(mockResult);
      expect(mockActivityService.addAttachment).toHaveBeenCalledWith(
        "wo-1",
        attachmentData,
        mockUserContext,
      );
    });

    it("harus delegate deleteAttachment ke activityService", async () => {
      const mockResult: ServiceResult<void> = {
        success: true,
        data: undefined,
      };

      vi.mocked(mockActivityService.deleteAttachment).mockResolvedValue(
        mockResult,
      );

      const result = await workOrderService.deleteAttachment(
        "wo-1",
        "att-1",
        mockUserContext,
      );

      expect(result).toEqual(mockResult);
      expect(mockActivityService.deleteAttachment).toHaveBeenCalledWith(
        "wo-1",
        "att-1",
        mockUserContext,
      );
    });
  });
});
