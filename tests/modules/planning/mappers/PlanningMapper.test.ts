import { describe, it, expect } from "vitest";
import { PlanningMapper } from "@/modules/planning/mappers/PlanningMapper";
import { PlanningEntity } from "@/modules/planning/domain/entities/PlanningEntity";
import { PlanningItemEntity } from "@/modules/planning/domain/entities/PlanningItemEntity";
import { PlanningMilestoneEntity } from "@/modules/planning/domain/entities/PlanningMilestoneEntity";
import { PlanningDocumentEntity } from "@/modules/planning/domain/entities/PlanningDocumentEntity";
import type { Planning } from "@prisma/client";
import type {
  CreatePlanningDTO,
  UpdatePlanningDTO,
} from "@/modules/planning/dto/PlanningDTO";

describe("PlanningMapper", () => {
  describe("toEntity", () => {
    it("should convert Prisma model to Entity", () => {
      const now = new Date();
      const prismaModel: Planning = {
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test Planning OSP",
        description: "Test description",
        area: "Jakarta Selatan",
        coordinates: { latitude: -6.2, longitude: 106.8 },
        estimatedUnits: 100,
        estimatedBudget: 50000000,
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
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      const entity = PlanningMapper.toEntity(prismaModel);

      expect(entity).toBeInstanceOf(PlanningEntity);
      expect(entity.id).toBe("plan-1");
      expect(entity.tenantId).toBe("tenant-1");
      expect(entity.title).toBe("Test Planning OSP");
      expect(entity.type).toBe("OSP");
      expect(entity.status).toBe("BACKLOG");
      expect(entity.area).toBe("Jakarta Selatan");
      expect(entity.estimatedUnits).toBe(100);
      expect(entity.estimatedBudget).toBe(50000000);
      expect(entity.coordinates).toEqual({ latitude: -6.2, longitude: 106.8 });
      expect(entity.createdAt).toBe(now);
    });

    it("should handle null fields correctly", () => {
      const now = new Date();
      const prismaModel: Planning = {
        id: "plan-2",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Minimal Planning",
        description: null,
        area: "Area",
        coordinates: null,
        estimatedUnits: 50,
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
        createdById: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      const entity = PlanningMapper.toEntity(prismaModel);

      expect(entity.description).toBeNull();
      expect(entity.coordinates).toBeNull();
      expect(entity.estimatedBudget).toBeNull();
      expect(entity.createdById).toBeNull();
    });
  });

  describe("toDTO", () => {
    it("should convert Entity to List DTO with ISO dates", () => {
      const now = new Date("2026-08-09T10:00:00Z");
      const startDate = new Date("2026-08-01T00:00:00Z");
      const targetDate = new Date("2026-12-31T00:00:00Z");

      const entity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test Planning",
        description: "Description",
        area: "Jakarta",
        coordinates: { latitude: -6.2, longitude: 106.8 },
        estimatedUnits: 100,
        estimatedBudget: 50000000,
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
        startDate,
        targetCompletionDate: targetDate,
        actualCompletionDate: null,
        createdById: "user-1",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      const dto = PlanningMapper.toDTO(entity);

      expect(dto.id).toBe("plan-1");
      expect(dto.title).toBe("Test Planning");
      expect(dto.status).toBe("BACKLOG");
      expect(dto.createdAt).toBe("2026-08-09T10:00:00.000Z");
      expect(dto.updatedAt).toBe("2026-08-09T10:00:00.000Z");
      expect(dto.startDate).toBe("2026-08-01T00:00:00.000Z");
      expect(dto.targetCompletionDate).toBe("2026-12-31T00:00:00.000Z");
      expect(dto.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO string format
    });

    it("should convert null dates to null in DTO", () => {
      const now = new Date();
      const entity = new PlanningEntity({
        id: "plan-2",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test",
        description: null,
        area: "Area",
        coordinates: null,
        estimatedUnits: 50,
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
        createdById: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      const dto = PlanningMapper.toDTO(entity);

      expect(dto.startDate).toBeNull();
      expect(dto.targetCompletionDate).toBeNull();
    });
  });

  describe("toDetailDTO", () => {
    it("should convert Entity to Detail DTO with relations", () => {
      const now = new Date("2026-08-09T10:00:00Z");
      const entity = new PlanningEntity({
        id: "plan-1",
        tenantId: "tenant-1",
        type: "OSP",
        title: "Test Planning",
        description: "Description",
        area: "Jakarta",
        coordinates: { latitude: -6.2, longitude: 106.8 },
        estimatedUnits: 100,
        estimatedBudget: 50000000,
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
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      const items: PlanningItemEntity[] = [
        new PlanningItemEntity({
          id: "item-1",
          planningId: "plan-1",
          tenantId: "tenant-1",
          name: "Kabel FO",
          description: null,
          quantity: 100,
          unit: "meter",
          estimatedPrice: 50000,
          actualPrice: null,
          notes: null,
          createdAt: now,
          updatedAt: now,
        }),
      ];

      const milestones: PlanningMilestoneEntity[] = [
        new PlanningMilestoneEntity({
          id: "milestone-1",
          planningId: "plan-1",
          tenantId: "tenant-1",
          name: "Survey Selesai",
          description: null,
          targetDate: new Date("2026-09-01T00:00:00Z"),
          actualDate: null,
          status: "PENDING",
          notes: null,
          createdAt: now,
          updatedAt: now,
        }),
      ];

      const documents: PlanningDocumentEntity[] = [
        new PlanningDocumentEntity({
          id: "doc-1",
          planningId: "plan-1",
          tenantId: "tenant-1",
          filename: "survey.jpg",
          fileUrl: "https://example.com/survey.jpg",
          fileSize: 1024000,
          mimeType: "image/jpeg",
          category: "SURVEY_PHOTO",
          description: null,
          uploadedById: "user-1",
          uploadedAt: now,
        }),
      ];

      const dto = PlanningMapper.toDetailDTO(entity, {
        items,
        milestones,
        documents,
      });

      expect(dto.id).toBe("plan-1");
      expect(dto.title).toBe("Test Planning");
      expect(dto.tenantId).toBe("tenant-1");
      expect(dto.description).toBe("Description");
      expect(dto.coordinates).toEqual({ latitude: -6.2, longitude: 106.8 });
      expect(dto.items).toHaveLength(1);
      expect(dto.items[0].name).toBe("Kabel FO");
      expect(dto.milestones).toHaveLength(1);
      expect(dto.milestones[0].name).toBe("Survey Selesai");
      expect(dto.documents).toHaveLength(1);
      expect(dto.documents[0].filename).toBe("survey.jpg");
    });
  });

  describe("toPrismaCreate", () => {
    it("should convert Create DTO to Prisma create input", () => {
      const dto: CreatePlanningDTO = {
        type: "OSP",
        title: "New Planning",
        description: "New description",
        area: "Jakarta Barat",
        coordinates: { latitude: -6.15, longitude: 106.8 },
        estimatedUnits: 150,
        estimatedBudget: 75000000,
        approvalLevel: 2,
        startDate: "2026-09-01T00:00:00Z",
        targetCompletionDate: "2026-12-31T00:00:00Z",
      };

      const prismaInput = PlanningMapper.toPrismaCreate(
        dto,
        "tenant-1",
        "user-1",
      );

      expect(prismaInput.tenantId).toBe("tenant-1");
      expect(prismaInput.type).toBe("OSP");
      expect(prismaInput.title).toBe("New Planning");
      expect(prismaInput.description).toBe("New description");
      expect(prismaInput.area).toBe("Jakarta Barat");
      expect(prismaInput.coordinates).toEqual({
        latitude: -6.15,
        longitude: 106.8,
      });
      expect(prismaInput.estimatedUnits).toBe(150);
      expect(prismaInput.estimatedBudget).toBe(75000000);
      expect(prismaInput.status).toBe("BACKLOG");
      expect(prismaInput.approvalLevel).toBe(2);
      expect(prismaInput.currentApprovalStep).toBe(0);
      expect(prismaInput.progressPercentage).toBe(0);
      expect(prismaInput.createdById).toBe("user-1");
      expect(prismaInput.startDate).toBeInstanceOf(Date);
      expect(prismaInput.targetCompletionDate).toBeInstanceOf(Date);
    });

    it("should handle optional fields with defaults", () => {
      const dto: CreatePlanningDTO = {
        type: "OSP",
        title: "Minimal Planning",
        area: "Area",
        estimatedUnits: 50,
      };

      const prismaInput = PlanningMapper.toPrismaCreate(
        dto,
        "tenant-1",
        "user-1",
      );

      expect(prismaInput.description).toBeNull();
      expect(prismaInput.coordinates).toBeNull();
      expect(prismaInput.estimatedBudget).toBeNull();
      expect(prismaInput.approvalLevel).toBe(1); // default
      expect(prismaInput.startDate).toBeNull();
      expect(prismaInput.targetCompletionDate).toBeNull();
    });
  });

  describe("toPrismaUpdate", () => {
    it("should convert Update DTO to Prisma update input", () => {
      const dto: UpdatePlanningDTO = {
        title: "Updated Title",
        description: "Updated description",
        area: "Updated Area",
        estimatedBudget: 100000000,
        progressPercentage: 50,
      };

      const prismaInput = PlanningMapper.toPrismaUpdate(dto);

      expect(prismaInput.title).toBe("Updated Title");
      expect(prismaInput.description).toBe("Updated description");
      expect(prismaInput.area).toBe("Updated Area");
      expect(prismaInput.estimatedBudget).toBe(100000000);
      expect(prismaInput.progressPercentage).toBe(50);
    });

    it("should only include provided fields", () => {
      const dto: UpdatePlanningDTO = {
        title: "Only Title",
      };

      const prismaInput = PlanningMapper.toPrismaUpdate(dto);

      expect(prismaInput.title).toBe("Only Title");
      expect(prismaInput.description).toBeUndefined();
      expect(prismaInput.area).toBeUndefined();
      expect(prismaInput.estimatedBudget).toBeUndefined();
    });

    it("should handle date string conversion", () => {
      const dto: UpdatePlanningDTO = {
        startDate: "2026-09-01T00:00:00Z",
        targetCompletionDate: "2026-12-31T00:00:00Z",
      };

      const prismaInput = PlanningMapper.toPrismaUpdate(dto);

      expect(prismaInput.startDate).toBeInstanceOf(Date);
      expect(prismaInput.targetCompletionDate).toBeInstanceOf(Date);
    });

    it("should handle null values", () => {
      const dto: UpdatePlanningDTO = {
        description: null,
        coordinates: null,
        startDate: null,
      };

      const prismaInput = PlanningMapper.toPrismaUpdate(dto);

      expect(prismaInput.description).toBeNull();
      expect(prismaInput.coordinates).toBeNull();
      expect(prismaInput.startDate).toBeNull();
    });
  });
});
