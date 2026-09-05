import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { PlanningMilestoneService } from "@/modules/planning/services/PlanningMilestoneService";
import type { IPlanningRepository } from "@/modules/planning/domain/ports/IPlanningRepository";
import type { IPlanningMilestoneRepository } from "@/modules/planning/domain/ports/IPlanningMilestoneRepository";
import type { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import { PlanningEntity } from "@/modules/planning/domain/entities/PlanningEntity";
import { PlanningMilestoneEntity } from "@/modules/planning/domain/entities/PlanningMilestoneEntity";
import type { MilestoneStatus } from "@/modules/planning/domain/entities/PlanningMilestoneEntity";
import {
  PlanningInvalidStateError,
  PlanningNotFoundError,
} from "@/modules/planning/errors/planning-errors";
import { createFakeUnitOfWork } from "../helpers/fakeUnitOfWork";

const now = new Date("2026-09-02T00:00:00.000Z");

function planning(tenantId = "tenant-1") {
  return new PlanningEntity({
    id: "plan-1",
    tenantId,
    type: "OSP",
    title: "Ekspansi FO Cipinang",
    description: null,
    area: "Cipinang",
    coordinates: null,
    estimatedUnits: 100,
    estimatedBudget: 5_000_000,
    actualBudget: null,
    status: "IN_PROGRESS",
    approvalLevel: 1,
    currentApprovalStep: 1,
    submittedAt: now,
    submittedById: "user-1",
    approvedAt: now,
    approvedById: "user-2",
    approvedLevel1At: null,
    approvedLevel1ById: null,
    rejectedAt: null,
    rejectedById: null,
    approvalNotes: null,
    progressPercentage: 0,
    startDate: now,
    targetCompletionDate: null,
    actualCompletionDate: null,
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

function milestone(
  overrides: Partial<{
    id: string;
    planningId: string;
    name: string;
    status: MilestoneStatus;
  }> = {},
) {
  return new PlanningMilestoneEntity({
    id: "ms-1",
    planningId: "plan-1",
    tenantId: "tenant-1",
    name: "Survey Selesai",
    description: null,
    targetDate: now,
    actualDate: null,
    status: "IN_PROGRESS",
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe("PlanningMilestoneService", () => {
  let service: PlanningMilestoneService;
  let mockPlanningRepo: Mocked<IPlanningRepository>;
  let mockMilestoneRepo: Mocked<IPlanningMilestoneRepository>;
  let mockAuditService: Mocked<PlanningAuditService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPlanningRepo = {
      findById: vi.fn().mockResolvedValue(planning()),
    } as unknown as Mocked<IPlanningRepository>;

    mockMilestoneRepo = {
      findById: vi.fn().mockResolvedValue(milestone()),
      findByPlanningId: vi.fn().mockResolvedValue([milestone()]),
      update: vi.fn().mockResolvedValue(milestone({ status: "COMPLETED" })),
    } as unknown as Mocked<IPlanningMilestoneRepository>;

    mockAuditService = {
      logChange: vi.fn(),
    } as unknown as Mocked<PlanningAuditService>;

    service = new PlanningMilestoneService(
      mockPlanningRepo,
      mockMilestoneRepo,
      mockAuditService,
      createFakeUnitOfWork(),
    );
  });

  // Lihat catatan tenant di PlanningItemService: ekstensi isolasi Prisma
  // sengaja melewatkan super admin.
  describe("cross-tenant guard", () => {
    beforeEach(() => {
      mockPlanningRepo.findById.mockResolvedValue(planning("tenant-lain"));
    });

    it("should reject reading milestones of a planning owned by another tenant", async () => {
      await expect(
        service.getByPlanningId("plan-1", "tenant-1"),
      ).rejects.toThrow(PlanningNotFoundError);

      expect(mockMilestoneRepo.findByPlanningId).not.toHaveBeenCalled();
    });

    it("should reject bulk update on a planning owned by another tenant", async () => {
      await expect(
        service.bulkUpdate(
          "plan-1",
          [{ id: "ms-1", status: "COMPLETED" }],
          "user-1",
          "tenant-1",
        ),
      ).rejects.toThrow(PlanningNotFoundError);

      expect(mockMilestoneRepo.update).not.toHaveBeenCalled();
    });
  });

  it("should reject a milestone that belongs to a different planning", async () => {
    mockMilestoneRepo.findById.mockResolvedValue(
      milestone({ id: "ms-9", planningId: "plan-lain" }),
    );

    await expect(
      service.bulkUpdate(
        "plan-1",
        [{ id: "ms-9", status: "COMPLETED" }],
        "user-1",
        "tenant-1",
      ),
    ).rejects.toThrow(PlanningNotFoundError);

    expect(mockMilestoneRepo.update).not.toHaveBeenCalled();
  });

  // Progres rencana dihitung dari jumlah milestone COMPLETED, jadi menandai
  // milestone yang masih BLOCKED sebagai selesai melonjakkan angkanya ke 100%
  // padahal hambatan yang memblokirnya tidak pernah diselesaikan.
  it("should reject completing a BLOCKED milestone directly", async () => {
    mockMilestoneRepo.findById.mockResolvedValue(
      milestone({ status: "BLOCKED" }),
    );

    await expect(
      service.bulkUpdate(
        "plan-1",
        [{ id: "ms-1", status: "COMPLETED" }],
        "user-1",
        "tenant-1",
      ),
    ).rejects.toThrow(PlanningInvalidStateError);

    expect(mockMilestoneRepo.update).not.toHaveBeenCalled();
  });

  it("should allow moving a BLOCKED milestone to another status first", async () => {
    mockMilestoneRepo.findById.mockResolvedValue(
      milestone({ status: "BLOCKED" }),
    );

    await service.bulkUpdate(
      "plan-1",
      [{ id: "ms-1", status: "IN_PROGRESS" }],
      "user-1",
      "tenant-1",
    );

    expect(mockMilestoneRepo.update).toHaveBeenCalledWith(
      "ms-1",
      { status: "IN_PROGRESS" },
      undefined,
    );
  });

  it("should write a MILESTONE_UPDATED audit entry with the status transitions", async () => {
    await service.bulkUpdate(
      "plan-1",
      [{ id: "ms-1", status: "COMPLETED", actualDate: now.toISOString() }],
      "user-1",
      "tenant-1",
    );

    expect(mockMilestoneRepo.update).toHaveBeenCalledWith(
      "ms-1",
      { status: "COMPLETED", actualDate: now },
      undefined,
    );
    expect(mockAuditService.logChange).toHaveBeenCalledWith(
      expect.objectContaining({
        planningId: "plan-1",
        tenantId: "tenant-1",
        action: "MILESTONE_UPDATED",
        performedById: "user-1",
        changes: {
          milestones: [
            {
              milestoneId: "ms-1",
              name: "Survey Selesai",
              from: "IN_PROGRESS",
              to: "COMPLETED",
            },
          ],
        },
      }),
      undefined,
    );
  });
});
