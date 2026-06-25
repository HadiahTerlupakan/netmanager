import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { AutoCheckoutService } from "@/modules/attendance";
import { ATTENDANCE_CONSTANTS } from "@/modules/attendance/utils/constants";
import { getTimezone } from "@/lib/utils/get-timezone";
import {
  addAttendanceAutoCheckoutJob,
  removeFailedAttendanceAutoCheckoutJob,
} from "@/lib/event-bus/queues";

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

describe("AutoCheckoutService semantics", () => {
  beforeEach(() => {
    vi.mocked(getTimezone).mockResolvedValue("Asia/Jakarta");
    vi.mocked(addAttendanceAutoCheckoutJob).mockResolvedValue(undefined);
    vi.mocked(removeFailedAttendanceAutoCheckoutJob).mockResolvedValue(false);
    prismaMock.attendance.findMany.mockResolvedValue([
      {
        id: "att-1",
        tenantId: "tenant-1",
        checkIn: new Date("2026-03-27T06:37:00.000Z"),
        checkOut: null,
        status: "LATE",
        notes: null,
        user: {
          name: "Ubaidilah",
          workingHourMode: "FIXED",
          startWorkTime: "08:00",
          endWorkTime: "17:00",
          shift: null,
        },
      },
    ] as never);
    prismaMock.attendance.findFirst.mockResolvedValue({
      id: "att-1",
      tenantId: "tenant-1",
      checkIn: new Date("2026-03-27T06:37:00.000Z"),
      checkOut: null,
      status: "LATE",
      notes: null,
      user: {
        name: "Ubaidilah",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    } as never);
    prismaMock.attendance.update.mockResolvedValue({ id: "att-1" } as never);
    prismaMock.attendance.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  it("enqueues due fixed sessions instead of updating them inline", async () => {
    const updatedCount = await AutoCheckoutService.runAutoCheckout("tenant-1");

    expect(updatedCount).toBe(1);
    expect(removeFailedAttendanceAutoCheckoutJob).toHaveBeenCalledWith(
      "attendance.auto-checkout.att-1",
    );
    expect(addAttendanceAutoCheckoutJob).toHaveBeenCalledWith(
      {
        attendanceId: "att-1",
        tenantId: "tenant-1",
        mode: "FIXED",
        expectedAutoCheckoutAt: expect.any(String),
        sourceCheckInDate: "2026-03-27",
      },
      { jobId: "attendance.auto-checkout.att-1" },
    );
    expect(prismaMock.attendance.update).not.toHaveBeenCalled();
  });

  it("re-enqueues after cleaning a failed deterministic job id", async () => {
    vi.mocked(removeFailedAttendanceAutoCheckoutJob).mockResolvedValueOnce(
      true,
    );

    const updatedCount = await AutoCheckoutService.runAutoCheckout("tenant-1");

    expect(updatedCount).toBe(1);
    expect(removeFailedAttendanceAutoCheckoutJob).toHaveBeenCalledWith(
      "attendance.auto-checkout.att-1",
    );
    expect(addAttendanceAutoCheckoutJob).toHaveBeenCalledWith(
      expect.objectContaining({ attendanceId: "att-1" }),
      { jobId: "attendance.auto-checkout.att-1" },
    );
  });

  it("writes the canonical auto-checkout note from worker execution", async () => {
    await AutoCheckoutService.runAutoCheckoutJob({
      attendanceId: "att-1",
      tenantId: "tenant-1",
      mode: "FIXED",
      expectedAutoCheckoutAt: "2026-03-27T13:00:00.000Z",
      sourceCheckInDate: "2026-03-27",
    });

    expect(prismaMock.attendance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "att-1",
          tenantId: "tenant-1",
          checkOut: null,
          correctedAt: null,
          status: {
            notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"],
          },
        }),
        data: expect.objectContaining({
          notes: ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE,
          status: "NO_CHECKOUT",
        }),
      }),
    );
    expect(prismaMock.attendance.update).not.toHaveBeenCalled();
  });

  it("validates worker auto-checkout timestamp using tenant timezone", async () => {
    vi.mocked(getTimezone).mockResolvedValueOnce("Asia/Jakarta");
    prismaMock.attendance.findFirst.mockResolvedValueOnce({
      id: "att-jakarta-worker",
      tenantId: "tenant-jakarta",
      checkIn: new Date("2026-03-27T01:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      notes: null,
      user: {
        name: "Jakarta Worker",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    } as never);

    await AutoCheckoutService.runAutoCheckoutJob({
      attendanceId: "att-jakarta-worker",
      tenantId: "tenant-jakarta",
      mode: "FIXED",
      expectedAutoCheckoutAt: "2026-03-27T13:00:00.000Z",
      sourceCheckInDate: "2026-03-27",
    });

    expect(getTimezone).toHaveBeenCalledWith("tenant-jakarta");
    expect(prismaMock.attendance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "att-jakarta-worker",
          tenantId: "tenant-jakarta",
        }),
        data: expect.objectContaining({
          checkOut: new Date("2026-03-27T13:00:00.000Z"),
          status: "NO_CHECKOUT",
        }),
      }),
    );
  });

  it("returns noop when conditional update misses due to concurrent manual checkout or correction", async () => {
    prismaMock.attendance.updateMany.mockResolvedValueOnce({
      count: 0,
    } as never);

    const result = await AutoCheckoutService.runAutoCheckoutJob({
      attendanceId: "att-1",
      tenantId: "tenant-1",
      mode: "FIXED",
      expectedAutoCheckoutAt: "2026-03-27T13:00:00.000Z",
      sourceCheckInDate: "2026-03-27",
    });

    expect(result).toEqual({ attendanceId: "att-1", status: "noop" });
    expect(prismaMock.attendance.update).not.toHaveBeenCalled();
  });

  it("returns noop when source check-in date drifts from job payload", async () => {
    const result = await AutoCheckoutService.runAutoCheckoutJob({
      attendanceId: "att-1",
      tenantId: "tenant-1",
      mode: "FIXED",
      expectedAutoCheckoutAt: "2026-03-27T10:00:00.000Z",
      sourceCheckInDate: "2026-03-26",
    });

    expect(result).toEqual({ attendanceId: "att-1", status: "noop" });
    expect(prismaMock.attendance.updateMany).not.toHaveBeenCalled();
  });

  it("returns noop when working-hour mode drifts from job payload", async () => {
    const result = await AutoCheckoutService.runAutoCheckoutJob({
      attendanceId: "att-1",
      tenantId: "tenant-1",
      mode: "SHIFT",
      expectedAutoCheckoutAt: "2026-03-27T10:00:00.000Z",
      sourceCheckInDate: "2026-03-27",
    });

    expect(result).toEqual({ attendanceId: "att-1", status: "noop" });
    expect(prismaMock.attendance.updateMany).not.toHaveBeenCalled();
  });

  it("returns noop when expected auto-checkout timestamp drifts from payload", async () => {
    const result = await AutoCheckoutService.runAutoCheckoutJob({
      attendanceId: "att-1",
      tenantId: "tenant-1",
      mode: "FIXED",
      expectedAutoCheckoutAt: "2026-03-27T10:01:00.000Z",
      sourceCheckInDate: "2026-03-27",
    });

    expect(result).toEqual({ attendanceId: "att-1", status: "noop" });
    expect(prismaMock.attendance.updateMany).not.toHaveBeenCalled();
  });

  it("returns noop when expected auto-checkout timestamp is invalid", async () => {
    const result = await AutoCheckoutService.runAutoCheckoutJob({
      attendanceId: "att-1",
      tenantId: "tenant-1",
      mode: "FIXED",
      expectedAutoCheckoutAt: "invalid-date",
      sourceCheckInDate: "2026-03-27",
    });

    expect(result).toEqual({ attendanceId: "att-1", status: "noop" });
    expect(prismaMock.attendance.updateMany).not.toHaveBeenCalled();
  });

  it("processes global auto-checkout per active tenant using each tenant timezone", async () => {
    const tenantModel = prismaMock as unknown as {
      tenant: { findMany: ReturnType<typeof vi.fn> };
    };

    tenantModel.tenant.findMany.mockResolvedValue([
      { id: "tenant-jkt" },
      { id: "tenant-sg" },
    ] as never);

    vi.mocked(getTimezone).mockImplementation(async (tenantId?: string) => {
      if (tenantId === "tenant-sg") {
        return "Asia/Singapore";
      }
      return "Asia/Jakarta";
    });

    prismaMock.attendance.findMany
      .mockResolvedValueOnce([
        {
          id: "att-jkt",
          checkIn: new Date("2026-03-27T06:37:00.000Z"),
          checkOut: null,
          status: "LATE",
          notes: null,
          user: {
            name: "Jakarta User",
            workingHourMode: "FIXED",
            shift: null,
          },
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: "att-sg",
          checkIn: new Date("2026-03-27T06:37:00.000Z"),
          checkOut: null,
          status: "LATE",
          notes: null,
          user: {
            name: "Singapore User",
            workingHourMode: "FIXED",
            shift: null,
          },
        },
      ] as never);

    vi.mocked(getTimezone).mockClear();
    prismaMock.attendance.findMany.mockClear();

    const updatedCount = await AutoCheckoutService.runAutoCheckout();

    expect(updatedCount).toBe(2);
    expect(tenantModel.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        select: { id: true },
      }),
    );
    expect(getTimezone).toHaveBeenNthCalledWith(1, "tenant-jkt");
    expect(getTimezone).toHaveBeenNthCalledWith(2, "tenant-sg");
    expect(prismaMock.attendance.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-jkt" }),
      }),
    );
    expect(prismaMock.attendance.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-sg" }),
      }),
    );
  });

  it("queries open sessions by excluding placeholder statuses so libur or izin rows are not auto-checked out", async () => {
    prismaMock.attendance.findMany.mockResolvedValueOnce([] as never);

    const updatedCount = await AutoCheckoutService.runAutoCheckout("tenant-1");

    expect(updatedCount).toBe(0);
    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"] },
        }),
      }),
    );
    expect(prismaMock.attendance.update).not.toHaveBeenCalled();
  });

  it("does not update DAY_OFF sessions into NO_CHECKOUT", async () => {
    prismaMock.attendance.findMany.mockResolvedValueOnce([
      {
        id: "day-off-1",
        checkIn: new Date("2026-03-27T00:00:00.000Z"),
        checkOut: null,
        status: "DAY_OFF",
        notes: "Hari Libur (Day Off) - Auto Generated",
        user: {
          name: "User Libur",
          workingHourMode: "FIXED",
          shift: null,
        },
      },
    ] as never);

    const updatedCount = await AutoCheckoutService.runAutoCheckout("tenant-1");

    expect(updatedCount).toBe(0);
    expect(prismaMock.attendance.update).not.toHaveBeenCalled();
  });

  it("does not reopen ABSENT placeholders during stale-session cleanup on next day check-in", async () => {
    const service = new (
      await import("@/modules/attendance/services/AttendanceService")
    ).AttendanceService();

    prismaMock.attendance.findMany.mockImplementationOnce(
      async (args: unknown) => {
        expect(args).toMatchObject({
          where: expect.objectContaining({
            status: {
              notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"],
            },
          }),
        });
        return [] as never;
      },
    );

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      tenantId: "tenant-1",
      workingHourMode: "FIXED",
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      flexibleTargetHour: null,
      isActive: true,
      shift: null,
      attendanceGeofencePolicy: "OPTIONAL",
    } as never);
    prismaMock.attendance.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.leaveRequest.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.holiday.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.overtime.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.attendanceEvaluation.findFirst.mockResolvedValueOnce(
      null as never,
    );
    prismaMock.attendance.create.mockResolvedValueOnce({
      id: "att-new",
      userId: "user-1",
      tenantId: "tenant-1",
      checkIn: new Date("2026-03-28T08:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      location: "Office",
      notes: "",
    } as never);

    await expect(
      service.checkIn({
        userId: "user-1",
        photoUrl: null,
        location: "Office",
        notes: "",
        latitude: -6.2,
        longitude: 106.8,
        tenantId: "tenant-1",
      }),
    ).resolves.toMatchObject({
      attendance: expect.objectContaining({ id: "att-new" }),
    });

    expect(prismaMock.attendance.update).not.toHaveBeenCalled();
  });

  it("does not convert stale DAY_OFF placeholders into NO_CHECKOUT on next day check-in", async () => {
    const service = new (
      await import("@/modules/attendance/services/AttendanceService")
    ).AttendanceService();

    prismaMock.attendance.findMany.mockImplementationOnce(
      async (args: unknown) => {
        expect(args).toMatchObject({
          where: expect.objectContaining({
            status: {
              notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"],
            },
          }),
        });
        return [] as never;
      },
    );

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      tenantId: "tenant-1",
      workingHourMode: "FIXED",
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      flexibleTargetHour: null,
      isActive: true,
      shift: null,
      attendanceGeofencePolicy: "OPTIONAL",
    } as never);
    prismaMock.attendance.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.leaveRequest.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.holiday.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.overtime.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.attendanceEvaluation.findFirst.mockResolvedValueOnce(
      null as never,
    );
    prismaMock.attendance.create.mockResolvedValueOnce({
      id: "att-new",
      userId: "user-1",
      tenantId: "tenant-1",
      checkIn: new Date("2026-03-28T08:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      location: "Office",
      notes: "",
    } as never);

    await expect(
      service.checkIn({
        userId: "user-1",
        photoUrl: null,
        location: "Office",
        notes: "",
        latitude: -6.2,
        longitude: 106.8,
        tenantId: "tenant-1",
      }),
    ).resolves.toMatchObject({
      attendance: expect.objectContaining({ id: "att-new" }),
    });

    expect(prismaMock.attendance.update).not.toHaveBeenCalled();
  });

  it("restores the manual status when checkout races after auto-checkout", async () => {
    const service = new (
      await import("@/modules/attendance/services/AttendanceService")
    ).AttendanceService();
    const manualCheckOutTime = new Date("2026-03-27T13:05:00.000Z");

    prismaMock.attendance.findFirst.mockResolvedValueOnce({
      id: "att-race",
      tenantId: "tenant-1",
      userId: "user-race",
      checkIn: new Date("2026-03-27T01:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      notes: null,
      user: {
        name: "Race User",
        workingHourMode: "FIXED",
        flexibleTargetHour: null,
        attendanceGeofencePolicy: "OPTIONAL",
      },
    } as never);
    prismaMock.attendance.update.mockResolvedValueOnce({
      id: "att-race",
      tenantId: "tenant-1",
      userId: "user-race",
      checkIn: new Date("2026-03-27T01:00:00.000Z"),
      checkOut: manualCheckOutTime,
      status: "ON_TIME",
      notes: null,
    } as never);
    prismaMock.attendance.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.leaveRequest.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.holiday.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.overtime.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.attendanceEvaluation.findFirst.mockResolvedValueOnce(
      null as never,
    );

    await service.checkOut({
      userId: "user-race",
      photoUrl: null,
      location: "Office",
      notes: "Manual checkout",
      offlineTime: manualCheckOutTime,
      tenantId: "tenant-1",
    });

    expect(prismaMock.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att-race" },
        data: expect.objectContaining({
          checkOut: manualCheckOutTime,
          status: "ON_TIME",
        }),
      }),
    );
  });

  it("uses tenant timezone when deciding whether an open session still blocks check-in", async () => {
    const service = new (
      await import("@/modules/attendance/services/AttendanceService")
    ).AttendanceService();
    const checkInTime = new Date("2026-03-27T12:30:00.000Z");

    prismaMock.attendance.findMany.mockResolvedValueOnce([] as never);
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        workingHourMode: "FIXED",
        workDays: null,
      } as never)
      .mockResolvedValueOnce({
        id: "user-sg",
        tenantId: "tenant-sg",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        flexibleTargetHour: null,
        isActive: true,
        shift: null,
        attendanceGeofencePolicy: "OPTIONAL",
      } as never);
    prismaMock.attendance.findFirst
      .mockResolvedValueOnce({
        id: "att-open-sg",
        checkIn: new Date("2026-03-27T01:00:00.000Z"),
        checkOut: null,
        status: "ON_TIME",
        user: {
          workingHourMode: "FIXED",
          flexibleTargetHour: null,
          shift: null,
        },
      } as never)
      .mockResolvedValueOnce(null as never);
    prismaMock.leaveRequest.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.holiday.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.overtime.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.attendanceEvaluation.findFirst.mockResolvedValueOnce(
      null as never,
    );
    prismaMock.attendance.create.mockResolvedValueOnce({
      id: "att-new-sg",
      userId: "user-sg",
      tenantId: "tenant-sg",
      checkIn: checkInTime,
      checkOut: null,
      status: "ON_TIME",
      location: "Office",
      notes: "",
    } as never);

    await expect(
      service.checkIn({
        userId: "user-sg",
        photoUrl: null,
        location: "Office",
        notes: "",
        offlineTime: checkInTime,
        timezone: "Asia/Singapore",
        tenantId: "tenant-sg",
      }),
    ).resolves.toMatchObject({
      attendance: expect.objectContaining({ id: "att-new-sg" }),
    });
  });

  it("uses check-in time when cleaning stale sessions during offline next-day check-in", async () => {
    const service = new (
      await import("@/modules/attendance/services/AttendanceService")
    ).AttendanceService();
    const checkInTime = new Date("2026-03-27T01:30:00.000Z");

    prismaMock.attendance.findMany.mockResolvedValueOnce([
      {
        id: "att-not-stale-offline",
        checkIn: new Date("2026-03-26T02:00:00.000Z"),
        checkOut: null,
        status: "ON_TIME",
        notes: null,
      },
    ] as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-offline",
      tenantId: "tenant-1",
      workingHourMode: "FLEXIBLE",
      startWorkTime: null,
      endWorkTime: null,
      flexibleTargetHour: 8,
      isActive: true,
      shift: null,
      attendanceGeofencePolicy: "OPTIONAL",
    } as never);
    prismaMock.attendance.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.leaveRequest.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.holiday.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.overtime.findFirst.mockResolvedValueOnce(null as never);
    prismaMock.attendanceEvaluation.findFirst.mockResolvedValueOnce(
      null as never,
    );
    prismaMock.attendance.create.mockResolvedValueOnce({
      id: "att-new-offline",
      userId: "user-offline",
      tenantId: "tenant-1",
      checkIn: checkInTime,
      checkOut: null,
      status: "ON_TIME",
      location: "Office",
      notes: "",
    } as never);

    await expect(
      service.checkIn({
        userId: "user-offline",
        photoUrl: null,
        location: "Office",
        notes: "",
        offlineTime: checkInTime,
        timezone: "Asia/Jakarta",
        tenantId: "tenant-1",
      }),
    ).resolves.toMatchObject({
      attendance: expect.objectContaining({ id: "att-new-offline" }),
    });

    expect(prismaMock.attendance.update).not.toHaveBeenCalled();
  });
});
