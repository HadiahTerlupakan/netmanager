import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  findMany: vi.fn(),
  sendWorkOrderReminder: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    workOrders: {
      findMany: mockFns.findMany,
    },
  },
}));

vi.mock("@/modules/work-order/services/WorkOrderNotifications", () => ({
  sendWorkOrderReminder: mockFns.sendWorkOrderReminder,
}));

import { runWorkOrderReminderCron } from "@/modules/work-order/services/WorkOrderReminderService";

describe("runWorkOrderReminderCron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends reminders for stale work orders with status-specific messages", async () => {
    const now = new Date("2026-03-10T10:00:00.000Z");
    mockFns.findMany.mockResolvedValue([
      {
        id: "wo-1",
        workOrderNumber: "WO-001",
        title: "Perbaiki koneksi",
        type: "TROUBLE",
        priority: "HIGH",
        status: "PENDING",
        departmentId: "dept-1",
        siteId: "site-1",
        assignedToId: null,
        createdAt: new Date("2026-03-09T08:00:00.000Z"),
      },
    ]);
    mockFns.sendWorkOrderReminder.mockResolvedValue(2);

    const result = await runWorkOrderReminderCron(now);

    expect(mockFns.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
        createdAt: { lte: new Date("2026-03-09T10:00:00.000Z") },
      },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        type: true,
        priority: true,
        status: true,
        departmentId: true,
        siteId: true,
        assignedToId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    expect(mockFns.sendWorkOrderReminder).toHaveBeenCalledWith(
      {
        id: "wo-1",
        workOrderNumber: "WO-001",
        title: "Perbaiki koneksi",
        type: "TROUBLE",
        priority: "HIGH",
        departmentId: "dept-1",
        siteId: "site-1",
        assignedToId: null,
      },
      "⏰ WO Menunggu 26 jam! WO-001 - Perbaiki koneksi",
    );
    expect(result).toEqual({
      timestamp: now.toISOString(),
      summary: {
        staleWorkOrders: 1,
        totalRemindersSent: 2,
      },
      details: [
        {
          workOrderId: "wo-1",
          workOrderNumber: "WO-001",
          status: "PENDING",
          ageHours: 26,
          sentCount: 2,
        },
      ],
    });
  });
});
