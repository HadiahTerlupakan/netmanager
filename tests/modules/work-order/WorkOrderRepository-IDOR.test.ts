import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../setup";
import { WorkOrderRepository } from "@/modules/work-order/repositories/WorkOrderRepository";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import {
  WorkOrderType,
  type PrismaClient,
  type WorkOrders,
} from "@prisma/client";

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: vi.fn(),
}));

describe("WorkOrderRepository - IDOR Protection", () => {
  let repository: WorkOrderRepository;

  beforeEach(() => {
    repository = new WorkOrderRepository(prismaMock as unknown as PrismaClient);
    vi.clearAllMocks();
  });

  it("should isolate findById by tenantId", async () => {
    // Setup: Context has tenant-A
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-A",
      isSuperAdmin: false,
    });

    // Action
    await repository.findById("wo-123");

    // Verify: Query must include tenantId filter
    expect(prismaMock.workOrders.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "wo-123",
          tenantId: "tenant-A",
        }),
      }),
    );
  });

  it("should allow SuperAdmin to bypass tenant isolation in findById", async () => {
    // Setup: Context is SuperAdmin
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: null,
      isSuperAdmin: true,
    });

    // Action
    await repository.findById("wo-123");

    // Verify: Query should NOT have tenantId filter
    expect(prismaMock.workOrders.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wo-123" },
      }),
    );
  });

  it("should prevent deleting WO from another tenant", async () => {
    // Setup: Context has tenant-A
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-A",
      isSuperAdmin: false,
    });

    // Mock deleteMany to return 0 counts (meaning nothing matched the filter)
    prismaMock.workOrders.deleteMany.mockResolvedValue({ count: 0 });

    // Action & Verify
    await expect(repository.delete("wo-other-tenant")).rejects.toThrow(
      "Work order not found or access denied",
    );

    expect(prismaMock.workOrders.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "wo-other-tenant",
          tenantId: "tenant-A",
        },
      }),
    );
  });

  it("should persist tenantId from context when creating a work order", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-A",
      isSuperAdmin: false,
    });
    prismaMock.workOrders.findFirst.mockResolvedValueOnce(null);
    prismaMock.workOrders.create.mockResolvedValue({
      id: "wo-new",
      workOrderNumber: "WO-20260412-0001",
      type: WorkOrderType.INSTALLATION,
      title: "Test WO",
      description: "Test description",
      status: "PENDING",
      priority: "NORMAL",
      tenantId: "tenant-A",
      departmentId: null,
      siteId: null,
      assignedToId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as WorkOrders);

    await repository.create({
      type: WorkOrderType.INSTALLATION,
      title: "Test WO",
      description: "Test description",
    });

    expect(prismaMock.workOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-A",
        }),
      }),
    );
  });

  it("should persist tenantId from context when creating a mobile work order request", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-A",
      isSuperAdmin: false,
    });
    prismaMock.workOrders.findFirst.mockResolvedValueOnce(null);
    prismaMock.workOrders.create.mockResolvedValue({
      id: "wo-request",
      workOrderNumber: "WO-20260412-0002",
      type: WorkOrderType.INSTALLATION,
      title: "Request WO",
      description: "Request description",
      status: "REQUESTED",
      priority: "NORMAL",
      tenantId: "tenant-A",
      departmentId: null,
      siteId: null,
      assignedToId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as WorkOrders);

    await repository.createRequest({
      type: WorkOrderType.INSTALLATION,
      title: "Request WO",
      description: "Request description",
      requestedById: "user-1",
    });

    expect(prismaMock.workOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-A",
        }),
      }),
    );
  });

  it("should isolate sub-resource additions (addTask) to parent tenant", async () => {
    // Setup: Context has tenant-A
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-A",
      isSuperAdmin: false,
    });

    // Mock parent lookup: parent WO not found in tenant-A
    prismaMock.workOrders.findFirst.mockResolvedValue(null);

    // Action & Verify
    await expect(
      repository.addTask({
        workOrderId: "wo-other",
        title: "Malicious Task",
      }),
    ).rejects.toThrow("Work order not found or access denied");

    expect(prismaMock.workOrders.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wo-other", tenantId: "tenant-A" },
      }),
    );
  });

  it("should isolate sub-resource deletions (deleteAttachment) to parent tenant", async () => {
    // Setup: Context has tenant-A
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-A",
      isSuperAdmin: false,
    });

    // Mock attachment lookup: not found in tenant-A
    prismaMock.workOrderAttachments.findFirst.mockResolvedValue(null);

    // Action & Verify
    await expect(repository.deleteAttachment("att-other")).rejects.toThrow(
      "Attachment not found or access denied",
    );

    expect(prismaMock.workOrderAttachments.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att-other", workOrders: { tenantId: "tenant-A" } },
      }),
    );
  });

  it("should isolate assign to the current tenant", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-A",
      isSuperAdmin: false,
    });
    prismaMock.workOrders.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.workOrderAssignments.create.mockResolvedValue({
      id: "assign-1",
      workOrderId: "wo-1",
      userId: "user-1",
      role: "Lead",
    } as never);
    prismaMock.workOrders.findFirst.mockResolvedValue({
      id: "wo-1",
      tenantId: "tenant-A",
      assignedToId: "user-1",
      status: "ASSIGNED",
    } as unknown as WorkOrders);

    await repository.assign("wo-1", "user-1", "Lead");

    expect(prismaMock.workOrders.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wo-1", tenantId: "tenant-A" },
      }),
    );
  });
});
