import { beforeEach, describe, expect, it, vi } from "vitest";
import { OvertimeStatus } from "@prisma/client";

const mockOvertimeRepo = {
  findAll: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/modules/overtime/repositories/OvertimeRepository", () => ({
  OvertimeRepository: class MockOvertimeRepository {
    findAll = mockOvertimeRepo.findAll;
    update = mockOvertimeRepo.update;
  },
}));

describe("OvertimeAutoCheckoutService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T20:30:00.000Z"));
  });

  it("should complete overtime automatically at 8 hours from start time", async () => {
    const { OvertimeAutoCheckoutService } =
      await import("@/modules/overtime/services/OvertimeAutoCheckoutService");

    mockOvertimeRepo.findAll.mockResolvedValueOnce([
      {
        id: "overtime-1",
        userId: "user-1",
        startTime: new Date("2026-04-18T10:00:00.000Z"),
        status: OvertimeStatus.IN_PROGRESS,
      },
    ]);
    mockOvertimeRepo.update.mockResolvedValueOnce({
      id: "overtime-1",
      status: OvertimeStatus.COMPLETED,
      endTime: new Date("2026-04-18T18:00:00.000Z"),
      duration: 480,
    });

    const updatedCount = await OvertimeAutoCheckoutService.runAutoCheckout();

    expect(mockOvertimeRepo.findAll).toHaveBeenCalledWith({
      status: OvertimeStatus.IN_PROGRESS,
    });
    expect(mockOvertimeRepo.update).toHaveBeenCalledWith("overtime-1", {
      status: OvertimeStatus.COMPLETED,
      endTime: new Date("2026-04-18T18:00:00.000Z"),
      duration: 480,
    });
    expect(updatedCount).toBe(1);
  });

  it("should ignore overtime that has not reached 8 hours yet", async () => {
    const { OvertimeAutoCheckoutService } =
      await import("@/modules/overtime/services/OvertimeAutoCheckoutService");

    mockOvertimeRepo.findAll.mockResolvedValueOnce([
      {
        id: "overtime-2",
        userId: "user-2",
        startTime: new Date("2026-04-18T15:00:00.000Z"),
        status: OvertimeStatus.IN_PROGRESS,
      },
    ]);

    const updatedCount = await OvertimeAutoCheckoutService.runAutoCheckout();

    expect(mockOvertimeRepo.update).not.toHaveBeenCalled();
    expect(updatedCount).toBe(0);
  });
});
