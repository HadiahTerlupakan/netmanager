import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { AutoCheckoutService } from "@/modules/attendance/services/AutoCheckoutService";
import { ATTENDANCE_CONSTANTS } from "@/modules/attendance/utils/constants";

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
    await AutoCheckoutService.runAutoCheckout();

    expect(prismaMock.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE,
          status: "NO_CHECKOUT",
        }),
      }),
    );
  });

  it("queries open sessions by excluding ABSENT placeholders so mangkir rows are not auto-checked out", async () => {
    prismaMock.attendance.findMany.mockResolvedValueOnce([] as never);

    const updatedCount = await AutoCheckoutService.runAutoCheckout();

    expect(updatedCount).toBe(0);
    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: ["ALPHA", "ABSENT"] },
        }),
      }),
    );
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
            status: { notIn: ["ALPHA", "ABSENT"] },
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
