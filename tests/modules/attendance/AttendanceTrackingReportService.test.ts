import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttendanceTrackingReportService } from "@/modules/attendance/services/AttendanceTrackingReportService";

const at = (time: string) => new Date(`2026-10-20T${time}:00.000Z`);

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    userId: "user-1",
    checkIn: at("01:00"),
    checkOut: at("09:00") as Date | null,
    status: "ON_TIME",
    correctedAt: null as Date | null,
    ...overrides,
  };
}

describe("AttendanceTrackingReportService", () => {
  const repo = { findRecordedAtForUser: vi.fn() };
  const service = new AttendanceTrackingReportService(repo);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(at("12:00"));
    repo.findRecordedAtForUser.mockResolvedValue([]);
  });

  it("totals the silent stretches of each session in minutes", async () => {
    repo.findRecordedAtForUser.mockResolvedValue([
      at("01:20"),
      at("01:50"),
      at("08:50"),
    ]);

    const minutes = await service.trackingOffMinutes([row()]);

    // 01:50 → 08:50 tanpa titik.
    expect(minutes.get("att-1")).toBe(420);
  });

  it("counts a session still open only up to now", async () => {
    const minutes = await service.trackingOffMinutes([row({ checkOut: null })]);

    expect(minutes.get("att-1")).toBe(660);
  });

  it("does not judge leave, absence or corrected rows", async () => {
    const minutes = await service.trackingOffMinutes([
      row({ id: "sick", status: "SICK" }),
      row({ id: "fixed", correctedAt: at("10:00") }),
    ]);

    expect(minutes.get("sick")).toBeNull();
    expect(minutes.get("fixed")).toBeNull();
  });

  it("does not judge sessions from before the always-on tracking release", async () => {
    const minutes = await service.trackingOffMinutes([
      row({
        checkIn: new Date("2026-10-18T01:00:00.000Z"),
        checkOut: new Date("2026-10-18T09:00:00.000Z"),
      }),
    ]);

    expect(minutes.get("att-1")).toBeNull();
    expect(repo.findRecordedAtForUser).not.toHaveBeenCalled();
  });

  it("reads each employee's points only across that employee's own sessions", async () => {
    await service.trackingOffMinutes([
      row({
        id: "a",
        userId: "user-1",
        checkIn: at("01:00"),
        checkOut: at("02:00"),
      }),
      row({
        id: "b",
        userId: "user-2",
        checkIn: at("05:00"),
        checkOut: at("06:00"),
      }),
    ]);

    expect(
      repo.findRecordedAtForUser.mock.calls.map(([input]) => input),
    ).toEqual([
      { userId: "user-1", from: at("01:00"), to: at("02:00") },
      { userId: "user-2", from: at("05:00"), to: at("06:00") },
    ]);
  });
});
