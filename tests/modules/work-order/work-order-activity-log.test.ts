import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  WORK_ORDER_ACTIVITY_ACTIONS,
  describeWorkOrderStatusActivity,
  recordWorkOrderActivity,
  recordWorkOrderExport,
} from "@/modules/work-order/services/work-order-activity-log";

const WORK_ORDER = {
  id: "wo-1",
  workOrderNumber: "WO-20261015-0006",
  title: "Perbaikan Kabel Putus",
  tenantId: "tenant-1",
};

describe("recordWorkOrderActivity", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("menulis subjek bernomor WO beserta identitas WO dan tenant", () => {
    recordWorkOrderActivity({
      action: WORK_ORDER_ACTIVITY_ACTIONS.VERIFY,
      workOrder: WORK_ORDER,
      actorId: "user-1",
      details: { from: "COMPLETED", to: "VERIFIED" },
    });

    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "VERIFY",
      subject: "Work Order WO-20261015-0006",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        workOrderId: "wo-1",
        workOrderNumber: "WO-20261015-0006",
        title: "Perbaikan Kabel Putus",
        from: "COMPLETED",
        to: "VERIFIED",
      },
    });
  });

  it("tetap mencatat WO tanpa tenant dan judul", () => {
    recordWorkOrderActivity({
      action: WORK_ORDER_ACTIVITY_ACTIONS.DELETE,
      workOrder: { id: "wo-2", workOrderNumber: "WO-2" },
      actorId: "user-1",
    });

    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "DELETE",
      subject: "Work Order WO-2",
      userId: "user-1",
      tenantId: undefined,
      details: { workOrderId: "wo-2", workOrderNumber: "WO-2" },
    });
  });
});

describe("describeWorkOrderStatusActivity", () => {
  it("menamai verifikasi", () => {
    expect(
      describeWorkOrderStatusActivity({
        previousStatus: "COMPLETED",
        status: "VERIFIED",
      }),
    ).toEqual({
      action: "VERIFY",
      details: { from: "COMPLETED", to: "VERIFIED" },
    });
  });

  it("menamai penolakan hasil pekerjaan beserta alasannya", () => {
    expect(
      describeWorkOrderStatusActivity({
        previousStatus: "COMPLETED",
        status: "IN_PROGRESS",
        note: "Foto ODP tidak jelas",
      }),
    ).toEqual({
      action: "REJECT_RESULT",
      details: {
        from: "COMPLETED",
        to: "IN_PROGRESS",
        reason: "Foto ODP tidak jelas",
      },
    });
  });

  it("menamai pembatalan beserta alasannya", () => {
    expect(
      describeWorkOrderStatusActivity({
        previousStatus: "PENDING",
        status: "CANCELLED",
        note: "salah wo",
      }),
    ).toEqual({
      action: "CANCEL",
      details: { from: "PENDING", to: "CANCELLED", reason: "salah wo" },
    });
  });

  it("menyimpan catatan penyelesaian pada perubahan status lain", () => {
    expect(
      describeWorkOrderStatusActivity({
        previousStatus: "IN_PROGRESS",
        status: "COMPLETED",
        note: "Kabel diganti",
      }),
    ).toEqual({
      action: "STATUS_CHANGE",
      details: { from: "IN_PROGRESS", to: "COMPLETED", note: "Kabel diganti" },
    });
  });
});

describe("recordWorkOrderExport", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("mencatat unduhan PDF beserta jumlah dan filter", () => {
    recordWorkOrderExport({
      format: "PDF",
      actorId: "user-1",
      tenantId: "tenant-1",
      exportedCount: 120,
      total: 135,
      filters: ["Status: Selesai"],
    });

    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "EXPORT_PDF",
      subject: "Work Order Daftar",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        format: "PDF",
        exportedCount: 120,
        total: 135,
        filters: ["Status: Selesai"],
      },
    });
  });
});
