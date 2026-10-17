import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe, sendWorkOrderReminder, updateStatus } = vi.hoisted(
  () => ({
    logActivitySafe: vi.fn(),
    sendWorkOrderReminder: vi.fn(),
    updateStatus: vi.fn(),
  }),
);
vi.mock("@/lib/logger", () => ({
  logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/modules/work-order/services/WorkOrderNotifications", () => ({
  sendWorkOrderReminder,
}));
vi.mock("@/modules/work-order/services/WorkOrderService", () => ({
  getWorkOrderService: () => ({ updateStatus }),
}));
vi.mock("@/modules/work-order/services/WorkOrderCacheService", () => ({
  workOrderCacheService: { invalidateAllCaches: vi.fn() },
}));

import { AdminWorkOrderActionRouteService } from "@/modules/work-order/services/AdminWorkOrderActionRouteService";

const REMINDER_WORK_ORDER = {
  id: "wo-1",
  workOrderNumber: "WO-20261015-0006",
  title: "Perbaikan Kabel Putus",
  tenantId: "tenant-1",
  type: "MAINTENANCE",
  priority: "NORMAL",
  status: "IN_PROGRESS",
  departmentId: "dept-default",
  siteId: "site-1",
  assignedToId: "tech-1",
};

function createService() {
  const repository = {
    findReminderWorkOrderById: vi.fn().mockResolvedValue(REMINDER_WORK_ORDER),
  };
  const getUserContext = vi.fn().mockResolvedValue({ id: "admin-1" });
  return new AdminWorkOrderActionRouteService(
    repository as never,
    getUserContext,
  );
}

describe("Log Aktivitas aksi admin work order", () => {
  beforeEach(() => {
    logActivitySafe.mockReset();
    sendWorkOrderReminder.mockReset();
    updateStatus.mockReset();
  });

  it("mencatat kirim reminder beserta departemen dan jumlah penerima", async () => {
    sendWorkOrderReminder.mockResolvedValue(3);

    const result = await createService().sendReminder({
      workOrderId: "wo-1",
      targetDepartmentId: "dept-noc",
      actorId: "admin-1",
    });

    expect(result).toEqual({ success: true, data: { sentCount: 3 } });
    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "SEND_REMINDER",
      subject: "Work Order WO-20261015-0006",
      userId: "admin-1",
      tenantId: "tenant-1",
      details: {
        workOrderId: "wo-1",
        workOrderNumber: "WO-20261015-0006",
        title: "Perbaikan Kabel Putus",
        departmentId: "dept-noc",
        sentCount: 3,
      },
    });
  });

  it("tidak menulis log tambahan saat membatalkan WO", async () => {
    updateStatus.mockResolvedValue({ success: true, data: { id: "wo-1" } });

    await createService().deleteWorkOrder({
      workOrderId: "wo-1",
      reason: "salah wo",
      actor: { id: "admin-1" },
    });

    expect(updateStatus).toHaveBeenCalledWith(
      "wo-1",
      "CANCELLED",
      { id: "admin-1" },
      "salah wo",
    );
    expect(logActivitySafe).not.toHaveBeenCalled();
  });
});
