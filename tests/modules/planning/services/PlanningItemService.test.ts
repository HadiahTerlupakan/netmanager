import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { PlanningItemService } from "@/modules/planning/services/PlanningItemService";
import type { IPlanningRepository } from "@/modules/planning/domain/ports/IPlanningRepository";
import type { IPlanningItemRepository } from "@/modules/planning/domain/ports/IPlanningItemRepository";
import type { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import { PlanningEntity } from "@/modules/planning/domain/entities/PlanningEntity";
import { PlanningItemEntity } from "@/modules/planning/domain/entities/PlanningItemEntity";
import type { PlanningStatus } from "@/modules/planning/domain/entities/PlanningEntity";
import {
  PlanningInvalidStateError,
  PlanningNotFoundError,
} from "@/modules/planning/errors/planning-errors";
import { createFakeUnitOfWork } from "../helpers/fakeUnitOfWork";

const now = new Date("2026-09-02T00:00:00.000Z");

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

function item(overrides: Partial<{ id: string; planningId: string }> = {}) {
  return new PlanningItemEntity({
    id: "item-1",
    planningId: "plan-1",
    tenantId: "tenant-1",
    name: "Kabel Fiber 24 Core",
    description: null,
    quantity: 100,
    unit: "meter",
    estimatedPrice: 50_000,
    actualPrice: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe("PlanningItemService", () => {
  let service: PlanningItemService;
  let mockPlanningRepo: Mocked<IPlanningRepository>;
  let mockItemRepo: Mocked<IPlanningItemRepository>;
  let mockAuditService: Mocked<PlanningAuditService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPlanningRepo = {
      findById: vi.fn().mockResolvedValue(planning("BACKLOG")),
    } as unknown as Mocked<IPlanningRepository>;

    mockItemRepo = {
      findById: vi.fn().mockResolvedValue(item()),
      findByPlanningId: vi.fn().mockResolvedValue([item()]),
      create: vi.fn().mockResolvedValue(item()),
      update: vi.fn().mockResolvedValue(item()),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<IPlanningItemRepository>;

    mockAuditService = {
      logChange: vi.fn(),
    } as unknown as Mocked<PlanningAuditService>;

    service = new PlanningItemService(
      mockPlanningRepo,
      mockItemRepo,
      mockAuditService,
      createFakeUnitOfWork(),
    );
  });

  const createDto = {
    name: "Kabel Fiber 24 Core",
    quantity: 100,
    unit: "meter",
    estimatedPrice: 50_000,
  };

  // Ekstensi isolasi Prisma sengaja melewatkan super admin, jadi guard di
  // service adalah satu-satunya yang menghalangi sesi tenant A menyentuh BOQ
  // tenant B — nama material, kuantitas, dan harga satuannya.
  describe("cross-tenant guard", () => {
    beforeEach(() => {
      mockPlanningRepo.findById.mockResolvedValue(
        planning("BACKLOG", "tenant-lain"),
      );
    });

    it("should reject reading items of a planning owned by another tenant", async () => {
      await expect(
        service.getByPlanningId("plan-1", "tenant-1"),
      ).rejects.toThrow(PlanningNotFoundError);

      expect(mockItemRepo.findByPlanningId).not.toHaveBeenCalled();
    });

    it("should reject creating an item on a planning owned by another tenant", async () => {
      await expect(
        service.create("plan-1", createDto, "user-1", "tenant-1"),
      ).rejects.toThrow(PlanningNotFoundError);

      expect(mockItemRepo.create).not.toHaveBeenCalled();
    });

    it("should reject deleting an item on a planning owned by another tenant", async () => {
      await expect(
        service.delete("plan-1", "item-1", "user-1", "tenant-1"),
      ).rejects.toThrow(PlanningNotFoundError);

      expect(mockItemRepo.delete).not.toHaveBeenCalled();
    });
  });

  // BOQ adalah bagian dari ruang lingkup: mengubahnya setelah rencana diajukan
  // membatalkan makna persetujuan yang sudah diberikan atas angka lama.
  describe("editable status guard", () => {
    it.each([
      "PENDING_APPROVAL",
      "APPROVED",
      "IN_PROGRESS",
      "COMPLETED",
    ] as PlanningStatus[])(
      "should reject item changes when status is %s",
      async (status) => {
        mockPlanningRepo.findById.mockResolvedValue(planning(status));

        await expect(
          service.create("plan-1", createDto, "user-1", "tenant-1"),
        ).rejects.toThrow(PlanningInvalidStateError);
        await expect(
          service.update(
            "plan-1",
            "item-1",
            { quantity: 5 },
            "user-1",
            "tenant-1",
          ),
        ).rejects.toThrow(PlanningInvalidStateError);
        await expect(
          service.delete("plan-1", "item-1", "user-1", "tenant-1"),
        ).rejects.toThrow(PlanningInvalidStateError);

        expect(mockItemRepo.create).not.toHaveBeenCalled();
        expect(mockItemRepo.update).not.toHaveBeenCalled();
        expect(mockItemRepo.delete).not.toHaveBeenCalled();
      },
    );

    it.each(["BACKLOG", "REJECTED"] as PlanningStatus[])(
      "should allow item changes when status is %s",
      async (status) => {
        mockPlanningRepo.findById.mockResolvedValue(planning(status));

        await service.create("plan-1", createDto, "user-1", "tenant-1");

        expect(mockItemRepo.create).toHaveBeenCalled();
      },
    );
  });

  // Aksi `ITEM_ADDED`, `ITEM_UPDATED`, dan `ITEM_REMOVED` terdefinisi di domain
  // dan di enum Prisma tetapi tidak pernah ditulis, sehingga menghapus material
  // senilai ratusan juta dari sebuah rencana tidak meninggalkan jejak siapa pun.
  describe("audit trail", () => {
    it("should write an ITEM_ADDED entry on create", async () => {
      await service.create("plan-1", createDto, "user-1", "tenant-1");

      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "ITEM_ADDED",
          performedById: "user-1",
          changes: expect.objectContaining({
            itemId: "item-1",
            name: "Kabel Fiber 24 Core",
          }),
        }),
        undefined,
      );
    });

    it("should write an ITEM_UPDATED entry on update", async () => {
      await service.update(
        "plan-1",
        "item-1",
        { quantity: 120 },
        "user-1",
        "tenant-1",
      );

      expect(mockItemRepo.update).toHaveBeenCalledWith(
        "item-1",
        { quantity: 120 },
        undefined,
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "ITEM_UPDATED",
          performedById: "user-1",
          changes: expect.objectContaining({
            itemId: "item-1",
            fields: ["quantity"],
          }),
        }),
        undefined,
      );
    });

    it("should write an ITEM_REMOVED entry on delete", async () => {
      await service.delete("plan-1", "item-1", "user-1", "tenant-1");

      expect(mockItemRepo.delete).toHaveBeenCalledWith("item-1", undefined);
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "ITEM_REMOVED",
          performedById: "user-1",
          changes: expect.objectContaining({
            itemId: "item-1",
            name: "Kabel Fiber 24 Core",
            quantity: 100,
          }),
        }),
        undefined,
      );
    });
  });

  // Tanpa pemeriksaan ini, id item milik rencana lain (bahkan tenant lain) yang
  // ditempel ke URL rencana ini akan diubah atau dihapus apa adanya.
  describe("item ownership", () => {
    it("should reject an item that belongs to a different planning", async () => {
      mockItemRepo.findById.mockResolvedValue(
        item({ id: "item-9", planningId: "plan-lain" }),
      );

      await expect(
        service.update(
          "plan-1",
          "item-9",
          { quantity: 5 },
          "user-1",
          "tenant-1",
        ),
      ).rejects.toThrow(PlanningNotFoundError);

      expect(mockItemRepo.update).not.toHaveBeenCalled();
    });

    it("should reject an item that does not exist", async () => {
      mockItemRepo.findById.mockResolvedValue(null);

      await expect(
        service.delete("plan-1", "item-999", "user-1", "tenant-1"),
      ).rejects.toThrow(PlanningNotFoundError);

      expect(mockItemRepo.delete).not.toHaveBeenCalled();
    });
  });
});
