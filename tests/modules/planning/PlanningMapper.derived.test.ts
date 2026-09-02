import { describe, expect, it } from "vitest";
import { PlanningMapper } from "@/modules/planning/mappers/PlanningMapper";
import { PlanningEntity } from "@/modules/planning/domain/entities/PlanningEntity";
import { PlanningItemEntity } from "@/modules/planning/domain/entities/PlanningItemEntity";
import { PlanningMilestoneEntity } from "@/modules/planning/domain/entities/PlanningMilestoneEntity";

const now = new Date("2026-09-02T00:00:00.000Z");

function planning(estimatedBudget: number | null) {
  return new PlanningEntity({
    id: "p1",
    tenantId: "t1",
    type: "OSP",
    title: "OSP Area A",
    description: null,
    area: "Area A",
    coordinates: null,
    estimatedUnits: 10,
    estimatedBudget,
    actualBudget: null,
    status: "IN_PROGRESS",
    approvalLevel: 2,
    currentApprovalStep: 1,
    submittedAt: null,
    submittedById: null,
    approvedAt: null,
    approvedById: null,
    approvedLevel1At: null,
    approvedLevel1ById: null,
    rejectedAt: null,
    rejectedById: null,
    approvalNotes: null,
    progressPercentage: 90,
    startDate: null,
    targetCompletionDate: null,
    actualCompletionDate: null,
    createdById: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

const item = (quantity: number, estimatedPrice: number | null) =>
  new PlanningItemEntity({
    id: "i1",
    planningId: "p1",
    tenantId: "t1",
    name: "Kabel",
    description: null,
    quantity,
    unit: "m",
    estimatedPrice,
    actualPrice: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });

const milestone = (status: "PENDING" | "COMPLETED") =>
  new PlanningMilestoneEntity({
    id: "m1",
    planningId: "p1",
    tenantId: "t1",
    name: "Survey",
    description: null,
    targetDate: now,
    actualDate: null,
    status,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });

const relations = (
  items: PlanningItemEntity[],
  milestones: PlanningMilestoneEntity[],
) => ({ items, milestones, documents: [] as never[] });

describe("PlanningMapper.toDetailDTO — angka turunan", () => {
  // BOQ dan anggaran header selama ini berdiri sendiri: getTotalEstimated()
  // tidak pernah dipanggil, sehingga keduanya bisa berbeda tanpa protes.
  it("membawa total biaya item hasil rollup BOQ", () => {
    const dto = PlanningMapper.toDetailDTO(
      planning(2000),
      relations([item(2, 1000), item(3, 500)], []),
    );

    expect(dto.itemsTotalEstimatedCost).toBe(3500);
  });

  it("menandai ketidakcocokan anggaran header dengan total BOQ", () => {
    const dto = PlanningMapper.toDetailDTO(
      planning(2000),
      relations([item(2, 1000), item(3, 500)], []),
    );

    expect(dto.hasBudgetMismatch).toBe(true);
  });

  it("tidak menandai saat anggaran cocok", () => {
    const dto = PlanningMapper.toDetailDTO(
      planning(3500),
      relations([item(2, 1000), item(3, 500)], []),
    );

    expect(dto.hasBudgetMismatch).toBe(false);
  });

  // progressPercentage entity bernilai 90 padahal separuh milestone pending —
  // persis kondisi yang selama ini tidak terdeteksi.
  it("menghitung progres dari milestone, bukan dari nilai yang diketik", () => {
    const dto = PlanningMapper.toDetailDTO(
      planning(null),
      relations([], [milestone("COMPLETED"), milestone("PENDING")]),
    );

    expect(dto.milestoneProgressPercentage).toBe(50);
  });

  it("mengembalikan null saat tidak ada milestone sebagai dasar", () => {
    const dto = PlanningMapper.toDetailDTO(planning(null), relations([], []));

    expect(dto.milestoneProgressPercentage).toBeNull();
  });
});
