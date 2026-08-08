import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import type { IPlanningAuditLogRepository } from "@/modules/planning/services/../domain/ports/IPlanningAuditLogRepository";
import { PlanningAuditLogEntity } from "@/modules/planning/services/../domain/entities/PlanningAuditLogEntity";

describe("PlanningAuditService", () => {
  let service: PlanningAuditService;
  let mockAuditLogRepo: jest.Mocked<IPlanningAuditLogRepository>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuditLogRepo = {
      findById: vi.fn(),
      findByPlanningId: vi.fn(),
      findByAction: vi.fn(),
      create: vi.fn(),
    } as unknown as jest.Mocked<IPlanningAuditLogRepository>;

    service = new PlanningAuditService(mockAuditLogRepo);
  });

  describe("logChange", () => {
    it("should create audit log entry", async () => {
      const mockEntity = new PlanningAuditLogEntity({
        id: "audit-1",
        planningId: "plan-1",
        tenantId: "tenant-1",
        action: "CREATED",
        performedById: "user-1",
        performedAt: new Date(),
        changes: { initial: { title: "Test" } },
        notes: null,
      });

      mockAuditLogRepo.create.mockResolvedValue(mockEntity);

      const result = await service.logChange(
        "plan-1",
        "CREATED",
        "user-1",
        { initial: { title: "Test" } },
        null,
      );

      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        {
          planningId: "plan-1",
          tenantId: "",
          action: "CREATED",
          performedById: "user-1",
          changes: { initial: { title: "Test" } },
          notes: null,
        },
        undefined,
      );

      expect(result).toMatchObject({
        id: "audit-1",
        planningId: "plan-1",
        action: "CREATED",
      });
    });

    it("should handle null performedById", async () => {
      const mockEntity = new PlanningAuditLogEntity({
        id: "audit-2",
        planningId: "plan-2",
        tenantId: "tenant-1",
        action: "STATUS_CHANGED",
        performedById: null,
        performedAt: new Date(),
        changes: { status: "APPROVED" },
        notes: "System action",
      });

      mockAuditLogRepo.create.mockResolvedValue(mockEntity);

      const result = await service.logChange(
        "plan-2",
        "STATUS_CHANGED",
        null,
        { status: "APPROVED" },
        "System action",
      );

      expect(result.performedById).toBeNull();
    });

    it("should throw descriptive error on failure", async () => {
      mockAuditLogRepo.create.mockRejectedValue(new Error("Database error"));

      await expect(
        service.logChange("plan-1", "CREATED", "user-1", {}, null),
      ).rejects.toThrow(
        "Failed to create audit log for planning plan-1: Database error",
      );
    });
  });

  describe("getAuditHistory", () => {
    it("should return audit history with pagination", async () => {
      const mockEntities = [
        new PlanningAuditLogEntity({
          id: "audit-1",
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "CREATED",
          performedById: "user-1",
          performedAt: new Date(),
          changes: {},
          notes: null,
        }),
      ];

      mockAuditLogRepo.findByPlanningId.mockResolvedValue({
        items: mockEntities,
        total: 1,
      });

      const result = await service.getAuditHistory("plan-1", {
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockAuditLogRepo.findByPlanningId).toHaveBeenCalledWith("plan-1", {
        page: 1,
        limit: 10,
      });
    });
  });

  describe("getByAction", () => {
    it("should return audit logs filtered by action", async () => {
      const mockEntities = [
        new PlanningAuditLogEntity({
          id: "audit-1",
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "APPROVED",
          performedById: "user-1",
          performedAt: new Date(),
          changes: {},
          notes: null,
        }),
      ];

      mockAuditLogRepo.findByAction.mockResolvedValue(mockEntities);

      const result = await service.getByAction("plan-1", "APPROVED");

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("APPROVED");
    });
  });
});
