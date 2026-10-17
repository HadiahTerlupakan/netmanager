import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/modules/notification", () => ({ createNotification: vi.fn() }));

import { logLeaveMutation } from "@/modules/attendance/services/leave-lifecycle.helpers";
import { LeaveNotificationService } from "@/modules/attendance/services/LeaveNotificationService";

describe("Log Aktivitas keputusan izin", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("mencatat keputusan otomatis cron sebagai pelaku sistem beserta tenant", () => {
    logLeaveMutation(new LeaveNotificationService(), {
      action: "UPDATE",
      userId: "SYSTEM_AUTO",
      tenantId: "tenant-1",
      details: { id: "leave-1", status: "APPROVED" },
    });

    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "UPDATE",
      subject: "LeaveRequest",
      actor: { type: "system", id: "SYSTEM_AUTO" },
      tenantId: "tenant-1",
      details: { id: "leave-1", status: "APPROVED" },
    });
  });

  it("tetap mencatat keputusan admin dengan userId", () => {
    logLeaveMutation(new LeaveNotificationService(), {
      action: "UPDATE",
      userId: "admin-1",
      tenantId: "tenant-1",
      details: { id: "leave-1", status: "REJECTED" },
    });

    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "UPDATE",
      subject: "LeaveRequest",
      userId: "admin-1",
      tenantId: "tenant-1",
      details: { id: "leave-1", status: "REJECTED" },
    });
  });
});
