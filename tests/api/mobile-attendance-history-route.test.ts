import { NextRequest, NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";
import { cache } from "@/lib/cache";

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiPaginated: (data: unknown, meta: unknown) =>
    NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

describe("mobile attendance history route", () => {
  let getMobileAttendanceHistory: (typeof import("@/app/api/mobile/attendance/history/route"))["GET"];

  beforeAll(async () => {
    vi.useRealTimers();
    ({ GET: getMobileAttendanceHistory } =
      await import("@/app/api/mobile/attendance/history/route"));
  });

  beforeEach(() => {
    vi.useFakeTimers();
    cache.clear();
    prismaMock.attendance.findMany.mockResolvedValue([]);
    prismaMock.attendance.count.mockResolvedValue(0);
    prismaMock.holiday.findFirst.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      workDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      workingHourMode: "FLEXIBLE",
    });
    prismaMock.leaveRequest.findFirst.mockResolvedValue(null);
  });

  it("keeps holiday metadata active on tukar libur replacement day when the calendar marks a holiday", async () => {
    vi.setSystemTime(new Date("2026-03-20T02:24:00.000Z"));
    prismaMock.holiday.findFirst.mockResolvedValue({
      id: "holiday-replacement-day",
      date: new Date("2026-03-20T00:00:00.000Z"),
      description: "Hari Raya",
      tenantId: "tenant-1",
    });
    prismaMock.leaveRequest.findFirst.mockResolvedValue({
      id: "leave-1",
      userId: "user-1",
      tenantId: "tenant-1",
      type: "TUKAR_LIBUR",
      status: "APPROVED",
      startDate: new Date("2026-03-18T00:00:00.000Z"),
      replacementDate: new Date("2026-03-20T00:00:00.000Z"),
    });

    const response = await getMobileAttendanceHistory(
      new NextRequest(
        "http://localhost/api/mobile/attendance/history?page=1&limit=10",
      ),
      {
        query: {
          page: "1",
          limit: "10",
        },
        session: {
          user: {
            id: "user-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.today).toMatchObject({
      isHoliday: true,
      holidayName: "Hari Raya",
      isOffDay: false,
      isTukarLiburWorkDay: true,
      isTukarLiburLeaveDay: false,
    });
  });

  it("excludes history rows before user joinDate", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      joinDate: new Date("2026-04-01T00:00:00.000Z"),
    } as never);
    prismaMock.attendance.findMany.mockResolvedValueOnce([
      {
        id: "att-before-join",
        userId: "user-1",
        tenantId: "tenant-1",
        checkIn: new Date("2026-03-20T01:00:00.000Z"),
        checkOut: new Date("2026-03-20T10:00:00.000Z"),
        status: "ON_TIME",
        user: {
          workingHourMode: "FIXED",
          flexibleTargetHour: null,
          shift: null,
        },
      },
      {
        id: "att-after-join",
        userId: "user-1",
        tenantId: "tenant-1",
        checkIn: new Date("2026-04-02T01:00:00.000Z"),
        checkOut: new Date("2026-04-02T10:00:00.000Z"),
        status: "LATE",
        user: {
          workingHourMode: "FIXED",
          flexibleTargetHour: null,
          shift: null,
        },
      },
    ] as never);
    prismaMock.attendance.count.mockResolvedValueOnce(2);

    const response = await getMobileAttendanceHistory(
      new NextRequest(
        "http://localhost/api/mobile/attendance/history?page=1&limit=10",
      ),
      {
        query: {
          page: "1",
          limit: "10",
        },
        session: {
          user: {
            id: "user-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("att-after-join");
  });
});
