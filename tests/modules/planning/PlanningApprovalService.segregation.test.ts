import { describe, expect, it, vi } from "vitest";
import { PlanningApprovalService } from "@/modules/planning/services/PlanningApprovalService";
import { PlanningSegregationOfDutiesError } from "@/modules/planning/errors/planning-errors";
import { PlanningEntity } from "@/modules/planning/domain/entities/PlanningEntity";
import { createFakeUnitOfWork } from "./helpers/fakeUnitOfWork";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logActivity: vi.fn(),
  },
}));

const now = new Date("2026-09-02T00:00:00.000Z");

function awaitingLevel2(approvedLevel1ById: string | null) {
  return new PlanningEntity({
    id: "p1",
    tenantId: "t1",
    type: "OSP",
    title: "OSP Area A",
    description: null,
    area: "Area A",
    coordinates: null,
    estimatedUnits: 10,
    estimatedBudget: 900_000_000,
    actualBudget: null,
    status: "APPROVED_LEVEL1",
    approvalLevel: 2,
    currentApprovalStep: 1,
    submittedAt: now,
    submittedById: "user-1",
    approvedAt: null,
    approvedById: null,
    approvedLevel1At: now,
    approvedLevel1ById,
    rejectedAt: null,
    rejectedById: null,
    approvalNotes: null,
    progressPercentage: 0,
    startDate: null,
    targetCompletionDate: null,
    actualCompletionDate: null,
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

function createService(planning: PlanningEntity) {
  const planningRepo = {
    findById: vi.fn().mockResolvedValue(planning),
    updateStatus: vi.fn().mockResolvedValue(planning),
  };
  const emptyRepo = { findByPlanningId: vi.fn().mockResolvedValue([]) };
  const auditService = { logChange: vi.fn().mockResolvedValue(undefined) };

  return {
    service: new PlanningApprovalService(
      planningRepo as never,
      emptyRepo as never,
      emptyRepo as never,
      emptyRepo as never,
      auditService as never,
      createFakeUnitOfWork(),
    ),
    planningRepo,
  };
}

describe("PlanningApprovalService.approve — pemisahan wewenang", () => {
  // Regresi: service tidak pernah membandingkan penyetuju tingkat kedua dengan
  // approvedLevel1ById, sehingga satu orang bisa menyetujui kedua tingkat
  // sendirian dan alur berlapis kehilangan seluruh maknanya.
  it("menolak penyetuju tingkat kedua yang sama dengan tingkat pertama", async () => {
    const { service, planningRepo } = createService(awaitingLevel2("user-2"));

    await expect(service.approve("p1", "user-2", "t1")).rejects.toThrow(
      PlanningSegregationOfDutiesError,
    );
    expect(planningRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("mengizinkan penyetuju tingkat kedua yang berbeda", async () => {
    const { service, planningRepo } = createService(awaitingLevel2("user-2"));

    await service.approve("p1", "user-3", "t1");

    expect(planningRepo.updateStatus).toHaveBeenCalled();
  });
});
