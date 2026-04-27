import { describe, expect, it, vi } from "vitest";
import { CanvasingService } from "@/modules/marketing/services/CanvasingService";
import type { Canvasing } from "@prisma/client";
import type {
  ICanvasingRepository,
  CanvasingListFilters,
  CanvasingListSummary,
} from "@/modules/marketing/repositories/ICanvasingRepository";
import type { IWorkOrderRepository } from "@/modules/work-order/repositories/IWorkOrderRepository";

function createSummary(): CanvasingListSummary {
  return {
    total: 5,
    pending: 2,
    approved: 2,
    rejected: 1,
    pendingClaims: 1,
  };
}

function createRepositoryMock(): ICanvasingRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdWithSales: vi.fn(),
    findAll: vi.fn(),
    getCompletionSummary: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function createWorkOrderRepositoryMock(): IWorkOrderRepository {
  return {
    findById: vi.fn(),
    findMany: vi.fn(),
    findByCustomerId: vi.fn(),
    findByAssignedTechnician: vi.fn(),
    findByCustomerName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    assignTechnicians: vi.fn(),
    unassignTechnician: vi.fn(),
    addUpdate: vi.fn(),
    addComment: vi.fn(),
    addAttachment: vi.fn(),
    addMaterial: vi.fn(),
    getStats: vi.fn(),
    generateWorkOrderNumber: vi.fn(),
    findOverdue: vi.fn(),
    findNearestAvailableTechnicians: vi.fn(),
    findWithFilters: vi.fn(),
    getDashboardSummary: vi.fn(),
    getTechnicianWorkload: vi.fn(),
  } as unknown as IWorkOrderRepository;
}

describe("CanvasingService", () => {
  it("meneruskan filter search ke repository dan mengembalikan summary", async () => {
    const repository = createRepositoryMock();
    const workOrderRepository = createWorkOrderRepositoryMock();
    const service = new CanvasingService(repository, workOrderRepository);
    const filters: CanvasingListFilters = {
      status: "PENDING",
      salesId: "sales-1",
      siteId: "site-1",
      search: "Fiber",
    };
    const expectedResult: {
      data: Canvasing[];
      total: number;
      summary: CanvasingListSummary;
    } = {
      data: [],
      total: 0,
      summary: createSummary(),
    };

    vi.mocked(repository.findAll).mockResolvedValue(expectedResult);

    const result = await service.getAllRequests(filters, 2, 20);

    expect(repository.findAll).toHaveBeenCalledWith(filters, 2, 20);
    expect(result.summary).toEqual(expectedResult.summary);
  });

  it("menolak reject request ketika status bukan PENDING", async () => {
    const repository = createRepositoryMock();
    const workOrderRepository = createWorkOrderRepositoryMock();
    const service = new CanvasingService(repository, workOrderRepository);

    vi.mocked(repository.findById).mockResolvedValue({
      id: "cv-1",
      status: "APPROVED",
    } as Canvasing);

    await expect(service.rejectRequest("cv-1")).rejects.toThrow(
      "Hanya request PENDING yang bisa ditolak",
    );
    expect(repository.update).not.toHaveBeenCalled();
  });
});
