import { describe, expect, it, vi } from "vitest";

import { prismaMock, redisMock, service } from "./AttendanceService.test-setup";

describe("redis cache resilience", () => {
  it("falls back to database when user schedule cache is unavailable during check-in", async () => {
    vi.mocked(redisMock.get).mockRejectedValueOnce(new Error("redis down"));
    vi.mocked(redisMock.setex).mockRejectedValueOnce(new Error("redis down"));

    prismaMock.user.findUnique.mockResolvedValueOnce({
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      workingHourMode: "FIXED",
      shiftId: null,
      attendanceGeofencePolicy: "WARN",
      shift: null,
    });
    prismaMock.attendance.findMany.mockResolvedValueOnce([]);
    prismaMock.attendance.findFirst.mockResolvedValueOnce(null);
    prismaMock.attendance.create.mockResolvedValueOnce({
      id: "att-redis-fallback",
      userId: "user-1",
      tenantId: "tenant-1",
      checkIn: new Date("2026-03-08T01:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      location: "HQ",
      notes: "",
    } as never);
    prismaMock.leaveRequest.findFirst.mockResolvedValueOnce(null);
    prismaMock.holiday.findFirst.mockResolvedValueOnce(null);
    prismaMock.overtime.findFirst.mockResolvedValueOnce(null);
    prismaMock.attendanceEvaluation.findFirst.mockResolvedValueOnce(null);

    const result = await service.checkIn({
      userId: "user-1",
      tenantId: "tenant-1",
      photoUrl: null,
      location: "HQ",
      notes: "",
    });

    expect(result.attendance).toMatchObject({ id: "att-redis-fallback" });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
  });
});
