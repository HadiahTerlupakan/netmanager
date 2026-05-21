import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PayrollAuditService,
  type IAuditLogRepository,
} from "@/modules/salary-v2/workflow/audit/PayrollAuditService";
import type { PayrollAuditLog } from "@/modules/salary-v2/core";

function createMockRepository(): IAuditLogRepository {
  const logs: PayrollAuditLog[] = [];

  return {
    create: vi.fn(async (log: PayrollAuditLog) => {
      logs.push(log);
      return log;
    }),
    findAll: vi.fn(async () => logs),
    findByEntityId: vi.fn(async (entityId: string) =>
      logs.filter((l) => l.entityId === entityId),
    ),
  };
}

describe("PayrollAuditService", () => {
  let service: PayrollAuditService;
  let repo: IAuditLogRepository;

  beforeEach(() => {
    repo = createMockRepository();
    service = new PayrollAuditService(repo);
  });

  describe("log", () => {
    it("should create an audit log entry", async () => {
      const result = await service.log({
        tenantId: "tenant-1",
        entityType: "PAYROLL_RUN",
        entityId: "run-1",
        action: "CREATED",
        performedBy: "user-1",
        changes: [{ field: "status", oldValue: null, newValue: "DRAFT" }],
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe("tenant-1");
      expect(result.entityType).toBe("PAYROLL_RUN");
      expect(result.entityId).toBe("run-1");
      expect(result.action).toBe("CREATED");
      expect(result.performedBy).toBe("user-1");
      expect(result.changes).toHaveLength(1);
      expect(result.reason).toBeNull();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it("should include reason and ipAddress when provided", async () => {
      const result = await service.log({
        tenantId: "tenant-1",
        entityType: "PAYROLL_RUN",
        entityId: "run-1",
        action: "UNLOCKED",
        performedBy: "admin-1",
        changes: [
          { field: "lockedAt", oldValue: "2026-01-01", newValue: null },
        ],
        reason: "Need to fix overtime calculation",
        ipAddress: "192.168.1.1",
      });

      expect(result.reason).toBe("Need to fix overtime calculation");
      expect(result.ipAddress).toBe("192.168.1.1");
    });

    it("should throw if sensitive action has no reason", async () => {
      await expect(
        service.log({
          tenantId: "tenant-1",
          entityType: "PAYROLL_RUN",
          entityId: "run-1",
          action: "UNLOCKED",
          performedBy: "admin-1",
          changes: [],
        }),
      ).rejects.toThrow("Reason is required for sensitive action: UNLOCKED");
    });

    it("should throw if sensitive action has empty reason", async () => {
      await expect(
        service.log({
          tenantId: "tenant-1",
          entityType: "PAYROLL_RUN",
          entityId: "run-1",
          action: "DELETED",
          performedBy: "admin-1",
          changes: [],
          reason: "   ",
        }),
      ).rejects.toThrow("Reason is required for sensitive action: DELETED");
    });

    it("should throw for RECALCULATED without reason", async () => {
      await expect(
        service.log({
          tenantId: "tenant-1",
          entityType: "PAYROLL_ENTRY",
          entityId: "entry-1",
          action: "RECALCULATED",
          performedBy: "admin-1",
          changes: [],
        }),
      ).rejects.toThrow(
        "Reason is required for sensitive action: RECALCULATED",
      );
    });

    it("should allow non-sensitive actions without reason", async () => {
      const result = await service.log({
        tenantId: "tenant-1",
        entityType: "PAYROLL_RUN",
        entityId: "run-1",
        action: "UPDATED",
        performedBy: "user-1",
        changes: [{ field: "notes", oldValue: null, newValue: "Updated" }],
      });

      expect(result.reason).toBeNull();
    });
  });

  describe("computeChanges", () => {
    it("should detect changed fields", () => {
      const oldState = { name: "Alice", salary: 5000000, active: true };
      const newState = { name: "Alice", salary: 6000000, active: true };

      const changes = service.computeChanges(oldState, newState);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        field: "salary",
        oldValue: 5000000,
        newValue: 6000000,
      });
    });

    it("should detect multiple changes", () => {
      const oldState = { name: "Alice", salary: 5000000, active: true };
      const newState = { name: "Bob", salary: 6000000, active: false };

      const changes = service.computeChanges(oldState, newState);

      expect(changes).toHaveLength(3);
    });

    it("should return empty array when no changes", () => {
      const state = { name: "Alice", salary: 5000000 };
      const changes = service.computeChanges(state, state);

      expect(changes).toHaveLength(0);
    });

    it("should only check specified fields", () => {
      const oldState = { name: "Alice", salary: 5000000, active: true };
      const newState = { name: "Bob", salary: 6000000, active: false };

      const changes = service.computeChanges(oldState, newState, ["salary"]);

      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe("salary");
    });

    it("should handle null values", () => {
      const oldState = { notes: "hello" as string | null };
      const newState = { notes: null as string | null };

      const changes = service.computeChanges(oldState, newState);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        field: "notes",
        oldValue: "hello",
        newValue: null,
      });
    });

    it("should handle Date comparison", () => {
      const date = new Date("2026-01-01");
      const oldState = { createdAt: date };
      const newState = { createdAt: new Date("2026-01-01") };

      const changes = service.computeChanges(oldState, newState);

      expect(changes).toHaveLength(0);
    });
  });

  describe("logStatusChange", () => {
    it("should create a status change audit log", async () => {
      const result = await service.logStatusChange(
        "tenant-1",
        "PAYROLL_RUN",
        "run-1",
        "DRAFT",
        "CALCULATING",
        "user-1",
      );

      expect(result.action).toBe("STATUS_CHANGED");
      expect(result.changes).toEqual([
        { field: "status", oldValue: "DRAFT", newValue: "CALCULATING" },
      ]);
    });
  });

  describe("getEntityHistory", () => {
    it("should return audit logs for an entity", async () => {
      await service.log({
        tenantId: "tenant-1",
        entityType: "PAYROLL_RUN",
        entityId: "run-1",
        action: "CREATED",
        performedBy: "user-1",
        changes: [],
      });

      const history = await service.getEntityHistory("run-1", "tenant-1");

      expect(history).toHaveLength(1);
      expect(repo.findByEntityId).toHaveBeenCalledWith("run-1", "tenant-1");
    });
  });

  describe("query", () => {
    it("should query with filters", async () => {
      await service.query({
        tenantId: "tenant-1",
        action: "CREATED",
      });

      expect(repo.findAll).toHaveBeenCalledWith({
        tenantId: "tenant-1",
        action: "CREATED",
      });
    });
  });
});
