import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttendanceService } from "@/modules/attendance/services/AttendanceService";
import { AttendanceRepository } from "@/modules/attendance/repositories/AttendanceRepository";

vi.mock("@/modules/events", () => ({
  AttendanceEventDispatcher: {
    onCheckOut: vi.fn().mockResolvedValue(undefined),
    onCheckIn: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("AttendanceService flexible checkout warning", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calculates warning from offlineTime when provided", async () => {
    vi.spyOn(
      AttendanceRepository.prototype,
      "findFirstActiveForCheckout",
    ).mockResolvedValue({
      id: "att-1",
      checkIn: new Date("2026-04-09T08:00:00.000Z"),
      status: "ON_TIME",
      notes: null,
      user: {
        name: "Test User",
        workingHourMode: "FLEXIBLE",
        flexibleTargetHour: 8,
        attendanceGeofencePolicy: "WARN",
      },
    } as never);

    vi.spyOn(AttendanceRepository.prototype, "update").mockImplementation(
      async (_id, data) =>
        ({
          ...data,
          id: "att-1",
          user: { name: "Test User" },
        }) as never,
    );

    const service = new AttendanceService();
    const result = await service.checkOut({
      userId: "user-1",
      photoUrl: null,
      location: "HQ",
      offlineTime: new Date("2026-04-09T12:00:00.000Z"),
    });

    expect(result.warning).toContain("Target kerja: 8 jam");
    expect(result.warning).toContain("Kurang 4 jam");
  });
});
