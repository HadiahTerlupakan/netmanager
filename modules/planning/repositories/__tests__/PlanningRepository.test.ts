import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PlanningRepository } from "../PlanningRepository";
import { prisma } from "@/lib/prisma";

describe("PlanningRepository Integration Tests", () => {
  const repository = new PlanningRepository();
  const testTenantId = `test-tenant-${Date.now()}`;
  const testUserId = `test-user-${Date.now()}`;
  const createdIds: string[] = [];

  beforeEach(async () => {
    // Clean up any existing test data
    await prisma.planning.deleteMany({
      where: { tenantId: testTenantId },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.planning.deleteMany({
      where: { tenantId: testTenantId },
    });
  });

  describe("create", () => {
    it("should create a new planning with default values", async () => {
      const data = {
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Test Planning OSP",
        description: "Test description",
        area: "Jakarta Selatan",
        estimatedUnits: 100,
        estimatedBudget: 50000000,
        approvalLevel: 2,
        createdById: testUserId,
      };

      const created = await repository.create(data);
      createdIds.push(created.id);

      expect(created).toBeDefined();
      expect(created.id).toBeTruthy();
      expect(created.title).toBe("Test Planning OSP");
      expect(created.status).toBe("BACKLOG");
      expect(created.currentApprovalStep).toBe(0);
      expect(created.progressPercentage).toBe(0);
      expect(created.tenantId).toBe(testTenantId);
    });

    it("should create planning with optional coordinates", async () => {
      const data = {
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Test Planning with Coordinates",
        area: "Jakarta Utara",
        estimatedUnits: 50,
        approvalLevel: 1,
        coordinates: {
          latitude: -6.2088,
          longitude: 106.8456,
        },
      };

      const created = await repository.create(data);
      createdIds.push(created.id);

      expect(created.coordinates).toBeDefined();
      expect(created.coordinates?.latitude).toBe(-6.2088);
      expect(created.coordinates?.longitude).toBe(106.8456);
    });
  });

  describe("findById", () => {
    it("should find planning by id", async () => {
      const created = await repository.create({
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Find By ID Test",
        area: "Tangerang",
        estimatedUnits: 75,
        approvalLevel: 1,
      });
      createdIds.push(created.id);

      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.title).toBe("Find By ID Test");
    });

    it("should return null for non-existent id", async () => {
      const found = await repository.findById("non-existent-id");
      expect(found).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should find all plannings with pagination", async () => {
      // Create multiple plannings
      for (let i = 1; i <= 3; i++) {
        const created = await repository.create({
          tenantId: testTenantId,
          type: "OSP" as const,
          title: `Planning ${i}`,
          area: "Jakarta",
          estimatedUnits: 10 * i,
          approvalLevel: 1,
        });
        createdIds.push(created.id);
      }

      const result = await repository.findAll({
        tenantId: testTenantId,
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("should filter by status", async () => {
      const created = await repository.create({
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Backlog Planning",
        area: "Jakarta",
        estimatedUnits: 50,
        approvalLevel: 1,
      });
      createdIds.push(created.id);

      const result = await repository.findAll({
        tenantId: testTenantId,
        status: "BACKLOG",
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.every((p) => p.status === "BACKLOG")).toBe(true);
    });

    it("should filter by area with case-insensitive search", async () => {
      const created = await repository.create({
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Jakarta Planning",
        area: "Jakarta Selatan",
        estimatedUnits: 50,
        approvalLevel: 1,
      });
      createdIds.push(created.id);

      const result = await repository.findAll({
        tenantId: testTenantId,
        area: "jakarta",
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].area).toContain("Jakarta");
    });
  });

  describe("findByStatus", () => {
    it("should find plannings by status", async () => {
      const created = await repository.create({
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Status Test",
        area: "Bekasi",
        estimatedUnits: 30,
        approvalLevel: 1,
      });
      createdIds.push(created.id);

      const plannings = await repository.findByStatus("BACKLOG", testTenantId);

      expect(plannings.length).toBeGreaterThan(0);
      expect(plannings.every((p) => p.status === "BACKLOG")).toBe(true);
    });
  });

  describe("findPendingApproval", () => {
    it("should find plannings pending approval", async () => {
      const created = await repository.create({
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Pending Approval Test",
        area: "Bogor",
        estimatedUnits: 40,
        approvalLevel: 2,
      });
      createdIds.push(created.id);

      // Update status to PENDING_APPROVAL
      await repository.updateStatus(created.id, {
        status: "PENDING_APPROVAL",
        currentApprovalStep: 1,
        submittedAt: new Date(),
        submittedById: testUserId,
      });

      const pending = await repository.findPendingApproval(testTenantId);

      expect(pending.length).toBeGreaterThan(0);
      expect(pending.some((p) => p.status === "PENDING_APPROVAL")).toBe(true);
    });
  });

  describe("findByCreatedBy", () => {
    it("should find plannings created by specific user", async () => {
      const created = await repository.create({
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "User Planning",
        area: "Depok",
        estimatedUnits: 60,
        approvalLevel: 1,
        createdById: testUserId,
      });
      createdIds.push(created.id);

      const plannings = await repository.findByCreatedBy(
        testUserId,
        testTenantId,
      );

      expect(plannings.length).toBeGreaterThan(0);
      expect(plannings.every((p) => p.createdById === testUserId)).toBe(true);
    });
  });

  describe("update", () => {
    it("should update planning data", async () => {
      const created = await repository.create({
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Original Title",
        area: "Original Area",
        estimatedUnits: 100,
        approvalLevel: 1,
      });
      createdIds.push(created.id);

      const updated = await repository.update(created.id, {
        title: "Updated Title",
        area: "Updated Area",
        estimatedBudget: 100000000,
        progressPercentage: 25,
      });

      expect(updated.title).toBe("Updated Title");
      expect(updated.area).toBe("Updated Area");
      expect(updated.estimatedBudget).toBe(100000000);
      expect(updated.progressPercentage).toBe(25);
    });
  });

  describe("updateStatus", () => {
    it("should update planning status and approval fields", async () => {
      const created = await repository.create({
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Status Update Test",
        area: "Jakarta",
        estimatedUnits: 50,
        approvalLevel: 2,
      });
      createdIds.push(created.id);

      const submittedAt = new Date();
      const updated = await repository.updateStatus(created.id, {
        status: "PENDING_APPROVAL",
        currentApprovalStep: 1,
        submittedAt,
        submittedById: testUserId,
      });

      expect(updated.status).toBe("PENDING_APPROVAL");
      expect(updated.currentApprovalStep).toBe(1);
      expect(updated.submittedById).toBe(testUserId);
      expect(updated.submittedAt).toBeInstanceOf(Date);
    });

    it("should update to approved status", async () => {
      const created = await repository.create({
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Approval Test",
        area: "Jakarta",
        estimatedUnits: 50,
        approvalLevel: 1,
      });
      createdIds.push(created.id);

      const approvedAt = new Date();
      const updated = await repository.updateStatus(created.id, {
        status: "APPROVED",
        approvedAt,
        approvedById: testUserId,
        approvalNotes: "Approved for execution",
      });

      expect(updated.status).toBe("APPROVED");
      expect(updated.approvedById).toBe(testUserId);
      expect(updated.approvalNotes).toBe("Approved for execution");
    });
  });

  describe("delete (soft delete)", () => {
    it("should soft delete planning by setting deletedAt", async () => {
      const created = await repository.create({
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Delete Test",
        area: "Jakarta",
        estimatedUnits: 50,
        approvalLevel: 1,
      });
      createdIds.push(created.id);

      await repository.delete(created.id);

      const found = await repository.findById(created.id);
      expect(found?.deletedAt).toBeInstanceOf(Date);
    });

    it("should not include soft-deleted plannings in findAll", async () => {
      const created = await repository.create({
        tenantId: testTenantId,
        type: "OSP" as const,
        title: "Soft Delete Test",
        area: "Jakarta",
        estimatedUnits: 50,
        approvalLevel: 1,
      });
      createdIds.push(created.id);

      await repository.delete(created.id);

      const result = await repository.findAll({
        tenantId: testTenantId,
      });

      expect(result.items.some((p) => p.id === created.id)).toBe(false);
    });
  });

  describe("transaction support", () => {
    it("should support transaction parameter", async () => {
      await prisma.$transaction(async (tx) => {
        const created = await repository.create(
          {
            tenantId: testTenantId,
            type: "OSP" as const,
            title: "Transaction Test",
            area: "Jakarta",
            estimatedUnits: 50,
            approvalLevel: 1,
          },
          tx,
        );

        createdIds.push(created.id);

        const updated = await repository.update(
          created.id,
          {
            title: "Updated in Transaction",
          },
          tx,
        );

        expect(updated.title).toBe("Updated in Transaction");
      });
    });
  });
});
