import { describe, expect, it, vi } from "vitest";
import { PlanningApprovalService } from "@/modules/planning/services/PlanningApprovalService";
import { PlanningEntity } from "@/modules/planning/domain/entities/PlanningEntity";
import type { PlanningStatus } from "@/modules/planning/domain/entities/PlanningEntity";
import { createFakeUnitOfWork } from "./helpers/fakeUnitOfWork";
import { PlanningNotFoundError } from "@/modules/planning/errors/planning-errors";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logActivity: vi.fn(),
  },
}));

const now = new Date("2026-09-02T00:00:00.000Z");

function planning(status: PlanningStatus) {
  return new PlanningEntity({
    id: "p1",
    tenantId: "t1",
    type: "OSP",
    title: "OSP Area A",
    description: null,
    area: "Area A",
    coordinates: null,
    estimatedUnits: 10,
    estimatedBudget: 100_000_000,
    actualBudget: null,
    status,
    approvalLevel: 1,
    currentApprovalStep: 0,
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
    startDate: null,
    targetCompletionDate: null,
    actualCompletionDate: null,
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

function createService(entity: PlanningEntity) {
  const planningRepo = {
    findById: vi.fn().mockResolvedValue(entity),
    updateStatus: vi.fn().mockResolvedValue(entity),
  };
  const emptyRepo = { findByPlanningId: vi.fn().mockResolvedValue([]) };
  return {
    service: new PlanningApprovalService(
      planningRepo as never,
      emptyRepo as never,
      emptyRepo as never,
      emptyRepo as never,
      { logChange: vi.fn().mockResolvedValue(undefined) } as never,
      createFakeUnitOfWork(),
    ),
    planningRepo,
  };
}

describe("PlanningApprovalService.startProgress", () => {
  // Regresi: tidak ada apa pun yang memindahkan rencana ke IN_PROGRESS.
  // canStartProgress() dibuat untuk menjaga transisi ini tapi tidak pernah
  // dipanggil, sehingga kolom Kanban "In Progress" mustahil terisi.
  it("memindahkan rencana yang disetujui ke IN_PROGRESS", async () => {
    const { service, planningRepo } = createService(planning("APPROVED"));

    await service.startProgress("p1", "user-3", "t1");

    expect(planningRepo.updateStatus).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        status: "IN_PROGRESS",
        expectedStatus: "APPROVED",
      }),
      undefined,
    );
  });

  it("mencatat tanggal mulai saat dijalankan", async () => {
    const { service, planningRepo } = createService(planning("APPROVED"));

    await service.startProgress("p1", "user-3", "t1");

    expect(planningRepo.updateStatus).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ startDate: expect.any(Date) }),
      undefined,
    );
  });

  it.each(["BACKLOG", "PENDING_APPROVAL", "COMPLETED"] as PlanningStatus[])(
    "menolak memulai dari status %s",
    async (status) => {
      const { service, planningRepo } = createService(planning(status));

      await expect(
        service.startProgress("p1", "user-3", "t1"),
      ).rejects.toThrow();
      expect(planningRepo.updateStatus).not.toHaveBeenCalled();
    },
  );
});

describe("PlanningApprovalService — guard lintas tenant", () => {
  // Ekstensi isolasi Prisma sengaja melewatkan super admin, jadi guard di
  // service adalah satu-satunya yang menghalangi sesi tenant A memindahkan
  // rencana tenant B.
  it("memperlakukan rencana tenant lain seperti tidak ditemukan", async () => {
    const { service, planningRepo } = createService(planning("APPROVED"));

    await expect(
      service.startProgress("p1", "user-3", "tenant-lain"),
    ).rejects.toThrow(PlanningNotFoundError);
    expect(planningRepo.updateStatus).not.toHaveBeenCalled();
  });
});

describe("PlanningApprovalService.complete", () => {
  // Regresi: COMPLETED tidak pernah bisa dicapai, padahal Kanban dan dashboard
  // menampilkannya sebagai kolom dan metrik.
  it("menutup rencana yang sedang berjalan", async () => {
    const { service, planningRepo } = createService(planning("IN_PROGRESS"));

    await service.complete("p1", "user-3", "t1");

    expect(planningRepo.updateStatus).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        status: "COMPLETED",
        expectedStatus: "IN_PROGRESS",
      }),
      undefined,
    );
  });

  it("mencatat tanggal penyelesaian dan progres penuh", async () => {
    const { service, planningRepo } = createService(planning("IN_PROGRESS"));

    await service.complete("p1", "user-3", "t1");

    expect(planningRepo.updateStatus).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        actualCompletionDate: expect.any(Date),
        progressPercentage: 100,
      }),
      undefined,
    );
  });

  it.each(["APPROVED", "BACKLOG", "COMPLETED"] as PlanningStatus[])(
    "menolak menutup dari status %s",
    async (status) => {
      const { service, planningRepo } = createService(planning(status));

      await expect(service.complete("p1", "user-3", "t1")).rejects.toThrow();
      expect(planningRepo.updateStatus).not.toHaveBeenCalled();
    },
  );
});
