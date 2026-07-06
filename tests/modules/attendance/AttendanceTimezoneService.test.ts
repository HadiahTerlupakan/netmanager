import { beforeEach, describe, expect, it, vi } from "vitest";

import { redisMock } from "../../setup";
import { AttendanceTimezoneService } from "@/modules/attendance";
import { SettingsRepository } from "@/modules/attendance/repositories/SettingsRepository";

describe("AttendanceTimezoneService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redisMock.get).mockReset();
    vi.mocked(redisMock.setex).mockReset();
    vi.mocked(redisMock.del).mockReset();
    vi.mocked(redisMock.get).mockResolvedValue(null);
    vi.mocked(redisMock.setex).mockResolvedValue("OK");
    vi.mocked(redisMock.del).mockResolvedValue(1);
  });

  it("falls back to repository when redis get fails for timezone", async () => {
    vi.mocked(redisMock.get).mockRejectedValueOnce(new Error("redis down"));
    vi.mocked(redisMock.setex).mockRejectedValueOnce(new Error("redis down"));
    vi.spyOn(SettingsRepository.prototype, "findByKey").mockResolvedValueOnce({
      key: "GENERAL_TIMEZONE",
      value: "Asia/Makassar",
    } as never);

    const service = new AttendanceTimezoneService();
    const result = await service.getTimezone("tenant-1");

    expect(result).toBe("Asia/Makassar");
    expect(SettingsRepository.prototype.findByKey).toHaveBeenCalledWith(
      "GENERAL_TIMEZONE",
      "tenant-1",
    );
  });

  it("falls back to repository when redis get fails for tolerance", async () => {
    vi.mocked(redisMock.get).mockRejectedValueOnce(new Error("redis down"));
    vi.mocked(redisMock.setex).mockRejectedValueOnce(new Error("redis down"));
    vi.spyOn(SettingsRepository.prototype, "findByKey").mockResolvedValueOnce({
      key: "GENERAL_ATTENDANCE_TOLERANCE",
      value: "15",
    } as never);

    const service = new AttendanceTimezoneService();
    const result = await service.getTolerance("tenant-1");

    expect(result).toBe(15);
    expect(SettingsRepository.prototype.findByKey).toHaveBeenCalledWith(
      "GENERAL_ATTENDANCE_TOLERANCE",
      "tenant-1",
    );
  });

  it("uses tenant tolerance when calculating attendance status", async () => {
    vi.spyOn(SettingsRepository.prototype, "findByKey").mockResolvedValueOnce({
      key: "GENERAL_ATTENDANCE_TOLERANCE",
      value: "15",
    } as never);

    const service = new AttendanceTimezoneService();
    const status = await service.calculateStatus(
      new Date("2026-07-06T01:10:00.000Z"),
      "08:00",
      "Asia/Jakarta",
      "tenant-1",
    );

    expect(status).toBe("ON_TIME");
    expect(SettingsRepository.prototype.findByKey).toHaveBeenCalledWith(
      "GENERAL_ATTENDANCE_TOLERANCE",
      "tenant-1",
    );
  });
});
