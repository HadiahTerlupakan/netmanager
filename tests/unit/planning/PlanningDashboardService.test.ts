import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanningDashboardService } from "@/modules/planning/services/PlanningDashboardService";
import type { IPlanningRepository } from "@/modules/planning/domain/ports/IPlanningRepository";
import {
  PlanningEntity,
  type PlanningStatus,
} from "@/modules/planning/domain/entities/PlanningEntity";

describe("PlanningDashboardService", () => {
  let service: PlanningDashboardService;
  let mockPlanningRepo: Partial<IPlanningRepository>;

  beforeEach(() => {
    mockPlanningRepo = {
      findAll: vi.fn(),
    };

    service = new PlanningDashboardService(
      mockPlanningRepo as IPlanningRepository,
    );
  });

  describe("getDashboard", () => {
    it("should calculate status distribution correctly", async () => {
      const mockPlannings = [
        createMockPlanning("1", "BACKLOG"),
        createMockPlanning("2", "BACKLOG"),
        createMockPlanning("3", "PENDING_APPROVAL"),
        createMockPlanning("4", "APPROVED"),
        createMockPlanning("5", "IN_PROGRESS"),
        createMockPlanning("6", "COMPLETED"),
      ];

      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: mockPlannings, total: 6 });

      const result = await service.getDashboard("tenant-1");

      expect(result.statusDistribution).toHaveLength(8); // 8 statuses

      const backlogStat = result.statusDistribution.find(
        (s) => s.status === "BACKLOG",
      );
      expect(backlogStat?.count).toBe(2);
      expect(backlogStat?.percentage).toBeCloseTo(33.33, 1);

      const pendingStat = result.statusDistribution.find(
        (s) => s.status === "PENDING_APPROVAL",
      );
      expect(pendingStat?.count).toBe(1);
      expect(pendingStat?.percentage).toBeCloseTo(16.67, 1);
    });

    it("should calculate budget summary correctly", async () => {
      const mockPlannings = [
        createMockPlanningWithBudget("1", 1000000, 900000), // Under budget
        createMockPlanningWithBudget("2", 2000000, 2200000), // Over budget
        createMockPlanningWithBudget("3", 1500000, 1500000), // On budget
        createMockPlanningWithBudget("4", 500000, null), // No actual budget
      ];

      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: mockPlannings, total: 4 });

      const result = await service.getDashboard("tenant-1");

      expect(result.budgetSummary.totalEstimatedBudget).toBe(5000000);
      expect(result.budgetSummary.totalActualBudget).toBe(4600000);
      expect(result.budgetSummary.variance).toBe(-400000);
      expect(result.budgetSummary.variancePercentage).toBe(-8);
      expect(result.budgetSummary.overBudgetCount).toBe(1);
      expect(result.budgetSummary.underBudgetCount).toBe(1);
    });

    it("should calculate timeline stats correctly", async () => {
      const mockPlannings = [
        // Completed on time
        createMockPlanningWithTimeline(
          "1",
          "COMPLETED",
          new Date("2026-01-01"),
          new Date("2026-06-30"),
          new Date("2026-06-25"),
        ),
        // Completed late
        createMockPlanningWithTimeline(
          "2",
          "COMPLETED",
          new Date("2026-01-01"),
          new Date("2026-06-30"),
          new Date("2026-07-15"),
        ),
        // In progress on track
        createMockPlanningWithTimeline(
          "3",
          "IN_PROGRESS",
          new Date("2026-07-01"),
          new Date("2026-12-31"),
          null,
        ),
        // In progress overdue
        createMockPlanningWithTimeline(
          "4",
          "IN_PROGRESS",
          new Date("2026-01-01"),
          new Date("2026-07-31"),
          null,
        ),
      ];

      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: mockPlannings, total: 4 });

      const result = await service.getDashboard("tenant-1");

      expect(result.timelineStats.totalPlanning).toBe(4);
      expect(result.timelineStats.completedOnTime).toBe(1);
      expect(result.timelineStats.completedLate).toBe(1);
      expect(result.timelineStats.inProgressOnTrack).toBe(1);
      expect(result.timelineStats.inProgressOverdue).toBe(1);
      expect(result.timelineStats.averageCompletionDays).toBeGreaterThan(0);
    });

    it("should return recent plannings sorted by updated date", async () => {
      const mockPlannings = [
        createMockPlanningWithDate("1", new Date("2026-08-01")),
        createMockPlanningWithDate("2", new Date("2026-08-05")),
        createMockPlanningWithDate("3", new Date("2026-08-03")),
        createMockPlanningWithDate("4", new Date("2026-08-08")),
      ];

      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: mockPlannings, total: 4 });

      const result = await service.getDashboard("tenant-1");

      expect(result.recentPlanning).toHaveLength(4);

      // Should be sorted by updatedAt descending
      expect(result.recentPlanning[0].id).toBe("4"); // 2026-08-08
      expect(result.recentPlanning[1].id).toBe("2"); // 2026-08-05
      expect(result.recentPlanning[2].id).toBe("3"); // 2026-08-03
      expect(result.recentPlanning[3].id).toBe("1"); // 2026-08-01
    });

    it("should limit recent plannings to 10 items", async () => {
      const mockPlannings = Array.from({ length: 15 }, (_, i) =>
        createMockPlanningWithDate(
          `${i + 1}`,
          new Date(`2026-08-${String(i + 1).padStart(2, "0")}`),
        ),
      );

      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: mockPlannings, total: 15 });

      const result = await service.getDashboard("tenant-1");

      expect(result.recentPlanning).toHaveLength(10);
    });

    it("should filter by date range when provided", async () => {
      const mockPlannings = [
        createMockPlanningWithDate("1", new Date("2026-07-01")),
        createMockPlanningWithDate("2", new Date("2026-08-01")),
        createMockPlanningWithDate("3", new Date("2026-09-01")),
      ];

      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: mockPlannings, total: 3 });

      const result = await service.getDashboard("tenant-1", {
        startDate: new Date("2026-08-01"),
        endDate: new Date("2026-08-31"),
      });

      // Only planning 2 should be included
      expect(result.recentPlanning).toHaveLength(1);
      expect(result.recentPlanning[0].id).toBe("2");
    });

    it("should handle empty dataset", async () => {
      mockPlanningRepo.findAll = vi
        .fn()
        .mockResolvedValue({ items: [], total: 0 });

      const result = await service.getDashboard("tenant-1");

      expect(result.statusDistribution).toHaveLength(8);
      expect(result.budgetSummary.totalEstimatedBudget).toBe(0);
      expect(result.budgetSummary.totalActualBudget).toBe(0);
      expect(result.timelineStats.totalPlanning).toBe(0);
      expect(result.recentPlanning).toHaveLength(0);
    });
  });
});

/**
 * Helper functions to create mock PlanningEntity
 */
function createMockPlanning(
  id: string,
  status: PlanningStatus,
): PlanningEntity {
  return new PlanningEntity({
    id,
    tenantId: "tenant-1",
    type: "OSP",
    title: `Planning ${id}`,
    description: null,
    area: "Test Area",
    coordinates: null,
    estimatedUnits: 100,
    estimatedBudget: null,
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
    progressPercentage: 0,
    startDate: null,
    targetCompletionDate: null,
    actualCompletionDate: null,
    createdById: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    deletedAt: null,
  });
}

function createMockPlanningWithBudget(
  id: string,
  estimated: number | null,
  actual: number | null,
): PlanningEntity {
  const entity = createMockPlanning(id, "IN_PROGRESS");
  return new PlanningEntity({
    ...entity,
    estimatedBudget: estimated,
    actualBudget: actual,
  });
}

function createMockPlanningWithTimeline(
  id: string,
  status: PlanningStatus,
  startDate: Date | null,
  targetDate: Date | null,
  actualDate: Date | null,
): PlanningEntity {
  const entity = createMockPlanning(id, status);
  return new PlanningEntity({
    ...entity,
    startDate,
    targetCompletionDate: targetDate,
    actualCompletionDate: actualDate,
  });
}

function createMockPlanningWithDate(
  id: string,
  updatedAt: Date,
): PlanningEntity {
  const entity = createMockPlanning(id, "BACKLOG");
  return new PlanningEntity({
    ...entity,
    createdAt: updatedAt, // Use same date for createdAt
    updatedAt,
  });
}
