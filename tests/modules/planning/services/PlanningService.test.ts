import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { PlanningService } from "@/modules/planning/services/PlanningService";
import type { IPlanningRepository } from "@/modules/planning/services/../domain/ports/IPlanningRepository";
import type { IPlanningItemRepository } from "@/modules/planning/services/../domain/ports/IPlanningItemRepository";
import type { IPlanningMilestoneRepository } from "@/modules/planning/services/../domain/ports/IPlanningMilestoneRepository";
import type { IPlanningDocumentRepository } from "@/modules/planning/services/../domain/ports/IPlanningDocumentRepository";
import type { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import { PlanningEntity } from "@/modules/planning/services/../domain/entities/PlanningEntity";
import type { PlanningEntityProps } from "@/modules/planning/domain/entities/PlanningEntity";
import {
  PlanningInvalidStateError,
  PlanningNotFoundError,
} from "@/modules/planning/errors/planning-errors";
import { createFakeUnitOfWork } from "../helpers/fakeUnitOfWork";

/** Properti rencana BACKLOG standar; dipakai untuk merakit entity tiruan. */
function backlogPlanningProps(id: string): PlanningEntityProps {
  return {
    id,
    tenantId: "tenant-1",
    type: "OSP",
    title: "Test Planning",
    description: null,
    area: "Jakarta",
    coordinates: null,
    estimatedUnits: 100,
    estimatedBudget: 300_000_000,
    actualBudget: null,
    status: "BACKLOG",
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
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

describe("PlanningService", () => {
  let service: PlanningService;
  let mockPlanningRepo: Mocked<IPlanningRepository>;
  let mockItemRepo: Mocked<IPlanningItemRepository>;
  let mockMilestoneRepo: Mocked<IPlanningMilestoneRepository>;
  let mockDocumentRepo: Mocked<IPlanningDocumentRepository>;
  let mockAuditService: Mocked<PlanningAuditService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPlanningRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findByStatus: vi.fn(),
      findPendingApproval: vi.fn(),
      findByCreatedBy: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<IPlanningRepository>;

    mockItemRepo = {
      findByPlanningId: vi.fn().mockResolvedValue([]),
    } as unknown as Mocked<IPlanningItemRepository>;

    mockMilestoneRepo = {
      findByPlanningId: vi.fn().mockResolvedValue([]),
    } as unknown as Mocked<IPlanningMilestoneRepository>;

    mockDocumentRepo = {
      findByPlanningId: vi.fn().mockResolvedValue([]),
    } as unknown as Mocked<IPlanningDocumentRepository>;

    mockAuditService = {
      logChange: vi.fn(),
    } as unknown as Mocked<PlanningAuditService>;

    service = new PlanningService(
      mockPlanningRepo,
      mockItemRepo,
      mockMilestoneRepo,
      mockDocumentRepo,
      mockAuditService,
      createFakeUnitOfWork(),
    );
  });

  describe("create", () => {
    it("should create planning with approval level 1 for budget < 500M", async () => {
      const mockEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test Planning",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: 300_000_000, // < 500M
        actualBudget: null,
        status: "BACKLOG",
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
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPlanningRepo.create.mockResolvedValue(mockEntity);

      const result = await service.create(
        {
          type: "OSP",
          title: "Test Planning",
          area: "Jakarta",
          estimatedUnits: 100,
          estimatedBudget: 300_000_000,
        },
        "tenant-1",
        "user-1",
      );

      expect(mockPlanningRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalLevel: 1,
        }),
        undefined,
      );
      // Audit kini menerima satu object bernama, dan tenantId-nya diambil dari
      // rencana yang bersangkutan — bukan lagi string kosong yang melanggar
      // foreign key ke tabel Tenant.
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "CREATED",
          performedById: "user-1",
          changes: expect.objectContaining({ approvalLevel: 1 }),
        }),
        undefined,
      );
      expect(result.id).toBe("plan-1");
      expect(result.approvalLevel).toBe(1);
    });

    it("should create planning with approval level 2 for budget >= 500M", async () => {
      const mockEntity = new PlanningEntity({
        id: "plan-2",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Large Planning",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 500,
        estimatedBudget: 600_000_000, // >= 500M
        actualBudget: null,
        status: "BACKLOG",
        approvalLevel: 2,
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
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPlanningRepo.create.mockResolvedValue(mockEntity);

      const result = await service.create(
        {
          type: "OSP",
          title: "Large Planning",
          area: "Jakarta",
          estimatedUnits: 500,
          estimatedBudget: 600_000_000,
        },
        "tenant-1",
        "user-1",
      );

      expect(mockPlanningRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalLevel: 2,
        }),
        undefined,
      );
      expect(result.approvalLevel).toBe(2);
    });

    it("should create planning with approval level 1 when budget is null", async () => {
      const mockEntity = new PlanningEntity({
        id: "plan-3",
        tenantId: "tenant-1",
        type: "OSP",
        title: "No Budget Planning",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: null,
        actualBudget: null,
        status: "BACKLOG",
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
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPlanningRepo.create.mockResolvedValue(mockEntity);

      const result = await service.create(
        {
          type: "OSP",
          title: "No Budget Planning",
          area: "Jakarta",
          estimatedUnits: 100,
        },
        "tenant-1",
        "user-1",
      );

      expect(result.approvalLevel).toBe(1);
    });
  });

  describe("update", () => {
    it("should update planning when in BACKLOG status", async () => {
      const existingEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Old Title",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: 300_000_000,
        actualBudget: null,
        status: "BACKLOG",
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
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const updatedEntity = new PlanningEntity({
        ...existingEntity,
        title: "New Title",
      });

      mockPlanningRepo.findById.mockResolvedValue(existingEntity);
      mockPlanningRepo.update.mockResolvedValue(updatedEntity);

      const result = await service.update(
        "plan-1",
        { title: "New Title" },
        "user-1",
        "tenant-1",
      );

      expect(mockPlanningRepo.update).toHaveBeenCalled();
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "UPDATED",
          performedById: "user-1",
          changes: expect.objectContaining({
            title: { from: "Old Title", to: "New Title" },
          }),
        }),
        undefined,
      );
      expect(result.title).toBe("New Title");
    });

    it("should throw error when planning not found", async () => {
      mockPlanningRepo.findById.mockResolvedValue(null);

      await expect(
        service.update(
          "plan-999",
          { title: "New Title" },
          "user-1",
          "tenant-1",
        ),
      ).rejects.toThrow(PlanningNotFoundError);
    });

    it("should throw error when planning cannot be edited", async () => {
      const approvedEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Approved Planning",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: 300_000_000,
        actualBudget: null,
        status: "APPROVED",
        approvalLevel: 1,
        currentApprovalStep: 1,
        submittedAt: new Date(),
        submittedById: "user-1",
        approvedAt: new Date(),
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
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPlanningRepo.findById.mockResolvedValue(approvedEntity);

      await expect(
        service.update("plan-1", { title: "New Title" }, "user-1", "tenant-1"),
      ).rejects.toThrow(PlanningInvalidStateError);
    });

    // Isolasi tenant modul ini bersandar pada ekstensi Prisma yang sengaja
    // melewatkan super admin, jadi guard eksplisit di service adalah satu-satunya
    // yang menghalangi sesi tenant A mengubah rencana tenant B.
    it("should reject update on a planning owned by another tenant", async () => {
      const foreignEntity = new PlanningEntity({
        ...backlogPlanningProps("plan-1"),
        tenantId: "tenant-lain",
      });

      mockPlanningRepo.findById.mockResolvedValue(foreignEntity);

      await expect(
        service.update("plan-1", { title: "New Title" }, "user-1", "tenant-1"),
      ).rejects.toThrow(PlanningNotFoundError);

      expect(mockPlanningRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should soft delete planning when in BACKLOG status", async () => {
      const existingEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test Planning",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: 300_000_000,
        actualBudget: null,
        status: "BACKLOG",
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
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPlanningRepo.findById.mockResolvedValue(existingEntity);
      mockPlanningRepo.delete.mockResolvedValue(undefined);

      await service.delete("plan-1", "user-1", "tenant-1");

      expect(mockPlanningRepo.delete).toHaveBeenCalledWith("plan-1", undefined);
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "STATUS_CHANGED",
          performedById: "user-1",
        }),
        undefined,
      );
    });

    it("should reject delete on a planning owned by another tenant", async () => {
      const foreignEntity = new PlanningEntity({
        ...backlogPlanningProps("plan-1"),
        tenantId: "tenant-lain",
      });

      mockPlanningRepo.findById.mockResolvedValue(foreignEntity);

      await expect(
        service.delete("plan-1", "user-1", "tenant-1"),
      ).rejects.toThrow(PlanningNotFoundError);

      expect(mockPlanningRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("should return planning with relations", async () => {
      const mockEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test Planning",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: 300_000_000,
        actualBudget: null,
        status: "BACKLOG",
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
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPlanningRepo.findById.mockResolvedValue(mockEntity);

      const result = await service.getById("plan-1", "tenant-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("plan-1");
      expect(mockItemRepo.findByPlanningId).toHaveBeenCalledWith("plan-1");
      expect(mockMilestoneRepo.findByPlanningId).toHaveBeenCalledWith("plan-1");
      expect(mockDocumentRepo.findByPlanningId).toHaveBeenCalledWith("plan-1");
    });

    it("should return null when planning not found", async () => {
      mockPlanningRepo.findById.mockResolvedValue(null);

      const result = await service.getById("plan-999", "tenant-1");

      expect(result).toBeNull();
    });

    it("should return null when planning belongs to another tenant", async () => {
      const foreignEntity = new PlanningEntity({
        ...backlogPlanningProps("plan-1"),
        tenantId: "tenant-lain",
      });

      mockPlanningRepo.findById.mockResolvedValue(foreignEntity);

      const result = await service.getById("plan-1", "tenant-1");

      expect(result).toBeNull();
    });
  });
});
