import { beforeEach, describe, expect, it, vi } from "vitest";
import { OvertimeStatus } from "@prisma/client";

const mockOvertimeRepo = {
  findById: vi.fn(),
  findAutoCheckoutScheduleById: vi.fn(),
  completeAutoCheckoutSchedule: vi.fn(),
  completeScheduledAutoCheckout: vi.fn(),
};

vi.mock("@/modules/overtime/repositories/OvertimeRepository", () => ({
  OvertimeRepository: class MockOvertimeRepository {
    findById = mockOvertimeRepo.findById;
    findAutoCheckoutScheduleById =
      mockOvertimeRepo.findAutoCheckoutScheduleById;
    completeAutoCheckoutSchedule =
      mockOvertimeRepo.completeAutoCheckoutSchedule;
    completeScheduledAutoCheckout =
      mockOvertimeRepo.completeScheduledAutoCheckout;
  },
}));

describe("OvertimeAutoCheckoutService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T18:00:00.000Z"));
  });

  it("completes one overtime when schedule is still active and version matches", async () => {
    mockOvertimeRepo.findAutoCheckoutScheduleById.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      scheduleStatus: "SCHEDULED",
    });
    mockOvertimeRepo.findById.mockResolvedValueOnce({
      id: "overtime-1",
      status: OvertimeStatus.IN_PROGRESS,
      startTime: new Date("2026-04-19T10:00:00.000Z"),
    });
    mockOvertimeRepo.completeScheduledAutoCheckout.mockResolvedValueOnce(true);

    const { OvertimeAutoCheckoutService } =
      await import("@/modules/overtime/services/OvertimeAutoCheckoutService");

    const result = await OvertimeAutoCheckoutService.runScheduledAutoCheckout({
      overtimeId: "overtime-1",
      scheduleId: "schedule-1",
      version: 3,
    });

    expect(mockOvertimeRepo.completeScheduledAutoCheckout).toHaveBeenCalledWith(
      {
        scheduleId: "schedule-1",
        overtimeId: "overtime-1",
        version: 3,
        executedAt: new Date("2026-04-19T18:00:00.000Z"),
        endTime: new Date("2026-04-19T18:00:00.000Z"),
        duration: 480,
      },
    );
    expect(result).toBe("completed");
  });

  it("skips stale jobs when schedule version no longer matches", async () => {
    mockOvertimeRepo.findAutoCheckoutScheduleById.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 4,
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      scheduleStatus: "SCHEDULED",
    });

    const { OvertimeAutoCheckoutService } =
      await import("@/modules/overtime/services/OvertimeAutoCheckoutService");

    const result = await OvertimeAutoCheckoutService.runScheduledAutoCheckout({
      overtimeId: "overtime-1",
      scheduleId: "schedule-1",
      version: 3,
    });

    expect(mockOvertimeRepo.findById).not.toHaveBeenCalled();
    expect(result).toBe("skipped");
  });

  it("skips when schedule is no longer active", async () => {
    mockOvertimeRepo.findAutoCheckoutScheduleById.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      scheduleStatus: "CANCELLED",
    });

    const { OvertimeAutoCheckoutService } =
      await import("@/modules/overtime/services/OvertimeAutoCheckoutService");

    const result = await OvertimeAutoCheckoutService.runScheduledAutoCheckout({
      overtimeId: "overtime-1",
      scheduleId: "schedule-1",
      version: 3,
    });

    expect(mockOvertimeRepo.findById).not.toHaveBeenCalled();
    expect(result).toBe("skipped");
  });

  it("marks the schedule as failed when overtime is no longer in progress", async () => {
    mockOvertimeRepo.findAutoCheckoutScheduleById.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      scheduleStatus: "SCHEDULED",
    });
    mockOvertimeRepo.findById.mockResolvedValueOnce({
      id: "overtime-1",
      status: OvertimeStatus.COMPLETED,
      startTime: new Date("2026-04-19T10:00:00.000Z"),
    });
    mockOvertimeRepo.completeAutoCheckoutSchedule.mockResolvedValueOnce({
      id: "schedule-1",
    });

    const { OvertimeAutoCheckoutService } =
      await import("@/modules/overtime/services/OvertimeAutoCheckoutService");

    const result = await OvertimeAutoCheckoutService.runScheduledAutoCheckout({
      overtimeId: "overtime-1",
      scheduleId: "schedule-1",
      version: 3,
    });

    expect(mockOvertimeRepo.completeAutoCheckoutSchedule).toHaveBeenCalledWith({
      overtimeId: "overtime-1",
      executedAt: new Date("2026-04-19T18:00:00.000Z"),
      scheduleStatus: "FAILED",
      lastError: "OVERTIME_AUTO_CHECKOUT_STALE",
    });
    expect(
      mockOvertimeRepo.completeScheduledAutoCheckout,
    ).not.toHaveBeenCalled();
    expect(result).toBe("skipped");
  });

  it("skips when compare-and-set completion fails", async () => {
    mockOvertimeRepo.findAutoCheckoutScheduleById.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      scheduleStatus: "SCHEDULED",
    });
    mockOvertimeRepo.findById.mockResolvedValueOnce({
      id: "overtime-1",
      status: OvertimeStatus.IN_PROGRESS,
      startTime: new Date("2026-04-19T10:00:00.000Z"),
    });
    mockOvertimeRepo.completeScheduledAutoCheckout.mockResolvedValueOnce(false);

    const { OvertimeAutoCheckoutService } =
      await import("@/modules/overtime/services/OvertimeAutoCheckoutService");

    const result = await OvertimeAutoCheckoutService.runScheduledAutoCheckout({
      overtimeId: "overtime-1",
      scheduleId: "schedule-1",
      version: 3,
    });

    expect(result).toBe("skipped");
  });
});
