import { beforeEach, describe, expect, it, vi } from "vitest";

import { redisMock, prismaMock } from "../../setup";
import { HolidayRepository } from "@/modules/attendance/repositories/HolidayRepository";

describe("HolidayRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redisMock.get).mockReset();
    vi.mocked(redisMock.setex).mockReset();
    vi.mocked(redisMock.incr).mockReset();
    vi.mocked(redisMock.get).mockResolvedValue(null);
    vi.mocked(redisMock.setex).mockResolvedValue("OK");
    vi.mocked(redisMock.incr).mockResolvedValue(1);
    prismaMock.holiday.findFirst.mockResolvedValue(null);
  });

  it("does not reuse previous local-day holiday cache after midnight Asia/Jakarta", async () => {
    const repo = new HolidayRepository();

    prismaMock.holiday.findFirst
      .mockResolvedValueOnce({
        id: "holiday-yesterday",
        date: new Date("2026-03-18T00:00:00.000Z"),
        description: "Nyepi",
        tenantId: "tenant-1",
      })
      .mockResolvedValueOnce(null);

    const lateNightYesterday = await repo.isHoliday(
      new Date("2026-03-18T16:30:00.000Z"),
      "tenant-1",
    );
    const earlyMorningToday = await repo.isHoliday(
      new Date("2026-03-18T18:30:00.000Z"),
      "tenant-1",
    );

    expect(lateNightYesterday.isHoliday).toBe(true);
    expect(earlyMorningToday.isHoliday).toBe(false);
    expect(prismaMock.holiday.findFirst).toHaveBeenCalledTimes(2);
  });

  it("falls back to database when redis cache is unavailable", async () => {
    vi.mocked(redisMock.get).mockRejectedValueOnce(new Error("redis down"));
    vi.mocked(redisMock.setex).mockRejectedValueOnce(new Error("redis down"));
    prismaMock.holiday.findFirst.mockResolvedValueOnce({
      id: "holiday-1",
      date: new Date("2026-03-18T00:00:00.000Z"),
      description: "Nyepi",
      tenantId: "tenant-1",
    });

    const repo = new HolidayRepository();
    const result = await repo.isHoliday(
      new Date("2026-03-18T03:00:00.000Z"),
      "tenant-1",
    );

    expect(result).toMatchObject({
      isHoliday: true,
      holiday: expect.objectContaining({ id: "holiday-1" }),
    });
    expect(prismaMock.holiday.findFirst).toHaveBeenCalledTimes(1);
  });

  it("uses a versioned cache namespace for holiday lookups", async () => {
    vi.mocked(redisMock.get)
      .mockResolvedValueOnce("0")
      .mockResolvedValueOnce(
        JSON.stringify({
          isHoliday: true,
          holiday: {
            id: "holiday-versioned",
            tenantId: "tenant-1",
          },
        }),
      );

    const repo = new HolidayRepository();
    const result = await repo.isHoliday(
      new Date("2026-03-18T03:00:00.000Z"),
      "tenant-1",
    );

    expect(result).toMatchObject({
      isHoliday: true,
      holiday: expect.objectContaining({ id: "holiday-versioned" }),
    });
    expect(redisMock.get).toHaveBeenNthCalledWith(
      1,
      "holiday:tenant-1:version",
    );
    expect(redisMock.get).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^holiday:tenant-1:v0:\d+$/),
    );
  });
});
