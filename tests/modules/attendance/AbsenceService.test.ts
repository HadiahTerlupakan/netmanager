import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { AbsenceService } from "@/modules/attendance/services/AbsenceService";
import { HolidayRepository } from "@/modules/attendance/repositories/HolidayRepository";

describe("AbsenceService canonical absence status", () => {
  let service: AbsenceService;

  beforeEach(() => {
    service = new AbsenceService();
    vi.spyOn(HolidayRepository.prototype, "findMany").mockResolvedValue(
      [] as never,
    );
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        tenantId: "tenant-1",
        name: "Budi",
        workDays: "Mon,Tue,Wed,Thu,Fri",
        workingHourMode: "FIXED",
        isAttendanceRequired: true,
      },
    ] as never);
    prismaMock.attendance.findFirst.mockResolvedValue(null);
    prismaMock.leaveRequest.findFirst.mockResolvedValue(null);
    prismaMock.attendance.create.mockResolvedValue({ id: "att-1" } as never);
  });

  it("skips ABSENT generation for users who are not required to attend", async () => {
    prismaMock.user.findMany.mockImplementationOnce(
      async (args: { where?: { isAttendanceRequired?: boolean } }) => {
        if (args?.where?.isAttendanceRequired === true) {
          return [];
        }

        return [
          {
            id: "user-1",
            tenantId: "tenant-1",
            name: "Direktur",
            workDays: "Mon,Tue,Wed,Thu,Fri",
            workingHourMode: "FIXED",
            isAttendanceRequired: false,
          },
        ];
      },
    );

    const result = await service.processDailyAbsence(
      new Date("2026-03-02T00:00:00.000Z"),
      "tenant-1",
    );

    expect(prismaMock.attendance.create).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 0, absent: 0, dayOff: 0 });
  });

  it("skips DAY_OFF sync generation for users who are not required to attend", async () => {
    prismaMock.user.findMany.mockImplementationOnce(
      async (args: { where?: { isAttendanceRequired?: boolean } }) => {
        if (args?.where?.isAttendanceRequired === true) {
          return [];
        }

        return [
          {
            id: "user-1",
            tenantId: "tenant-1",
            name: "Direktur",
            workDays: "Mon,Tue,Wed,Thu,Fri",
            workingHourMode: "FIXED",
            isAttendanceRequired: false,
          },
        ];
      },
    );

    await service.syncDayOffAttendanceRange(
      new Date("2026-03-29T00:00:00.000Z"),
      new Date("2026-03-29T00:00:00.000Z"),
      "tenant-1",
    );

    expect(prismaMock.attendance.create).not.toHaveBeenCalled();
  });

  it("skips historical DAY_OFF sync before user joinDate", async () => {
    prismaMock.user.findMany.mockImplementationOnce(
      async (args: {
        where?: { OR?: Array<{ joinDate?: null | { lte: Date } }> };
      }) => {
        const joinDateFilter = args?.where?.OR;
        const hasJoinDateGuard =
          Array.isArray(joinDateFilter) &&
          joinDateFilter.some((item) => item.joinDate === null) &&
          joinDateFilter.some(
            (item) => item.joinDate && "lte" in item.joinDate,
          );

        if (hasJoinDateGuard) {
          return [];
        }

        return [
          {
            id: "user-1",
            tenantId: "tenant-1",
            name: "Karyawan Baru",
            workDays: "Mon,Tue,Wed,Thu,Fri",
            workingHourMode: "FIXED",
            isAttendanceRequired: true,
            joinDate: new Date("2026-04-01T00:00:00.000Z"),
          },
        ];
      },
    );

    await service.syncDayOffAttendanceRange(
      new Date("2026-03-29T00:00:00.000Z"),
      new Date("2026-03-29T00:00:00.000Z"),
      "tenant-1",
    );

    expect(prismaMock.attendance.create).not.toHaveBeenCalled();
  });

  it("creates ABSENT placeholder records instead of ALPHA for new daily absences", async () => {
    const result = await service.processDailyAbsence(
      new Date("2026-03-02T00:00:00.000Z"),
      "tenant-1",
    );

    expect(prismaMock.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          userId: "user-1",
          status: "ABSENT",
        }),
      }),
    );
    expect(result).toEqual({ processed: 1, absent: 1, dayOff: 0 });
  });

  it("creates DAY_OFF placeholder records for holidays so they can appear in Data Absensi from DB", async () => {
    vi.spyOn(HolidayRepository.prototype, "findMany").mockResolvedValueOnce([
      { id: "holiday-1", description: "Nyepi" },
    ] as never);

    const result = await service.processDailyAbsence(
      new Date("2026-03-29T00:00:00.000Z"),
      "tenant-1",
    );

    expect(prismaMock.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          userId: "user-1",
          status: "DAY_OFF",
        }),
      }),
    );
    expect(result).toEqual({
      processed: 1,
      absent: 0,
      dayOff: 1,
      message: "Holiday",
    });
  });

  it("creates DAY_OFF placeholder records for scheduled off-days so they can appear in Data Absensi from DB", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      {
        id: "user-1",
        tenantId: "tenant-1",
        name: "Budi",
        workDays: "Mon,Tue,Wed,Thu,Fri",
        workingHourMode: "FIXED",
        isAttendanceRequired: true,
      },
    ] as never);

    const result = await service.processDailyAbsence(
      new Date("2026-03-29T00:00:00.000Z"),
      "tenant-1",
    );

    expect(prismaMock.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          userId: "user-1",
          status: "DAY_OFF",
        }),
      }),
    );
    expect(result).toEqual({ processed: 1, absent: 0, dayOff: 1 });
  });
});
