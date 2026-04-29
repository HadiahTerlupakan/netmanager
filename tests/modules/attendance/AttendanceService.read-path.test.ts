import { describe, expect, it, vi } from "vitest";

import { service } from "./AttendanceService.test-setup";

describe("attendance read-path joinDate guard", () => {
  it("filters history rows before user joinDate", async () => {
    const attendanceRepo = (
      service as never as {
        attendanceRepo: {
          findManyForHistory: ReturnType<typeof vi.fn>;
          countByUserId: ReturnType<typeof vi.fn>;
        };
      }
    ).attendanceRepo;

    vi.spyOn(attendanceRepo, "findManyForHistory").mockResolvedValue([
      {
        id: "att-before-join",
        checkIn: new Date("2026-03-20T01:00:00.000Z"),
        checkOut: new Date("2026-03-20T10:00:00.000Z"),
        status: "ON_TIME",
      },
      {
        id: "att-after-join",
        checkIn: new Date("2026-04-02T01:00:00.000Z"),
        checkOut: new Date("2026-04-02T10:00:00.000Z"),
        status: "LATE",
      },
    ] as never);
    vi.spyOn(attendanceRepo, "countByUserId").mockResolvedValue(2);
    vi.spyOn(
      (
        service as never as {
          userRepo: {
            findAttendanceSettingsById: (userId: string) => Promise<unknown>;
          };
        }
      ).userRepo,
      "findAttendanceSettingsById",
    ).mockResolvedValue({
      joinDate: new Date("2026-04-01T00:00:00.000Z"),
    });

    const result = await service.getAttendanceHistory("user-1", {
      page: 1,
      limit: 10,
    });

    expect(result.attendances).toHaveLength(1);
    expect(result.attendances[0]).toMatchObject({ id: "att-after-join" });
    expect(result.pagination.total).toBe(1);
  });

  it("filters analytics rows before user joinDate", async () => {
    const attendanceRepo = (
      service as never as {
        attendanceRepo: {
          findManyForAnalytics: ReturnType<typeof vi.fn>;
        };
      }
    ).attendanceRepo;

    vi.spyOn(attendanceRepo, "findManyForAnalytics").mockResolvedValue([
      {
        id: "att-before-join",
        checkIn: new Date("2026-03-20T01:00:00.000Z"),
        checkOut: new Date("2026-03-20T10:00:00.000Z"),
        status: "ON_TIME",
      },
      {
        id: "att-after-join",
        checkIn: new Date("2026-04-02T01:00:00.000Z"),
        checkOut: new Date("2026-04-02T10:00:00.000Z"),
        status: "LATE",
      },
    ] as never);
    vi.spyOn(
      (
        service as never as {
          userRepo: {
            findAttendanceSettingsById: (userId: string) => Promise<unknown>;
          };
        }
      ).userRepo,
      "findAttendanceSettingsById",
    ).mockResolvedValue({
      joinDate: new Date("2026-04-01T00:00:00.000Z"),
    });

    const result = await service.getAttendanceAnalytics("user-1", 30);

    expect(result.stats.totalDays).toBe(1);
    expect(result.recentAttendance).toHaveLength(1);
    expect(result.recentAttendance[0]).toMatchObject({
      id: "att-after-join",
    });
  });
});
