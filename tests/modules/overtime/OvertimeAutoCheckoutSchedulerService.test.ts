import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const addOvertimeAutoCheckoutJob = vi.fn();
const removeOvertimeAutoCheckoutJob = vi.fn();

vi.mock("@/lib/event-bus/queues", () => ({
  addOvertimeAutoCheckoutJob,
  removeOvertimeAutoCheckoutJob,
}));

describe("OvertimeAutoCheckoutSchedulerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("schedule creates delayed job", async () => {
    const fixedNow = new Date("2026-04-19T10:00:00.000Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(fixedNow);

    prismaMock.overtimeAutoCheckoutSchedule.findUnique.mockResolvedValueOnce(
      null as never,
    );
    prismaMock.overtimeAutoCheckoutSchedule.upsert.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      jobId: null,
      scheduleStatus: "SCHEDULED",
    } as never);
    prismaMock.overtimeAutoCheckoutSchedule.update.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      jobId: "overtime:auto-checkout:schedule-1:v3",
      scheduleStatus: "SCHEDULED",
    } as never);

    const { OvertimeAutoCheckoutSchedulerService } =
      await import("@/modules/overtime/services/OvertimeAutoCheckoutSchedulerService");

    const service = new OvertimeAutoCheckoutSchedulerService();
    await service.schedule({
      overtimeId: "overtime-1",
      startTime: new Date("2026-04-19T10:00:00.000Z"),
    });

    expect(prismaMock.overtimeAutoCheckoutSchedule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { overtimeId: "overtime-1" },
      }),
    );
    expect(addOvertimeAutoCheckoutJob).toHaveBeenCalledWith(
      {
        overtimeId: "overtime-1",
        scheduleId: "schedule-1",
        version: 3,
      },
      {
        jobId: "overtime:auto-checkout:schedule-1:v3",
        delay: 8 * 60 * 60 * 1000,
      },
    );
    expect(prismaMock.overtimeAutoCheckoutSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { overtimeId: "overtime-1" },
        data: { jobId: "overtime:auto-checkout:schedule-1:v3" },
      }),
    );
  });

  it("schedule removes previous delayed job before rescheduling", async () => {
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-19T11:00:00.000Z").getTime(),
    );

    prismaMock.overtimeAutoCheckoutSchedule.findUnique
      .mockResolvedValueOnce({
        id: "schedule-1",
        overtimeId: "overtime-1",
        version: 2,
        jobId: "overtime:auto-checkout:schedule-1:v2",
        scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
        scheduleStatus: "SCHEDULED",
      } as never)
      .mockResolvedValueOnce({
        id: "schedule-1",
        overtimeId: "overtime-1",
        version: 3,
        jobId: "overtime:auto-checkout:schedule-1:v3",
        scheduledFor: new Date("2026-04-19T19:00:00.000Z"),
        scheduleStatus: "SCHEDULED",
      } as never);

    prismaMock.overtimeAutoCheckoutSchedule.upsert.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      jobId: null,
      scheduledFor: new Date("2026-04-19T19:00:00.000Z"),
      scheduleStatus: "SCHEDULED",
    } as never);

    prismaMock.overtimeAutoCheckoutSchedule.update.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      jobId: "overtime:auto-checkout:schedule-1:v3",
      scheduledFor: new Date("2026-04-19T19:00:00.000Z"),
      scheduleStatus: "SCHEDULED",
    } as never);

    const { OvertimeAutoCheckoutSchedulerService } =
      await import("@/modules/overtime/services/OvertimeAutoCheckoutSchedulerService");

    const service = new OvertimeAutoCheckoutSchedulerService();
    await service.schedule({
      overtimeId: "overtime-1",
      startTime: new Date("2026-04-19T11:00:00.000Z"),
    });

    expect(removeOvertimeAutoCheckoutJob).toHaveBeenCalledWith(
      "overtime:auto-checkout:schedule-1:v2",
    );
    expect(addOvertimeAutoCheckoutJob).toHaveBeenCalledWith(
      expect.objectContaining({ version: 3 }),
      expect.objectContaining({
        jobId: "overtime:auto-checkout:schedule-1:v3",
      }),
    );
  });

  it("cancel removes delayed job and marks schedule cancelled", async () => {
    prismaMock.overtimeAutoCheckoutSchedule.findUnique.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      jobId: "overtime:auto-checkout:schedule-1:v3",
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      scheduleStatus: "SCHEDULED",
    } as never);

    prismaMock.overtimeAutoCheckoutSchedule.updateMany.mockResolvedValueOnce({
      count: 1,
    } as never);

    const { OvertimeAutoCheckoutSchedulerService } =
      await import("@/modules/overtime/services/OvertimeAutoCheckoutSchedulerService");

    const service = new OvertimeAutoCheckoutSchedulerService();
    await service.cancel("overtime-1");

    expect(removeOvertimeAutoCheckoutJob).toHaveBeenCalledWith(
      "overtime:auto-checkout:schedule-1:v3",
    );
    expect(
      prismaMock.overtimeAutoCheckoutSchedule.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          overtimeId: "overtime-1",
          scheduleStatus: "SCHEDULED",
        },
        data: expect.objectContaining({
          scheduleStatus: "CANCELLED",
          jobId: null,
        }),
      }),
    );
  });
});
