import { beforeEach, describe, expect, it } from "vitest";

import { cache } from "@/lib/cache";
import { AttendanceValidationService } from "@/modules/attendance";
import { prismaMock } from "../../setup";

describe("AttendanceValidationService", () => {
  beforeEach(() => {
    cache.clear();
    prismaMock.leaveRequest.findFirst.mockResolvedValue(null);
    prismaMock.holiday.findFirst.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      workDays: "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY",
      workingHourMode: "FIXED",
    });
  });

  it("blocks check-in on tukar libur replacement day when the calendar marks a holiday", async () => {
    const service = new AttendanceValidationService();

    prismaMock.leaveRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        startDate: new Date("2026-03-18T00:00:00.000Z"),
        replacementDate: new Date("2026-03-20T00:00:00.000Z"),
      });
    prismaMock.holiday.findFirst.mockResolvedValueOnce({
      id: "holiday-replacement-day",
      date: new Date("2026-03-20T00:00:00.000Z"),
      description: "Hari Raya",
      tenantId: "tenant-1",
    });

    const result = await service.validateCheckInEligibility(
      "user-1",
      "Asia/Jakarta",
      new Date("2026-03-20T02:24:00.000Z"),
      "tenant-1",
    );

    expect(result).toEqual({
      isValid: false,
      reason: "Hari ini adalah hari libur: Hari Raya",
      type: "HOLIDAY",
    });
  });
});
