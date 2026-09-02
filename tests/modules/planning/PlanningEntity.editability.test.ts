import { describe, expect, it } from "vitest";
import { PlanningEntity } from "@/modules/planning/domain/entities/PlanningEntity";
import type { PlanningStatus } from "@/modules/planning/domain/entities/PlanningEntity";

const now = new Date("2026-09-02T00:00:00.000Z");

const planning = (status: PlanningStatus) =>
  new PlanningEntity({
    id: "p1",
    tenantId: "t1",
    type: "OSP",
    title: "OSP",
    description: null,
    area: "A",
    coordinates: null,
    estimatedUnits: 1,
    estimatedBudget: 1,
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
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

describe("PlanningEntity — apa yang boleh diubah kapan", () => {
  // Field perencanaan tetap terkunci setelah disetujui: mengubah ruang lingkup
  // atau anggaran rencana yang sudah disetujui akan membatalkan makna
  // persetujuan itu sendiri.
  it.each(["BACKLOG", "REJECTED"] as PlanningStatus[])(
    "mengizinkan edit rencana saat %s",
    (status) => {
      expect(planning(status).canBeEdited()).toBe(true);
    },
  );

  it.each(["APPROVED", "IN_PROGRESS", "COMPLETED"] as PlanningStatus[])(
    "mengunci edit rencana saat %s",
    (status) => {
      expect(planning(status).canBeEdited()).toBe(false);
    },
  );

  // Regresi: realisasi (actualBudget, progressPercentage) hanya bisa diisi saat
  // BACKLOG/REJECTED — yaitu SEBELUM disetujui, ketika realisasi belum ada.
  // Setelah disetujui dokumen terkunci, sehingga realisasi sebenarnya tidak
  // pernah bisa dicatat.
  it("mengizinkan pencatatan realisasi saat IN_PROGRESS", () => {
    expect(planning("IN_PROGRESS").canRecordExecutionProgress()).toBe(true);
  });

  it.each(["BACKLOG", "PENDING_APPROVAL", "APPROVED"] as PlanningStatus[])(
    "menolak pencatatan realisasi saat %s",
    (status) => {
      expect(planning(status).canRecordExecutionProgress()).toBe(false);
    },
  );

  it("menolak pencatatan realisasi setelah selesai", () => {
    expect(planning("COMPLETED").canRecordExecutionProgress()).toBe(false);
  });
});
