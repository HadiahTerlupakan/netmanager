import { describe, expect, it } from "vitest";

import { AttendanceDailyEvaluator } from "@/modules/attendance/services/AttendanceDailyEvaluator";

describe("AttendanceDailyEvaluator", () => {
  it("prefers approved leave over raw attendance while preserving anomaly metadata", async () => {
    const result = await new AttendanceDailyEvaluator().evaluate({
      tenantId: "tenant-1",
      userId: "user-1",
      workDate: new Date("2026-04-01T00:00:00.000Z"),
      attendance: {
        status: "ON_TIME",
        checkIn: new Date("2026-04-01T01:00:00.000Z"),
        checkOut: new Date("2026-04-01T09:00:00.000Z"),
      },
      leave: { type: "CUTI", approved: true },
      holiday: null,
      approvedOvertime: null,
      schedule: { workingHourMode: "FIXED" },
    });

    expect(result.finalStatus).toBe("PERMIT");
    expect(result.reviewState).toBe("PENDING_REVIEW");
    expect(result.reasonCodes).toContain("APPROVED_LEAVE_OVERRIDES_ATTENDANCE");
    expect(result.anomalyCodes).toContain(
      "ATTENDANCE_RECORDED_DURING_APPROVED_LEAVE",
    );
  });

  it("marks holiday attendance without approved overtime as held", async () => {
    const result = await new AttendanceDailyEvaluator().evaluate({
      tenantId: "tenant-1",
      userId: "user-2",
      workDate: new Date("2026-04-02T00:00:00.000Z"),
      attendance: {
        status: "ON_TIME",
        checkIn: new Date("2026-04-02T01:00:00.000Z"),
        checkOut: new Date("2026-04-02T10:00:00.000Z"),
      },
      holiday: { description: "Nyepi" },
      leave: null,
      approvedOvertime: null,
      schedule: { workingHourMode: "FIXED" },
    });

    expect(result.finalStatus).toBe("DAY_OFF");
    expect(result.payrollHoldState).toBe("OVERTIME_HELD");
    expect(result.reviewState).toBe("PENDING_REVIEW");
  });

  it("marks attendance as weak evidence when accepted without usable geofence site config", async () => {
    const result = await new AttendanceDailyEvaluator().evaluate({
      tenantId: "tenant-1",
      userId: "user-3",
      workDate: new Date("2026-04-03T00:00:00.000Z"),
      attendance: {
        status: "ON_TIME",
        checkIn: new Date("2026-04-03T01:00:00.000Z"),
        checkOut: new Date("2026-04-03T09:00:00.000Z"),
        geofenceStatus: "INSIDE",
        geofenceSiteName: null,
      },
      holiday: null,
      leave: null,
      approvedOvertime: null,
      schedule: { workingHourMode: "FIXED" },
    });

    expect(result.evidenceQuality).toBe("weak-missing-site-config");
    expect(result.reviewState).toBe("PENDING_REVIEW");
    expect(result.payrollHoldState).toBe("ALLOWANCE_HELD");
    expect(result.reasonCodes).toContain("WEAK_GEOFENCE_EVIDENCE");
    expect(result.anomalyCodes).toContain(
      "ATTENDANCE_ACCEPTED_WITHOUT_USABLE_SITE_CONFIG",
    );
  });
});
