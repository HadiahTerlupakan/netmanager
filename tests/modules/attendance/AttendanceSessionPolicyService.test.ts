import { describe, expect, it } from "vitest";

import type { AttendanceSessionPolicyInput } from "@/modules/attendance/services/AttendanceSessionPolicyService";
import type { AttendanceStatus } from "@prisma/client";

import { getCrossSurfaceAttendanceFixture } from "../../fixtures/attendance/crossSurfaceAttendanceFixtures";

describe("AttendanceSessionPolicyService", () => {
  it("keeps an overnight shift session active before shift end", async () => {
    const fixture = getCrossSurfaceAttendanceFixture(
      "overnight-shift-still-active",
    );
    expect(fixture).toBeDefined();

    const { AttendanceSessionPolicyService } =
      await import("@/modules/attendance/services/AttendanceSessionPolicyService");
    const service = new AttendanceSessionPolicyService();

    const decision = service.resolve({
      attendance: {
        id: "att-overnight",
        checkIn: new Date(fixture!.attendance.checkIn),
        checkOut: null,
        status: fixture!.attendance.status as AttendanceStatus,
        user: {
          workingHourMode: "SHIFT",
          flexibleTargetHour: null,
          shift: {
            startTime: "21:00",
            endTime: "04:00",
          },
        },
      },
      now: new Date(fixture!.now),
    });

    expect(decision).toMatchObject({
      reason: "overnight-shift-active",
      isOvernightShiftActive: true,
      isStaleFlexibleSession: false,
      shouldAutoCheckout: false,
      autoCheckoutAt: null,
    });
  });

  it("marks stale flexible sessions as stale and auto-checkout eligible after 24 hours", async () => {
    const fixture = getCrossSurfaceAttendanceFixture("stale-flexible-session");
    expect(fixture).toBeDefined();

    const { AttendanceSessionPolicyService } =
      await import("@/modules/attendance/services/AttendanceSessionPolicyService");
    const service = new AttendanceSessionPolicyService();

    const decision = service.resolve({
      attendance: {
        id: "att-flex",
        checkIn: new Date(fixture!.attendance.checkIn),
        checkOut: null,
        status: fixture!.attendance.status as AttendanceStatus,
        user: {
          workingHourMode: "FLEXIBLE",
          flexibleTargetHour: 8,
          shift: null,
        },
      },
      now: new Date(fixture!.now),
    });

    expect(decision).toMatchObject({
      reason: "stale-flexible-session",
      isOvernightShiftActive: false,
      isStaleFlexibleSession: true,
      shouldAutoCheckout: true,
      nextStatus: fixture!.attendance.status,
    });
    expect(decision.autoCheckoutAt).toBeDefined();
  });

  it("waits three hours after non-overnight shift end before auto-checkout", async () => {
    const { AttendanceSessionPolicyService } =
      await import("@/modules/attendance/services/AttendanceSessionPolicyService");
    const service = new AttendanceSessionPolicyService();

    const attendance: AttendanceSessionPolicyInput["attendance"] = {
      id: "att-shift-daytime",
      checkIn: new Date("2026-03-08T01:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      user: {
        workingHourMode: "SHIFT",
        flexibleTargetHour: null,
        shift: {
          startTime: "09:00",
          endTime: "17:00",
        },
      },
    };

    const atShiftEnd = service.resolve({
      attendance,
      now: new Date("2026-03-08T10:00:00.000Z"),
      scheduleEndTime: null,
    });

    const afterGracePeriod = service.resolve({
      attendance,
      now: new Date("2026-03-08T13:00:00.000Z"),
      scheduleEndTime: null,
    });

    expect(atShiftEnd.reason).toBe("same-day-open");
    expect(atShiftEnd.shouldAutoCheckout).toBe(false);
    expect(afterGracePeriod.reason).toBe("eligible-for-auto-checkout");
    expect(afterGracePeriod.autoCheckoutAt?.toISOString()).toBe(
      "2026-03-08T13:00:00.000Z",
    );
    expect(afterGracePeriod.nextStatus).toBe("NO_CHECKOUT");
  });

  it("uses tenant timezone when resolving fixed-hour auto-checkout grace period", async () => {
    const { AttendanceSessionPolicyService } =
      await import("@/modules/attendance/services/AttendanceSessionPolicyService");
    const service = new AttendanceSessionPolicyService();

    const attendance: AttendanceSessionPolicyInput["attendance"] = {
      id: "att-fixed-jakarta",
      checkIn: new Date("2026-03-27T01:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      user: {
        workingHourMode: "FIXED",
        flexibleTargetHour: null,
        shift: null,
      },
    };

    const atWorkEnd = service.resolve({
      attendance,
      now: new Date("2026-03-27T10:00:00.000Z"),
      scheduleEndTime: "17:00",
      timezone: "Asia/Jakarta",
    });

    const afterGracePeriod = service.resolve({
      attendance,
      now: new Date("2026-03-27T13:00:00.000Z"),
      scheduleEndTime: "17:00",
      timezone: "Asia/Jakarta",
    });

    expect(atWorkEnd.reason).toBe("same-day-open");
    expect(atWorkEnd.shouldAutoCheckout).toBe(false);
    expect(afterGracePeriod.reason).toBe("eligible-for-auto-checkout");
    expect(afterGracePeriod.autoCheckoutAt?.toISOString()).toBe(
      "2026-03-27T13:00:00.000Z",
    );
    expect(afterGracePeriod.nextStatus).toBe("NO_CHECKOUT");
  });

  it("treats same-hour earlier end minute as overnight shift", async () => {
    const { AttendanceSessionPolicyService } =
      await import("@/modules/attendance/services/AttendanceSessionPolicyService");
    const service = new AttendanceSessionPolicyService();

    const decision = service.resolve({
      attendance: {
        id: "att-same-hour-overnight",
        checkIn: new Date("2026-03-27T16:30:00.000Z"),
        checkOut: null,
        status: "ON_TIME",
        user: {
          workingHourMode: "SHIFT",
          flexibleTargetHour: null,
          shift: {
            startTime: "23:30",
            endTime: "23:15",
          },
        },
      },
      now: new Date("2026-03-28T13:00:00.000Z"),
      timezone: "Asia/Jakarta",
    });

    expect(decision.reason).toBe("overnight-shift-active");
    expect(decision.shouldAutoCheckout).toBe(false);
  });

  it("waits three hours after overnight shift end before auto-checkout", async () => {
    const { AttendanceSessionPolicyService } =
      await import("@/modules/attendance/services/AttendanceSessionPolicyService");
    const service = new AttendanceSessionPolicyService();

    const attendance: AttendanceSessionPolicyInput["attendance"] = {
      id: "att-overnight-grace",
      checkIn: new Date("2026-03-27T14:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      user: {
        workingHourMode: "SHIFT",
        flexibleTargetHour: null,
        shift: {
          startTime: "21:00",
          endTime: "04:00",
        },
      },
    };

    const atShiftEnd = service.resolve({
      attendance,
      now: new Date("2026-03-27T21:00:00.000Z"),
      timezone: "Asia/Jakarta",
    });

    const afterGracePeriod = service.resolve({
      attendance,
      now: new Date("2026-03-28T00:00:00.000Z"),
      timezone: "Asia/Jakarta",
    });

    expect(atShiftEnd.reason).toBe("same-day-open");
    expect(atShiftEnd.shouldAutoCheckout).toBe(false);
    expect(afterGracePeriod.reason).toBe("eligible-for-auto-checkout");
    expect(afterGracePeriod.autoCheckoutAt?.toISOString()).toBe(
      "2026-03-28T00:00:00.000Z",
    );
    expect(afterGracePeriod.nextStatus).toBe("NO_CHECKOUT");
  });

  it("marks flexible sessions stale exactly at 24 hours", async () => {
    const { AttendanceSessionPolicyService } =
      await import("@/modules/attendance/services/AttendanceSessionPolicyService");
    const service = new AttendanceSessionPolicyService();

    // Check-in at 08:00 WIB (01:00 UTC)
    // Auto-checkout: 24 hours later = next day 08:00 WIB (01:00 UTC)
    const decision = service.resolve({
      attendance: {
        id: "att-flex-exact-threshold",
        checkIn: new Date("2026-03-27T01:00:00.000Z"),
        checkOut: null,
        status: "ON_TIME",
        user: {
          workingHourMode: "FLEXIBLE",
          flexibleTargetHour: 8,
          shift: null,
        },
      },
      now: new Date("2026-03-28T01:00:00.000Z"), // 24 hours later
    });

    expect(decision.reason).toBe("stale-flexible-session");
    expect(decision.shouldAutoCheckout).toBe(true);
    expect(decision.autoCheckoutAt?.toISOString()).toBe(
      "2026-03-28T01:00:00.000Z",
    );
    expect(decision.nextStatus).toBe("ON_TIME");
  });

  it("throws on invalid time format", async () => {
    const { AttendanceSessionPolicyService } =
      await import("@/modules/attendance/services/AttendanceSessionPolicyService");
    const service = new AttendanceSessionPolicyService();

    expect(() =>
      service.resolve({
        attendance: {
          id: "att-shift-invalid-time",
          checkIn: new Date("2026-03-27T01:00:00.000Z"),
          checkOut: null,
          status: "ON_TIME",
          user: {
            workingHourMode: "SHIFT",
            flexibleTargetHour: null,
            shift: {
              startTime: "25:00",
              endTime: "17:00",
            },
          },
        },
        now: new Date("2026-03-27T02:00:00.000Z"),
      }),
    ).toThrow("Invalid time format");
  });
});
