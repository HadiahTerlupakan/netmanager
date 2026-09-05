import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { PlanningApprovalService } from "@/modules/planning/services/PlanningApprovalService";
import type { IPlanningRepository } from "@/modules/planning/services/../domain/ports/IPlanningRepository";
import type { IPlanningItemRepository } from "@/modules/planning/services/../domain/ports/IPlanningItemRepository";
import type { IPlanningMilestoneRepository } from "@/modules/planning/services/../domain/ports/IPlanningMilestoneRepository";
import type { IPlanningDocumentRepository } from "@/modules/planning/services/../domain/ports/IPlanningDocumentRepository";
import type { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import { PlanningEntity } from "@/modules/planning/services/../domain/entities/PlanningEntity";
import type { PlanningEntityProps } from "@/modules/planning/domain/entities/PlanningEntity";
import { PlanningItemEntity } from "@/modules/planning/domain/entities/PlanningItemEntity";
import {
  PlanningInvalidStateError,
  PlanningNotFoundError,
  PlanningValidationError,
} from "@/modules/planning/errors/planning-errors";
import { createFakeUnitOfWork } from "../helpers/fakeUnitOfWork";

/** Properti rencana BACKLOG standar; dipakai untuk merakit entity tiruan. */
function backlogPlanningProps(id: string): PlanningEntityProps {
  return {
    id,
    tenantId: "tenant-1",
    type: "OSP",
    title: "Test",
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

describe("PlanningApprovalService", () => {
  let service: PlanningApprovalService;
  let mockPlanningRepo: Mocked<IPlanningRepository>;
  let mockItemRepo: Mocked<IPlanningItemRepository>;
  let mockMilestoneRepo: Mocked<IPlanningMilestoneRepository>;
  let mockDocumentRepo: Mocked<IPlanningDocumentRepository>;
  let mockAuditService: Mocked<PlanningAuditService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPlanningRepo = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
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

    service = new PlanningApprovalService(
      mockPlanningRepo,
      mockItemRepo,
      mockMilestoneRepo,
      mockDocumentRepo,
      mockAuditService,
      createFakeUnitOfWork(),
    );
  });

  describe("submit", () => {
    it("should submit planning with approval level 1 for budget < 500M", async () => {
      const backlogEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test",
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

      const submittedEntity = new PlanningEntity({
        ...backlogEntity,
        status: "PENDING_APPROVAL",
        submittedAt: new Date(),
        submittedById: "user-1",
      });

      mockPlanningRepo.findById.mockResolvedValue(backlogEntity);
      mockPlanningRepo.updateStatus.mockResolvedValue(submittedEntity);

      const result = await service.submit("plan-1", "user-1", "tenant-1");

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "PENDING_APPROVAL",
          approvalLevel: 1,
          currentApprovalStep: 0,
          // Status yang dibaca ikut masuk klausa WHERE supaya dua pengajuan
          // bersamaan tidak saling menimpa.
          expectedStatus: "BACKLOG",
        }),
        undefined,
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "SUBMITTED",
          performedById: "user-1",
          changes: expect.objectContaining({ approvalLevel: 1 }),
          notes: expect.any(String),
        }),
        undefined,
      );
      expect(result.status).toBe("PENDING_APPROVAL");
    });

    it("should submit planning with approval level 2 for budget >= 500M", async () => {
      const backlogEntity = new PlanningEntity({
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

      const submittedEntity = new PlanningEntity({
        ...backlogEntity,
        status: "PENDING_APPROVAL",
        approvalLevel: 2,
        submittedAt: new Date(),
        submittedById: "user-1",
      });

      mockPlanningRepo.findById.mockResolvedValue(backlogEntity);
      mockPlanningRepo.updateStatus.mockResolvedValue(submittedEntity);

      const result = await service.submit("plan-2", "user-1", "tenant-1");

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-2",
        expect.objectContaining({
          approvalLevel: 2,
        }),
        undefined,
      );
      expect(result.approvalLevel).toBe(2);
    });

    // Anggaran header dikunci saat rencana dibuat, sementara BOQ masih boleh
    // ditambah selama BACKLOG. Bila hanya header yang dibaca, rencana dengan
    // header Rp 100 juta dan BOQ Rp 900 juta diajukan sebagai satu tingkat —
    // satu orang menyetujui belanja yang menurut aturan butuh dua.
    it("should derive approval level from BOQ total when it exceeds the header budget", async () => {
      const backlogEntity = new PlanningEntity({
        ...backlogPlanningProps("plan-3"),
        estimatedBudget: 100_000_000,
      });

      mockPlanningRepo.findById.mockResolvedValue(backlogEntity);
      mockPlanningRepo.updateStatus.mockResolvedValue(backlogEntity);
      mockItemRepo.findByPlanningId.mockResolvedValue([
        new PlanningItemEntity({
          id: "item-1",
          planningId: "plan-3",
          tenantId: "tenant-1",
          name: "Perangkat Mahal",
          description: null,
          quantity: 10,
          unit: "unit",
          estimatedPrice: 90_000_000, // total 900 juta
          actualPrice: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ]);

      await service.submit("plan-3", "user-1", "tenant-1");

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-3",
        expect.objectContaining({ approvalLevel: 2 }),
        undefined,
      );
    });

    // Rencana yang ditolak boleh diajukan ulang, tetapi jejak siklus lama ikut
    // terbawa: penyetuju level 1 lama tersangkut di approvedLevel1ById lalu
    // ditolak sebagai "orang yang sama" di siklus baru.
    it("should reset the previous approval cycle fields on resubmission", async () => {
      const rejectedEntity = new PlanningEntity({
        ...backlogPlanningProps("plan-4"),
        status: "REJECTED",
        approvedLevel1At: new Date(),
        approvedLevel1ById: "user-2",
        rejectedAt: new Date(),
        rejectedById: "user-3",
        approvalNotes: "Kurang detail",
        currentApprovalStep: 1,
      });

      mockPlanningRepo.findById.mockResolvedValue(rejectedEntity);
      mockPlanningRepo.updateStatus.mockResolvedValue(rejectedEntity);

      await service.submit("plan-4", "user-1", "tenant-1");

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-4",
        expect.objectContaining({
          approvedAt: null,
          approvedById: null,
          approvedLevel1At: null,
          approvedLevel1ById: null,
          rejectedAt: null,
          rejectedById: null,
          approvalNotes: null,
          expectedStatus: "REJECTED",
        }),
        undefined,
      );
    });

    it("should throw error when planning cannot be submitted", async () => {
      const approvedEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test",
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
        service.submit("plan-1", "user-1", "tenant-1"),
      ).rejects.toThrow(PlanningInvalidStateError);
    });

    it("should reject submit on a planning owned by another tenant", async () => {
      mockPlanningRepo.findById.mockResolvedValue(
        new PlanningEntity({
          ...backlogPlanningProps("plan-1"),
          tenantId: "tenant-lain",
        }),
      );

      await expect(
        service.submit("plan-1", "user-1", "tenant-1"),
      ).rejects.toThrow(PlanningNotFoundError);

      expect(mockPlanningRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("approve - single level", () => {
    it("should approve planning directly when approvalLevel = 1", async () => {
      const pendingEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: 300_000_000,
        actualBudget: null,
        status: "PENDING_APPROVAL",
        approvalLevel: 1,
        currentApprovalStep: 0,
        submittedAt: new Date(),
        submittedById: "user-1",
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

      const approvedEntity = new PlanningEntity({
        ...pendingEntity,
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: "user-2",
        currentApprovalStep: 1,
      });

      mockPlanningRepo.findById.mockResolvedValue(pendingEntity);
      mockPlanningRepo.updateStatus.mockResolvedValue(approvedEntity);

      const result = await service.approve(
        "plan-1",
        "user-2",
        "tenant-1",
        "Approved",
      );

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "APPROVED",
          currentApprovalStep: 1,
          expectedStatus: "PENDING_APPROVAL",
        }),
        undefined,
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "APPROVED",
          performedById: "user-2",
          changes: expect.objectContaining({
            status: { from: "PENDING_APPROVAL", to: "APPROVED" },
            level: 1,
          }),
          notes: "Approved",
        }),
        undefined,
      );
      expect(result.status).toBe("APPROVED");
    });
  });

  describe("approve - multi level", () => {
    it("should approve to APPROVED_LEVEL1 when approvalLevel = 2 and currentStep = 0", async () => {
      const pendingEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Large Planning",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 500,
        estimatedBudget: 600_000_000,
        actualBudget: null,
        status: "PENDING_APPROVAL",
        approvalLevel: 2,
        currentApprovalStep: 0,
        submittedAt: new Date(),
        submittedById: "user-1",
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

      const approvedLevel1Entity = new PlanningEntity({
        ...pendingEntity,
        status: "APPROVED_LEVEL1",
        approvedLevel1At: new Date(),
        approvedLevel1ById: "user-2",
        currentApprovalStep: 1,
      });

      mockPlanningRepo.findById.mockResolvedValue(pendingEntity);
      mockPlanningRepo.updateStatus.mockResolvedValue(approvedLevel1Entity);

      const result = await service.approve(
        "plan-1",
        "user-2",
        "tenant-1",
        "Level 1 OK",
      );

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "APPROVED_LEVEL1",
          currentApprovalStep: 1,
          expectedStatus: "PENDING_APPROVAL",
        }),
        undefined,
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "APPROVED",
          performedById: "user-2",
          changes: expect.objectContaining({ level: 1 }),
          notes: "Level 1 OK",
        }),
        undefined,
      );
      expect(result.status).toBe("APPROVED_LEVEL1");
    });

    it("should approve to APPROVED when approvalLevel = 2 and currentStep = 1", async () => {
      const approvedLevel1Entity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Large Planning",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 500,
        estimatedBudget: 600_000_000,
        actualBudget: null,
        status: "APPROVED_LEVEL1",
        approvalLevel: 2,
        currentApprovalStep: 1,
        submittedAt: new Date(),
        submittedById: "user-1",
        approvedAt: null,
        approvedById: null,
        approvedLevel1At: new Date(),
        approvedLevel1ById: "user-2",
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

      const approvedFinalEntity = new PlanningEntity({
        ...approvedLevel1Entity,
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: "user-3",
        currentApprovalStep: 2,
      });

      mockPlanningRepo.findById.mockResolvedValue(approvedLevel1Entity);
      mockPlanningRepo.updateStatus.mockResolvedValue(approvedFinalEntity);

      const result = await service.approve(
        "plan-1",
        "user-3",
        "tenant-1",
        "Final approval",
      );

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "APPROVED",
          currentApprovalStep: 2,
          expectedStatus: "APPROVED_LEVEL1",
        }),
        undefined,
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "APPROVED",
          performedById: "user-3",
          changes: expect.objectContaining({
            status: { from: "APPROVED_LEVEL1", to: "APPROVED" },
            level: 2,
          }),
          notes: "Final approval",
        }),
        undefined,
      );
      expect(result.status).toBe("APPROVED");
    });
  });

  describe("reject", () => {
    it("should reject planning from PENDING_APPROVAL", async () => {
      const pendingEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: 300_000_000,
        actualBudget: null,
        status: "PENDING_APPROVAL",
        approvalLevel: 1,
        currentApprovalStep: 0,
        submittedAt: new Date(),
        submittedById: "user-1",
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

      const rejectedEntity = new PlanningEntity({
        ...pendingEntity,
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectedById: "user-2",
        approvalNotes: "Not feasible",
      });

      mockPlanningRepo.findById.mockResolvedValue(pendingEntity);
      mockPlanningRepo.updateStatus.mockResolvedValue(rejectedEntity);

      const result = await service.reject(
        "plan-1",
        "user-2",
        "tenant-1",
        "Not feasible",
      );

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "REJECTED",
          approvalNotes: "Not feasible",
          expectedStatus: "PENDING_APPROVAL",
        }),
        undefined,
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "REJECTED",
          performedById: "user-2",
          notes: "Not feasible",
        }),
        undefined,
      );
      expect(result.status).toBe("REJECTED");
    });

    it("should throw error when notes are empty", async () => {
      const pendingEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: 300_000_000,
        actualBudget: null,
        status: "PENDING_APPROVAL",
        approvalLevel: 1,
        currentApprovalStep: 0,
        submittedAt: new Date(),
        submittedById: "user-1",
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

      mockPlanningRepo.findById.mockResolvedValue(pendingEntity);

      await expect(
        service.reject("plan-1", "user-2", "tenant-1", ""),
      ).rejects.toThrow(PlanningValidationError);
    });
  });

  describe("cancel", () => {
    it("should cancel planning with notes", async () => {
      const inProgressEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: 300_000_000,
        actualBudget: null,
        status: "IN_PROGRESS",
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
        progressPercentage: 50,
        startDate: new Date(),
        targetCompletionDate: new Date(),
        actualCompletionDate: null,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const cancelledEntity = new PlanningEntity({
        ...inProgressEntity,
        status: "CANCELLED",
        approvalNotes: "Project cancelled",
      });

      mockPlanningRepo.findById.mockResolvedValue(inProgressEntity);
      mockPlanningRepo.updateStatus.mockResolvedValue(cancelledEntity);

      const result = await service.cancel(
        "plan-1",
        "user-3",
        "tenant-1",
        "Project cancelled",
      );

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "CANCELLED",
          approvalNotes: "Project cancelled",
          expectedStatus: "IN_PROGRESS",
        }),
        undefined,
      );
      expect(result.status).toBe("CANCELLED");
    });

    it("should throw error when notes are empty", async () => {
      const inProgressEntity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: 300_000_000,
        actualBudget: null,
        status: "IN_PROGRESS",
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
        progressPercentage: 50,
        startDate: new Date(),
        targetCompletionDate: new Date(),
        actualCompletionDate: null,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      mockPlanningRepo.findById.mockResolvedValue(inProgressEntity);

      await expect(
        service.cancel("plan-1", "user-3", "tenant-1", ""),
      ).rejects.toThrow(PlanningValidationError);
    });
  });
});
