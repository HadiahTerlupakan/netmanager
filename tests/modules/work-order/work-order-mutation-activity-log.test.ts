import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock(
  "@/modules/work-order/services/work-order-side-effects",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    invalidateWorkOrderCaches: vi.fn(),
    publishWorkOrderStatusSideEffects: vi.fn(),
  }),
);
vi.mock("@/modules/work-order/services/WorkOrderSyncService", () => ({
  syncWoStatusToTicket: vi.fn(),
}));

import { WorkOrderMutationService } from "@/modules/work-order/services/WorkOrderMutationService";

type FakeWorkOrder = {
  id: string;
  workOrderNumber: string;
  title: string;
  tenantId: string;
  status: string;
};

function createService(workOrder: FakeWorkOrder) {
  const repository = {
    findById: vi.fn().mockResolvedValue(workOrder),
    updateStatus: vi.fn(),
    complete: vi.fn(),
    delete: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn(),
  };
  const service = new WorkOrderMutationService({
    repository,
    userRepo: {},
    ticketRepo: {},
    warrantyRepo: {},
  } as never);
  return { service, repository };
}

const ADMIN = { id: "admin-1", isSuperAdmin: true };

function baseWorkOrder(status: string): FakeWorkOrder {
  return {
    id: "wo-1",
    workOrderNumber: "WO-20261015-0006",
    title: "Perbaikan Kabel Putus",
    tenantId: "tenant-1",
    status,
  };
}

function expectSingleActivity(
  action: string,
  details: Record<string, unknown> = {},
) {
  expect(logActivitySafe).toHaveBeenCalledTimes(1);
  expect(logActivitySafe).toHaveBeenCalledWith({
    action,
    subject: "Work Order WO-20261015-0006",
    userId: "admin-1",
    tenantId: "tenant-1",
    details: expect.objectContaining({
      workOrderId: "wo-1",
      workOrderNumber: "WO-20261015-0006",
      title: "Perbaikan Kabel Putus",
      ...details,
    }),
  });
}

describe("Log Aktivitas mutasi work order", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("mencatat verifikasi sebagai VERIFY bernomor WO", async () => {
    const { service } = createService(baseWorkOrder("COMPLETED"));

    const result = await service.updateStatus("wo-1", "VERIFIED", ADMIN);

    expect(result.success).toBe(true);
    expectSingleActivity("VERIFY", { from: "COMPLETED", to: "VERIFIED" });
  });

  it("mencatat tolak hasil pekerjaan beserta alasannya", async () => {
    const { service } = createService(baseWorkOrder("COMPLETED"));

    await service.updateStatus(
      "wo-1",
      "IN_PROGRESS",
      ADMIN,
      "Foto ODP tidak jelas",
    );

    expectSingleActivity("REJECT_RESULT", {
      from: "COMPLETED",
      to: "IN_PROGRESS",
      reason: "Foto ODP tidak jelas",
    });
  });

  it("mencatat pembatalan beserta alasannya", async () => {
    const { service } = createService(baseWorkOrder("PENDING"));

    await service.updateStatus("wo-1", "CANCELLED", ADMIN, "salah wo");

    expectSingleActivity("CANCEL", {
      from: "PENDING",
      to: "CANCELLED",
      reason: "salah wo",
    });
  });

  it("mencatat hapus permanen bernomor WO", async () => {
    const { service } = createService(baseWorkOrder("CANCELLED"));

    await service.deleteWorkOrder("wo-1", ADMIN);

    expectSingleActivity("DELETE");
  });

  it("mencatat persetujuan WO request", async () => {
    const { service } = createService(baseWorkOrder("REQUESTED"));

    await service.approveRequest("wo-1", ADMIN);

    expectSingleActivity("APPROVE_REQUEST");
  });

  it("mencatat penolakan WO request beserta alasannya", async () => {
    const { service } = createService(baseWorkOrder("REQUESTED"));

    await service.rejectRequest("wo-1", ADMIN, "double tiket");

    expectSingleActivity("REJECT_REQUEST", { reason: "double tiket" });
  });
});
