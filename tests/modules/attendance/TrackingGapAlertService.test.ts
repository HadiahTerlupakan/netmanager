import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  findActiveTenantIds: vi.fn(),
  getLiveLocationsForTenant: vi.fn(),
  createNotification: vi.fn(),
  acquireReminderLock: vi.fn(),
  releaseReminderLock: vi.fn(),
}));

vi.mock("@/modules/attendance/repositories/TenantSettingsRepository", () => ({
  TenantSettingsRepository: {
    findActiveTenantIds: mockFns.findActiveTenantIds,
  },
}));

vi.mock("@/modules/attendance/services/LocationLiveMapService", () => ({
  LocationLiveMapService: class {
    getLiveLocationsForTenant = mockFns.getLiveLocationsForTenant;
  },
}));

vi.mock("@/modules/attendance/services/ActiveAttendanceSessionService", () => ({
  ActiveAttendanceSessionService: class {},
}));

vi.mock("@/modules/attendance/repositories/LocationTrackingRepository", () => ({
  LocationTrackingRepository: class {},
}));

vi.mock("@/modules/notification", () => ({
  createNotification: mockFns.createNotification,
}));

vi.mock("@/modules/attendance/services/AttendanceAlertLockService", () => ({
  acquireReminderLock: mockFns.acquireReminderLock,
  releaseReminderLock: mockFns.releaseReminderLock,
}));

import { runTrackingGapAlerts } from "@/modules/attendance/services/TrackingGapAlertService";

function entry(userId: string, trackingOff: boolean) {
  return {
    userId,
    checkInTime: new Date("2026-10-18T01:00:00.000Z"),
    trackingOff,
    trackingOffSince: trackingOff ? new Date("2026-10-18T01:30:00.000Z") : null,
    trackingOffReason: trackingOff ? "STALE" : null,
  };
}

describe("runTrackingGapAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.findActiveTenantIds.mockResolvedValue(["tenant-1"]);
    mockFns.getLiveLocationsForTenant.mockResolvedValue([
      entry("on", false),
      entry("off", true),
    ]);
    mockFns.acquireReminderLock.mockResolvedValue(true);
  });

  it("notifies only the employee whose tracking is off, on the attendance screen", async () => {
    const result = await runTrackingGapAlerts();

    expect(result).toEqual({ trackingOff: 1, notified: 1 });
    expect(mockFns.getLiveLocationsForTenant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    expect(mockFns.createNotification).toHaveBeenCalledOnce();
    expect(mockFns.createNotification.mock.calls[0][0]).toMatchObject({
      userId: "off",
      tenantId: "tenant-1",
      link: "/karyawan/absensi",
      type: "SYSTEM",
      priority: "NORMAL",
    });
  });

  it("sends one notification per silence, not one every run", async () => {
    mockFns.acquireReminderLock.mockResolvedValue(false);

    const result = await runTrackingGapAlerts();

    expect(result).toEqual({ trackingOff: 1, notified: 0 });
    expect(mockFns.createNotification).not.toHaveBeenCalled();
    expect(mockFns.acquireReminderLock.mock.calls[0][0]).toBe(
      `attendance:tracking-off:off:${Date.parse("2026-10-18T01:00:00.000Z")}:${Date.parse("2026-10-18T01:30:00.000Z")}`,
    );
  });

  it("retries a gap whose notification failed, without stopping the others", async () => {
    mockFns.getLiveLocationsForTenant.mockResolvedValue([
      entry("broken", true),
      entry("off", true),
    ]);
    mockFns.createNotification
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(undefined);

    const result = await runTrackingGapAlerts();

    expect(result).toEqual({ trackingOff: 2, notified: 1 });
    expect(mockFns.releaseReminderLock).toHaveBeenCalledWith(
      mockFns.acquireReminderLock.mock.calls[0][0],
    );
  });
});
