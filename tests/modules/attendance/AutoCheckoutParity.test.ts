import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AttendanceStatus } from "@prisma/client";

import { prismaMock } from "../../setup";
import { getCrossSurfaceAttendanceFixture } from "../../fixtures/attendance/crossSurfaceAttendanceFixtures";
import { AutoCheckoutService } from "@/modules/attendance/services/AutoCheckoutService";
import { AttendanceService } from "@/modules/attendance/services/AttendanceService";
import { addAttendanceAutoCheckoutJob } from "@/lib/event-bus/queues";

vi.mock("@/lib/utils/get-timezone", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/utils/get-timezone")>();
  return {
    ...actual,
    getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
  };
});

vi.mock("@/lib/event-bus/queues", () => ({
  addAttendanceAutoCheckoutJob: vi.fn().mockResolvedValue(undefined),
  removeFailedAttendanceAutoCheckoutJob: vi.fn().mockResolvedValue(false),
}));

describe("Attendance session policy parity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    prismaMock.attendance.findMany.mockResolvedValue([] as never);
    prismaMock.attendance.update.mockResolvedValue({
      id: "attendance-1",
    } as never);
  });

  it("exposes one decision object usable by both status consumers and auto-checkout callers", async () => {
    const overnightFixture = getCrossSurfaceAttendanceFixture(
      "overnight-shift-still-active",
    );
    const staleFlexibleFixture = getCrossSurfaceAttendanceFixture(
      "stale-flexible-session",
    );

    expect(overnightFixture).toBeDefined();
    expect(staleFlexibleFixture).toBeDefined();

    const { AttendanceSessionPolicyService } =
      await import("@/modules/attendance/services/AttendanceSessionPolicyService");
    const service = new AttendanceSessionPolicyService();

    const overnightDecision = service.resolve({
      attendance: {
        id: "att-overnight",
        checkIn: new Date(overnightFixture!.attendance.checkIn),
        checkOut: null,
        status: overnightFixture!.attendance.status as AttendanceStatus,
        user: {
          workingHourMode: "SHIFT",
          flexibleTargetHour: null,
          shift: {
            startTime: "21:00",
            endTime: "04:00",
          },
        },
      },
      now: new Date(overnightFixture!.now),
    });

    const staleFlexibleDecision = service.resolve({
      attendance: {
        id: "att-flex",
        checkIn: new Date(staleFlexibleFixture!.attendance.checkIn),
        checkOut: null,
        status: staleFlexibleFixture!.attendance.status as AttendanceStatus,
        user: {
          workingHourMode: "FLEXIBLE",
          flexibleTargetHour: 8,
          shift: null,
        },
      },
      now: new Date(staleFlexibleFixture!.now),
    });

    expect(overnightDecision.shouldAutoCheckout).toBe(false);
    expect(overnightDecision.isOvernightShiftActive).toBe(true);

    expect(staleFlexibleDecision.shouldAutoCheckout).toBe(true);
    expect(staleFlexibleDecision.isStaleFlexibleSession).toBe(true);
    expect(staleFlexibleDecision.nextStatus).toBe(
      staleFlexibleFixture!.attendance.status,
    );
  });

  it("uses the same session decision path for inline auto-checkout and queued cron scanning", async () => {
    vi.setSystemTime(new Date("2026-03-28T18:30:00.000Z"));

    const session: {
      id: string;
      tenantId: string;
      checkIn: Date;
      checkOut: Date | null;
      status: AttendanceStatus;
      notes: string | null;
      user: {
        name: string;
        workingHourMode: "FIXED";
        startWorkTime: string | null;
        endWorkTime: string | null;
        shift: null;
      };
    } = {
      id: "attendance-auto-1",
      tenantId: "tenant-1",
      checkIn: new Date("2026-03-27T06:37:00.000Z"),
      checkOut: null,
      status: "LATE",
      notes: "Catatan lama",
      user: {
        name: "Ubaidilah",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    };

    prismaMock.attendance.findMany.mockResolvedValueOnce([
      {
        id: session.id,
        checkIn: session.checkIn,
        checkOut: session.checkOut,
        status: session.status,
        notes: session.notes,
      },
    ] as never);

    const attendanceService = new AttendanceService();
    const inlineAutoCheckout = (
      attendanceService as unknown as {
        processAutoCheckout: (
          userId: string,
          userDetails: {
            endWorkTime: string | null;
            workingHourMode: string | null;
            shift?: { startTime: string; endTime: string } | null;
          } | null,
          effectiveToday: Date,
          policyNow: Date,
          tenantId: string | undefined,
          timezone: string,
        ) => Promise<void>;
      }
    ).processAutoCheckout.bind(attendanceService);

    await inlineAutoCheckout(
      "user-1",
      {
        endWorkTime: "17:00",
        workingHourMode: "FIXED",
        shift: null,
      },
      new Date("2026-03-28T00:00:00.000Z"),
      new Date("2026-03-28T00:00:00.000Z"),
      "tenant-1",
      "Asia/Jakarta",
    );

    const inlineUpdate =
      prismaMock.attendance.update.mock.calls.at(-1)?.[0]?.data;
    prismaMock.attendance.update.mockClear();

    prismaMock.attendance.findMany.mockResolvedValueOnce([session] as never);

    await AutoCheckoutService.runAutoCheckout("tenant-1");

    expect(addAttendanceAutoCheckoutJob).toHaveBeenCalledWith(
      expect.objectContaining({
        attendanceId: "attendance-auto-1",
        tenantId: "tenant-1",
        mode: "FIXED",
        expectedAutoCheckoutAt: inlineUpdate?.checkOut?.toISOString(),
        sourceCheckInDate: "2026-03-27",
      }),
      { jobId: "attendance:auto-checkout:attendance-auto-1" },
    );
  });
});
