import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { PlanningAuditService } from "@/modules/planning/services/PlanningAuditService";
import type { IPlanningAuditLogRepository } from "@/modules/planning/services/../domain/ports/IPlanningAuditLogRepository";
import { PlanningAuditLogEntity } from "@/modules/planning/services/../domain/entities/PlanningAuditLogEntity";

describe("PlanningAuditService", () => {
  let service: PlanningAuditService;
  let mockAuditLogRepo: Mocked<IPlanningAuditLogRepository>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuditLogRepo = {
      findById: vi.fn(),
      findByPlanningId: vi.fn(),
      findByAction: vi.fn(),
      create: vi.fn(),
    } as unknown as Mocked<IPlanningAuditLogRepository>;

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

      const result = await service.logChange({
        planningId: "plan-1",
        tenantId: "tenant-1",
        action: "CREATED",
        performedById: "user-1",
        changes: { initial: { title: "Test" } },
        notes: null,
      });

      // tenantId diteruskan apa adanya dari rencana. Sebelumnya service
      // mengirim string kosong dengan harapan repository mengisinya — yang tidak
      // pernah terjadi, sehingga insert melanggar foreign key ke tabel Tenant.
      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        {
          planningId: "plan-1",
          tenantId: "tenant-1",
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

      const result = await service.logChange({
        planningId: "plan-2",
        tenantId: "tenant-1",
        action: "STATUS_CHANGED",
        performedById: null,
        changes: { status: "APPROVED" },
        notes: "System action",
      });

      expect(result.performedById).toBeNull();
    });

    it("should throw descriptive error on failure", async () => {
      mockAuditLogRepo.create.mockRejectedValue(new Error("Database error"));

      await expect(
        service.logChange({
          planningId: "plan-1",
          tenantId: "tenant-1",
          action: "CREATED",
          performedById: "user-1",
          changes: {},
          notes: null,
        }),
      ).rejects.toThrow(
        "Failed to create audit log for planning plan-1: Database error",
      );
    });

    // `changes` dan `notes` opsional; keduanya harus tersimpan sebagai null,
    // bukan undefined yang lolos ke kolom database.
    it("should default optional fields to null", async () => {
      const mockEntity = new PlanningAuditLogEntity({
        id: "audit-3",
        planningId: "plan-3",
        tenantId: "tenant-1",
        action: "ITEM_ADDED",
        performedById: "user-1",
        performedAt: new Date(),
        changes: null,
        notes: null,
      });

      mockAuditLogRepo.create.mockResolvedValue(mockEntity);

      await service.logChange({
        planningId: "plan-3",
        tenantId: "tenant-1",
        action: "ITEM_ADDED",
        performedById: "user-1",
      });

      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ changes: null, notes: null }),
        undefined,
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
