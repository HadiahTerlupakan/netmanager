import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanningApprovalService } from "@/modules/planning/services/PlanningApprovalService";
import type { IPlanningRepository } from "@/modules/planning/services/../domain/ports/IPlanningRepository";
import type { IPlanningItemRepository } from "@/modules/planning/services/../domain/ports/IPlanningItemRepository";
import type { IPlanningMilestoneRepository } from "@/modules/planning/services/../domain/ports/IPlanningMilestoneRepository";
import type { IPlanningDocumentRepository } from "@/modules/planning/services/../domain/ports/IPlanningDocumentRepository";
import type { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import { PlanningEntity } from "@/modules/planning/services/../domain/entities/PlanningEntity";

describe("PlanningApprovalService", () => {
  let service: PlanningApprovalService;
  let mockPlanningRepo: jest.Mocked<IPlanningRepository>;
  let mockItemRepo: jest.Mocked<IPlanningItemRepository>;
  let mockMilestoneRepo: jest.Mocked<IPlanningMilestoneRepository>;
  let mockDocumentRepo: jest.Mocked<IPlanningDocumentRepository>;
  let mockAuditService: jest.Mocked<PlanningAuditService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPlanningRepo = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as jest.Mocked<IPlanningRepository>;

    mockItemRepo = {
      findByPlanningId: vi.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<IPlanningItemRepository>;

    mockMilestoneRepo = {
      findByPlanningId: vi.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<IPlanningMilestoneRepository>;

    mockDocumentRepo = {
      findByPlanningId: vi.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<IPlanningDocumentRepository>;

    mockAuditService = {
      logChange: vi.fn(),
    } as unknown as jest.Mocked<PlanningAuditService>;

    service = new PlanningApprovalService(
      mockPlanningRepo,
      mockItemRepo,
      mockMilestoneRepo,
      mockDocumentRepo,
      mockAuditService,
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

      const result = await service.submit("plan-1", "user-1");

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "PENDING_APPROVAL",
          approvalLevel: 1,
          currentApprovalStep: 0,
        }),
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        "plan-1",
        "SUBMITTED",
        "user-1",
        expect.objectContaining({ approvalLevel: 1 }),
        expect.any(String),
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

      const result = await service.submit("plan-2", "user-1");

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-2",
        expect.objectContaining({
          approvalLevel: 2,
        }),
      );
      expect(result.approvalLevel).toBe(2);
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

      await expect(service.submit("plan-1", "user-1")).rejects.toThrow(
        "Planning cannot be submitted in status APPROVED",
      );
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

      const result = await service.approve("plan-1", "user-2", "Approved");

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "APPROVED",
          currentApprovalStep: 1,
        }),
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        "plan-1",
        "APPROVED",
        "user-2",
        expect.objectContaining({
          status: { from: "PENDING_APPROVAL", to: "APPROVED" },
          level: 1,
        }),
        "Approved",
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

      const result = await service.approve("plan-1", "user-2", "Level 1 OK");

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "APPROVED_LEVEL1",
          currentApprovalStep: 1,
        }),
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        "plan-1",
        "APPROVED",
        "user-2",
        expect.objectContaining({ level: 1 }),
        "Level 1 OK",
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
        "Final approval",
      );

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "APPROVED",
          currentApprovalStep: 2,
        }),
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        "plan-1",
        "APPROVED",
        "user-3",
        expect.objectContaining({
          status: { from: "APPROVED_LEVEL1", to: "APPROVED" },
          level: 2,
        }),
        "Final approval",
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

      const result = await service.reject("plan-1", "user-2", "Not feasible");

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "REJECTED",
          approvalNotes: "Not feasible",
        }),
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        "plan-1",
        "REJECTED",
        "user-2",
        expect.any(Object),
        "Not feasible",
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

      await expect(service.reject("plan-1", "user-2", "")).rejects.toThrow(
        "Rejection notes are required",
      );
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
        "Project cancelled",
      );

      expect(mockPlanningRepo.updateStatus).toHaveBeenCalledWith(
        "plan-1",
        expect.objectContaining({
          status: "CANCELLED",
          approvalNotes: "Project cancelled",
        }),
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

      await expect(service.cancel("plan-1", "user-3", "")).rejects.toThrow(
        "Cancellation notes are required",
      );
    });
  });
});
