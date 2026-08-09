import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanningKanbanService } from "@/modules/planning/services/PlanningKanbanService";
import type { IPlanningRepository } from "@/modules/planning/domain/ports/IPlanningRepository";
import {
  PlanningEntity,
  type PlanningStatus,
} from "@/modules/planning/domain/entities/PlanningEntity";

describe("PlanningKanbanService", () => {
  let service: PlanningKanbanService;
  let mockPlanningRepo: Partial<IPlanningRepository>;

  beforeEach(() => {
    mockPlanningRepo = {
      findAll: vi.fn(),
    };

    service = new PlanningKanbanService(
      mockPlanningRepo as IPlanningRepository,
    );
  });

  describe("getKanbanBoard", () => {
    it("should group plannings by status into 5 columns", async () => {
      const mockPlannings = [
        createMockPlanning("1", "BACKLOG", "Planning 1"),
        createMockPlanning("2", "BACKLOG", "Planning 2"),
        createMockPlanning("3", "PENDING_APPROVAL", "Planning 3"),
        createMockPlanning("4", "APPROVED", "Planning 4"),
        createMockPlanning("5", "IN_PROGRESS", "Planning 5"),
        createMockPlanning("6", "COMPLETED", "Planning 6"),
      ];

      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: mockPlannings, total: 6 });

      const result = await service.getKanbanBoard("tenant-1");

      expect(result.columns).toHaveLength(5);
      expect(result.totalCards).toBe(6);

      const backlogColumn = result.columns.find((c) => c.status === "BACKLOG");
      expect(backlogColumn?.count).toBe(2);
      expect(backlogColumn?.cards).toHaveLength(2);

      const pendingColumn = result.columns.find(
        (c) => c.status === "PENDING_APPROVAL",
      );
      expect(pendingColumn?.count).toBe(1);

      const approvedColumn = result.columns.find(
        (c) => c.status === "APPROVED",
      );
      expect(approvedColumn?.count).toBe(1);

      const inProgressColumn = result.columns.find(
        (c) => c.status === "IN_PROGRESS",
      );
      expect(inProgressColumn?.count).toBe(1);

      const completedColumn = result.columns.find(
        (c) => c.status === "COMPLETED",
      );
      expect(completedColumn?.count).toBe(1);
    });

    it("should map APPROVED_LEVEL1 to PENDING_APPROVAL column", async () => {
      const mockPlannings = [
        createMockPlanning("1", "PENDING_APPROVAL", "Planning 1"),
        createMockPlanning("2", "APPROVED_LEVEL1", "Planning 2"),
      ];

      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: mockPlannings, total: 2 });

      const result = await service.getKanbanBoard("tenant-1");

      const pendingColumn = result.columns.find(
        (c) => c.status === "PENDING_APPROVAL",
      );
      expect(pendingColumn?.count).toBe(2);
      expect(pendingColumn?.cards).toHaveLength(2);
    });

    it("should exclude REJECTED and CANCELLED from kanban view", async () => {
      const mockPlannings = [
        createMockPlanning("1", "BACKLOG", "Planning 1"),
        createMockPlanning("2", "REJECTED", "Planning 2"),
        createMockPlanning("3", "CANCELLED", "Planning 3"),
      ];

      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: mockPlannings, total: 3 });

      const result = await service.getKanbanBoard("tenant-1");

      expect(result.totalCards).toBe(1);
      const backlogColumn = result.columns.find((c) => c.status === "BACKLOG");
      expect(backlogColumn?.count).toBe(1);
    });

    it("should filter by search term (title and area)", async () => {
      const mockPlannings = [
        createMockPlanning("1", "BACKLOG", "OSP Area Jakarta", "Jakarta"),
        createMockPlanning("2", "BACKLOG", "OSP Area Bandung", "Bandung"),
        createMockPlanning("3", "APPROVED", "OSP Area Surabaya", "Surabaya"),
      ];

      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: mockPlannings, total: 3 });

      const result = await service.getKanbanBoard("tenant-1", {
        search: "jakarta",
      });

      expect(result.totalCards).toBe(1);
      const backlogColumn = result.columns.find((c) => c.status === "BACKLOG");
      expect(backlogColumn?.cards[0].title).toBe("OSP Area Jakarta");
    });

    it("should return empty columns when no plannings exist", async () => {
      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: [], total: 0 });

      const result = await service.getKanbanBoard("tenant-1");

      expect(result.columns).toHaveLength(5);
      expect(result.totalCards).toBe(0);
      result.columns.forEach((column) => {
        expect(column.count).toBe(0);
        expect(column.cards).toHaveLength(0);
      });
    });

    it("should include correct card data", async () => {
      const mockPlanning = createMockPlanning(
        "1",
        "IN_PROGRESS",
        "Test Plan",
        "Test Area",
        1000000,
        45,
        new Date("2026-12-31"),
      );

      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: [mockPlanning], total: 1 });

      const result = await service.getKanbanBoard("tenant-1");

      const inProgressColumn = result.columns.find(
        (c) => c.status === "IN_PROGRESS",
      );
      const card = inProgressColumn?.cards[0];

      expect(card?.id).toBe("1");
      expect(card?.title).toBe("Test Plan");
      expect(card?.estimatedBudget).toBe(1000000);
      expect(card?.progressPercentage).toBe(45);
      expect(card?.targetCompletionDate).toBe("2026-12-31T00:00:00.000Z");
    });
  });
});

/**
 * Helper function to create mock PlanningEntity
 */
function createMockPlanning(
  id: string,
  status: PlanningStatus,
  title: string,
  area: string = "Test Area",
  estimatedBudget: number | null = null,
  progressPercentage: number = 0,
  targetCompletionDate: Date | null = null,
): PlanningEntity {
  return new PlanningEntity({
    id,
    tenantId: "tenant-1",
    type: "OSP",
    title,
    description: null,
    area,
    coordinates: null,
    estimatedUnits: 100,
    estimatedBudget,
    actualBudget: null,
    status,
    approvalLevel: 1,
    currentApprovalStep: 0,
    submittedAt: null,
    submittedById: null,
    approvedAt: null,
    approvedById: null,
    approvedLevel1At: null,
    approvedLevel1ById: null,
    rejectedAt: null,
    rejectedById: null,
    approvalNotes: null,
    progressPercentage,
    startDate: null,
    targetCompletionDate,
    actualCompletionDate: null,
    createdById: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    deletedAt: null,
  });
}
