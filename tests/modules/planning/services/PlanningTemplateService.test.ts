import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { PlanningTemplateService } from "@/modules/planning/services/PlanningTemplateService";
import type { IPlanningTemplateRepository } from "@/modules/planning/domain/ports/IPlanningTemplateRepository";
import type { IPlanningTemplateItemRepository } from "@/modules/planning/domain/ports/IPlanningTemplateItemRepository";
import type { IPlanningRepository } from "@/modules/planning/domain/ports/IPlanningRepository";
import type { IPlanningItemRepository } from "@/modules/planning/domain/ports/IPlanningItemRepository";
import type { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import { PlanningTemplateEntity } from "@/modules/planning/domain/entities/PlanningTemplateEntity";
import { PlanningTemplateItemEntity } from "@/modules/planning/domain/entities/PlanningTemplateItemEntity";
import { PlanningEntity } from "@/modules/planning/domain/entities/PlanningEntity";
import { PlanningItemEntity } from "@/modules/planning/domain/entities/PlanningItemEntity";

describe("PlanningTemplateService", () => {
  let service: PlanningTemplateService;
  let mockTemplateRepo: Mocked<IPlanningTemplateRepository>;
  let mockTemplateItemRepo: Mocked<IPlanningTemplateItemRepository>;
  let mockPlanningRepo: Mocked<IPlanningRepository>;
  let mockItemRepo: Mocked<IPlanningItemRepository>;
  let mockAuditService: Mocked<PlanningAuditService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTemplateRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findActive: vi.fn(),
      findByType: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<IPlanningTemplateRepository>;

    mockTemplateItemRepo = {
      findByTemplateId: vi.fn(),
      create: vi.fn(),
      deleteByTemplateId: vi.fn(),
    } as unknown as Mocked<IPlanningTemplateItemRepository>;

    mockPlanningRepo = {
      create: vi.fn(),
    } as unknown as Mocked<IPlanningRepository>;

    mockItemRepo = {
      // applyTemplate menyalin item template ke PlanningItem, jadi mock ini
      // harus mengembalikan entity yang bisa dipetakan ke DTO.
      create: vi.fn(
        async (data) =>
          new PlanningItemEntity({
            id: `pi-${data.name}`,
            planningId: data.planningId,
            tenantId: data.tenantId,
            name: data.name,
            description: data.description ?? null,
            quantity: data.quantity,
            unit: data.unit,
            estimatedPrice: data.estimatedPrice ?? null,
            actualPrice: data.actualPrice ?? null,
            notes: data.notes ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
      ),
    } as unknown as Mocked<IPlanningItemRepository>;

    mockAuditService = {
      logChange: vi.fn(),
    } as unknown as Mocked<PlanningAuditService>;

    service = new PlanningTemplateService(
      mockTemplateRepo,
      mockTemplateItemRepo,
      mockPlanningRepo,
      mockItemRepo,
      mockAuditService,
    );
  });

  describe("create", () => {
    it("should create template with items", async () => {
      const mockTemplateEntity = new PlanningTemplateEntity({
        id: "template-1",
        tenantId: "tenant-1",
        name: "OSP Standard",
        description: "Standard OSP template",
        type: "OSP",
        isActive: true,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockItemEntity = new PlanningTemplateItemEntity({
        id: "item-1",
        templateId: "template-1",
        tenantId: "tenant-1",
        name: "Fiber Cable",
        description: null,
        quantity: 100,
        unit: "meter",
        estimatedPrice: 50000,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTemplateRepo.create.mockResolvedValue(mockTemplateEntity);
      mockTemplateItemRepo.create.mockResolvedValue(mockItemEntity);

      const result = await service.create(
        {
          name: "OSP Standard",
          description: "Standard OSP template",
          type: "OSP",
          isActive: true,
          items: [
            {
              name: "Fiber Cable",
              description: null,
              quantity: 100,
              unit: "meter",
              estimatedPrice: 50000,
            },
          ],
        },
        "tenant-1",
        "user-1",
      );

      expect(mockTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "OSP Standard",
          type: "OSP",
        }),
      );
      expect(mockTemplateItemRepo.create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe("template-1");
      expect(result.items).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("should update template without items", async () => {
      const existingEntity = new PlanningTemplateEntity({
        id: "template-1",
        tenantId: "tenant-1",
        name: "Old Name",
        description: "Old description",
        type: "OSP",
        isActive: true,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updatedEntity = new PlanningTemplateEntity({
        ...existingEntity,
        name: "New Name",
      });

      mockTemplateRepo.findById.mockResolvedValue(existingEntity);
      mockTemplateRepo.update.mockResolvedValue(updatedEntity);
      mockTemplateItemRepo.findByTemplateId.mockResolvedValue([]);

      const result = await service.update(
        "template-1",
        { name: "New Name" },
        "user-1",
      );

      expect(mockTemplateRepo.update).toHaveBeenCalled();
      expect(mockTemplateItemRepo.deleteByTemplateId).not.toHaveBeenCalled();
      expect(result.name).toBe("New Name");
    });

    it("should update template with new items", async () => {
      const existingEntity = new PlanningTemplateEntity({
        id: "template-1",
        tenantId: "tenant-1",
        name: "OSP Standard",
        description: null,
        type: "OSP",
        isActive: true,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockItemEntity = new PlanningTemplateItemEntity({
        id: "item-2",
        templateId: "template-1",
        tenantId: "tenant-1",
        name: "New Item",
        description: null,
        quantity: 50,
        unit: "pcs",
        estimatedPrice: 10000,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTemplateRepo.findById.mockResolvedValue(existingEntity);
      mockTemplateRepo.update.mockResolvedValue(existingEntity);
      mockTemplateItemRepo.deleteByTemplateId.mockResolvedValue(undefined);
      mockTemplateItemRepo.create.mockResolvedValue(mockItemEntity);

      const result = await service.update(
        "template-1",
        {
          items: [
            {
              name: "New Item",
              description: null,
              quantity: 50,
              unit: "pcs",
              estimatedPrice: 10000,
            },
          ],
        },
        "user-1",
      );

      expect(mockTemplateItemRepo.deleteByTemplateId).toHaveBeenCalledWith(
        "template-1",
      );
      expect(mockTemplateItemRepo.create).toHaveBeenCalledTimes(1);
      expect(result.items).toHaveLength(1);
    });
  });

  describe("delete", () => {
    it("should delete template and its items", async () => {
      const existingEntity = new PlanningTemplateEntity({
        id: "template-1",
        tenantId: "tenant-1",
        name: "OSP Standard",
        description: null,
        type: "OSP",
        isActive: true,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTemplateRepo.findById.mockResolvedValue(existingEntity);
      mockTemplateItemRepo.deleteByTemplateId.mockResolvedValue(undefined);
      mockTemplateRepo.delete.mockResolvedValue(undefined);

      await service.delete("template-1", "user-1");

      expect(mockTemplateItemRepo.deleteByTemplateId).toHaveBeenCalledWith(
        "template-1",
      );
      expect(mockTemplateRepo.delete).toHaveBeenCalledWith("template-1");
    });
  });

  describe("applyTemplate", () => {
    it("should create planning from template with approval level 1", async () => {
      const mockTemplate = new PlanningTemplateEntity({
        id: "template-1",
        tenantId: "tenant-1",
        name: "OSP Standard",
        description: null,
        type: "OSP",
        isActive: true,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockItems = [
        new PlanningTemplateItemEntity({
          id: "item-1",
          templateId: "template-1",
          tenantId: "tenant-1",
          name: "Fiber Cable",
          description: null,
          quantity: 100,
          unit: "meter",
          estimatedPrice: 50000, // Total: 5,000,000
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      const mockPlanning = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "New Planning from Template",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 100,
        estimatedBudget: 5_000_000,
        actualBudget: null,
        status: "BACKLOG",
        approvalLevel: 1, // < 500M
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

      mockTemplateRepo.findById.mockResolvedValue(mockTemplate);
      mockTemplateItemRepo.findByTemplateId.mockResolvedValue(mockItems);
      mockPlanningRepo.create.mockResolvedValue(mockPlanning);

      const result = await service.applyTemplate(
        "template-1",
        {
          title: "New Planning from Template",
          area: "Jakarta",
          estimatedUnits: 100,
        },
        "tenant-1",
        "user-1",
      );

      expect(mockPlanningRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New Planning from Template",
          estimatedBudget: 5_000_000,
          approvalLevel: 1,
        }),
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        "plan-1",
        "CREATED",
        "user-1",
        expect.objectContaining({
          approvalLevel: 1,
          createdFromTemplate: "template-1",
          templateName: "OSP Standard",
        }),
        expect.stringContaining(
          'Planning created from template "OSP Standard"',
        ),
      );
      expect(result.id).toBe("plan-1");
    });

    it("should create planning from template with approval level 2", async () => {
      const mockTemplate = new PlanningTemplateEntity({
        id: "template-1",
        tenantId: "tenant-1",
        name: "Large OSP",
        description: null,
        type: "OSP",
        isActive: true,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockItems = [
        new PlanningTemplateItemEntity({
          id: "item-1",
          templateId: "template-1",
          tenantId: "tenant-1",
          name: "Expensive Equipment",
          description: null,
          quantity: 10,
          unit: "unit",
          estimatedPrice: 60_000_000, // Total: 600M
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      const mockPlanning = new PlanningEntity({
        id: "plan-2",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Large Planning",
        description: null,
        area: "Jakarta",
        coordinates: null,
        estimatedUnits: 500,
        estimatedBudget: 600_000_000,
        actualBudget: null,
        status: "BACKLOG",
        approvalLevel: 2, // >= 500M
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

      mockTemplateRepo.findById.mockResolvedValue(mockTemplate);
      mockTemplateItemRepo.findByTemplateId.mockResolvedValue(mockItems);
      mockPlanningRepo.create.mockResolvedValue(mockPlanning);

      const result = await service.applyTemplate(
        "template-1",
        {
          title: "Large Planning",
          area: "Jakarta",
          estimatedUnits: 500,
        },
        "tenant-1",
        "user-1",
      );

      expect(mockPlanningRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedBudget: 600_000_000,
          approvalLevel: 2,
        }),
      );
      expect(mockAuditService.logChange).toHaveBeenCalledWith(
        "plan-2",
        "CREATED",
        "user-1",
        expect.objectContaining({
          approvalLevel: 2,
          createdFromTemplate: "template-1",
          templateName: "Large OSP",
        }),
        expect.stringContaining('Planning created from template "Large OSP"'),
      );
      expect(result.approvalLevel).toBe(2);
    });

    it("should throw error when template is inactive", async () => {
      const inactiveTemplate = new PlanningTemplateEntity({
        id: "template-1",
        tenantId: "tenant-1",
        name: "Inactive Template",
        description: null,
        type: "OSP",
        isActive: false,
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTemplateRepo.findById.mockResolvedValue(inactiveTemplate);

      await expect(
        service.applyTemplate(
          "template-1",
          {
            title: "Test",
            area: "Jakarta",
            estimatedUnits: 100,
          },
          "tenant-1",
          "user-1",
        ),
      ).rejects.toThrow(
        "Planning template template-1 is inactive and cannot be used",
      );
    });
  });

  describe("getActiveTemplates", () => {
    it("should return only active templates", async () => {
      const mockTemplates = [
        new PlanningTemplateEntity({
          id: "template-1",
          tenantId: "tenant-1",
          name: "Active Template",
          description: null,
          type: "OSP",
          isActive: true,
          createdById: "user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      mockTemplateRepo.findActive.mockResolvedValue(mockTemplates);

      const result = await service.getActiveTemplates("tenant-1");

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });
  });
});
