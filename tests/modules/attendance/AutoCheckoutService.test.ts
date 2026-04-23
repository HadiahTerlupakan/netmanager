import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { AutoCheckoutService } from "@/modules/attendance/services/AutoCheckoutService";
import { ATTENDANCE_CONSTANTS } from "@/modules/attendance/utils/constants";
import { getTimezone } from "@/lib/utils/get-timezone";

vi.mock("@/lib/utils/get-timezone", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/utils/get-timezone")>();
  return {
    ...actual,
    getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
  };
});

describe("AutoCheckoutService semantics", () => {
  beforeEach(() => {
    vi.mocked(getTimezone).mockResolvedValue("Asia/Jakarta");
    prismaMock.attendance.findMany.mockResolvedValue([
      {
        id: "att-1",
        checkIn: new Date("2026-03-27T06:37:00.000Z"),
        checkOut: null,
        status: "LATE",
        notes: null,
        user: {
          name: "Ubaidilah",
          workingHourMode: "FIXED",
          shift: null,
        },
      },
    ] as never);
    prismaMock.attendance.update.mockResolvedValue({ id: "att-1" } as never);
  });

  it("writes the canonical auto-checkout note instead of the legacy Mangkir note", async () => {
    await AutoCheckoutService.runAutoCheckout("tenant-1");

    expect(prismaMock.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE,
          status: "NO_CHECKOUT",
        }),
      }),
    );
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
});
