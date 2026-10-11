import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";

/**
 * Penerbitan titik rencana. Dua lapis diuji bersama: service (syarat status,
 * audit, tanpa penyalinan) dan repository (bentuk `updateMany`, termasuk
 * kewajiban mempertahankan `planningId` sebagai jejak asal-usul).
 */

const { mockNodeUpdateMany, mockEdgeUpdateMany } = vi.hoisted(() => ({
  mockNodeUpdateMany: vi.fn(),
  mockEdgeUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const klien = {
    mappingNode: { updateMany: mockNodeUpdateMany },
    mappingEdge: { updateMany: mockEdgeUpdateMany },
  };
  return {
    prisma: {
      ...klien,
      $transaction: (kerja: (tx: typeof klien) => unknown) => kerja(klien),
    },
  };
});

import { PlanningPetaService } from "@/modules/planning/services/PlanningPetaService";
import { PlanningPetaRepository } from "@/modules/planning/repositories/PlanningPetaRepository";
import type { IPlanningRepository } from "@/modules/planning/domain/ports/IPlanningRepository";
import type { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import {
  PlanningEntity,
  type PlanningStatus,
} from "@/modules/planning/domain/entities/PlanningEntity";
import {
  PlanningInvalidStateError,
  PlanningNotFoundError,
} from "@/modules/planning/errors/planning-errors";
import { createFakeUnitOfWork } from "./helpers/fakeUnitOfWork";

const now = new Date("2026-10-11T00:00:00.000Z");

function planning(status: PlanningStatus, tenantId = "tenant-1") {
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
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe("PlanningPetaService.terbitkan", () => {
  let service: PlanningPetaService;
  let planningRepo: Mocked<IPlanningRepository>;
  let repo: Mocked<PlanningPetaRepository>;
  let audit: Mocked<PlanningAuditService>;

  beforeEach(() => {
    vi.clearAllMocks();
    planningRepo = {
      findById: vi.fn().mockResolvedValue(planning("APPROVED")),
    } as unknown as Mocked<IPlanningRepository>;
    repo = {
      tandaiTerbit: vi
        .fn()
        .mockResolvedValue({ titikTerbit: 3, jalurTerbit: 2 }),
      buatTitik: vi.fn(),
    } as unknown as Mocked<PlanningPetaRepository>;
    audit = { logChange: vi.fn() } as unknown as Mocked<PlanningAuditService>;
    service = new PlanningPetaService(
      planningRepo,
      repo,
      audit,
      createFakeUnitOfWork(),
    );
  });

  it("melepas penanda rencana tanpa menyalin data, lalu mengaudit", async () => {
    const hasil = await service.terbitkan("plan-1", "user-1", "tenant-1");

    expect(hasil).toEqual({ titikTerbit: 3, jalurTerbit: 2 });
    expect(repo.tandaiTerbit).toHaveBeenCalledWith(
      "plan-1",
      "tenant-1",
      undefined,
    );
    expect(repo.buatTitik).not.toHaveBeenCalled();
    expect(audit.logChange).toHaveBeenCalledWith(
      expect.objectContaining({
        planningId: "plan-1",
        performedById: "user-1",
        changes: expect.objectContaining({ peta: "diterbitkan" }),
      }),
      undefined,
    );
  });

  it.each(["APPROVED", "IN_PROGRESS", "COMPLETED"] as PlanningStatus[])(
    "mengizinkan penerbitan pada status %s",
    async (status) => {
      planningRepo.findById.mockResolvedValue(planning(status));

      await service.terbitkan("plan-1", "user-1", "tenant-1");

      expect(repo.tandaiTerbit).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    "BACKLOG",
    "PENDING_APPROVAL",
    "APPROVED_LEVEL1",
    "REJECTED",
    "CANCELLED",
  ] as PlanningStatus[])(
    "menolak menerbitkan planning berstatus %s",
    async (status) => {
      planningRepo.findById.mockResolvedValue(planning(status));

      await expect(
        service.terbitkan("plan-1", "user-1", "tenant-1"),
      ).rejects.toBeInstanceOf(PlanningInvalidStateError);
      expect(repo.tandaiTerbit).not.toHaveBeenCalled();
      expect(audit.logChange).not.toHaveBeenCalled();
    },
  );

  it("menolak planning milik tenant lain", async () => {
    planningRepo.findById.mockResolvedValue(planning("APPROVED", "lain"));

    await expect(
      service.terbitkan("plan-1", "user-1", "tenant-1"),
    ).rejects.toBeInstanceOf(PlanningNotFoundError);
    expect(repo.tandaiTerbit).not.toHaveBeenCalled();
  });
});

describe("PlanningPetaRepository.tandaiTerbit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNodeUpdateMany.mockResolvedValue({ count: 3 });
    mockEdgeUpdateMany.mockResolvedValue({ count: 2 });
  });

  it("melepas isPlanned pada node dan edge milik planning itu saja", async () => {
    const hasil = await new PlanningPetaRepository().tandaiTerbit(
      "plan-1",
      "tenant-1",
    );

    const syarat = {
      planningId: "plan-1",
      tenantId: "tenant-1",
      isPlanned: true,
    };
    expect(mockNodeUpdateMany).toHaveBeenCalledWith({
      where: syarat,
      data: { isPlanned: false },
    });
    expect(mockEdgeUpdateMany).toHaveBeenCalledWith({
      where: syarat,
      data: { isPlanned: false },
    });
    expect(hasil).toEqual({ titikTerbit: 3, jalurTerbit: 2 });
  });

  it("mempertahankan planningId sebagai jejak asal-usul", async () => {
    await new PlanningPetaRepository().tandaiTerbit("plan-1", "tenant-1");

    for (const panggilan of [
      ...mockNodeUpdateMany.mock.calls,
      ...mockEdgeUpdateMany.mock.calls,
    ]) {
      expect(panggilan[0].data).not.toHaveProperty("planningId");
      expect(panggilan[0].data).toEqual({ isPlanned: false });
    }
  });
});
