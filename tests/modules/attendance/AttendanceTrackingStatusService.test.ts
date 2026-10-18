import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActiveAttendanceSessionService } from "@/modules/attendance/services/ActiveAttendanceSessionService";
import { AttendanceTrackingStatusService } from "@/modules/attendance/services/AttendanceTrackingStatusService";
import type { AttendanceRepository } from "@/modules/attendance/repositories/AttendanceRepository";

vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
  getTimezoneSync: vi.fn().mockReturnValue("Asia/Jakarta"),
}));

const NOW = new Date("2026-10-18T03:00:00.000Z");

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    checkIn: new Date("2026-10-18T01:00:00.000Z"),
    checkOut: null as Date | null,
    status: "ON_TIME",
    user: {
      workingHourMode: "FIXED",
      flexibleTargetHour: null as number | null,
      shift: null as { startTime: string; endTime: string } | null,
    },
    ...overrides,
  };
}

describe("AttendanceTrackingStatusService", () => {
  const repo = {
    findFirstForCurrentStatus: vi.fn(),
    updateTrackingStatus: vi.fn(),
  };
  const service = new AttendanceTrackingStatusService(
    new ActiveAttendanceSessionService(repo as unknown as AttendanceRepository),
    repo as unknown as AttendanceRepository,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("records the reported status on the session that is running", async () => {
    repo.findFirstForCurrentStatus.mockResolvedValue(session());

    const result = await service.record({
      userId: "user-1",
      tenantId: "tenant-1",
      status: "BACKGROUND_DENIED",
    });

    expect(result).toEqual({ recorded: true });
    expect(repo.updateTrackingStatus).toHaveBeenCalledWith({
      attendanceId: "att-1",
      status: "BACKGROUND_DENIED",
      at: NOW,
    });
  });

  it("ignores a report when the latest session is already checked out", async () => {
    repo.findFirstForCurrentStatus.mockResolvedValue(
      session({ checkOut: new Date("2026-10-18T02:00:00.000Z") }),
    );

    const result = await service.record({
      userId: "user-1",
      tenantId: "tenant-1",
      status: "GPS_OFF",
    });

    expect(result).toEqual({ recorded: false });
    expect(repo.updateTrackingStatus).not.toHaveBeenCalled();
  });
});
