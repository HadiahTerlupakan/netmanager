import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

const queueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const queueGetJob = vi.hoisted(() => vi.fn());
const queueClose = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const queueConstructor = vi.hoisted(() => vi.fn());
const queueRemove = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("bullmq", () => {
  class QueueMock {
    constructor(name: string, options: unknown) {
      queueConstructor(name, options);
    }

    add = queueAdd;
    getJob = queueGetJob;
    close = queueClose;
    getWaitingCount = vi.fn().mockResolvedValue(0);
    getActiveCount = vi.fn().mockResolvedValue(0);
    getCompletedCount = vi.fn().mockResolvedValue(0);
    getFailedCount = vi.fn().mockResolvedValue(0);
    getDelayedCount = vi.fn().mockResolvedValue(0);
  }

  return { Queue: QueueMock };
});

describe("Overtime Task 2 repository + queue contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("upserts schedule metadata and enqueues deterministic delayed job", async () => {
    prismaMock.overtimeAutoCheckoutSchedule.findUnique.mockResolvedValueOnce({
      overtimeId: "overtime-1",
      version: 2,
    } as never);
    prismaMock.overtimeAutoCheckoutSchedule.upsert.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      jobId: null,
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      scheduleStatus: "SCHEDULED",
    } as never);

    const { OvertimeRepository } =
      await import("@/modules/overtime/repositories/OvertimeRepository");
    const { addOvertimeAutoCheckoutJob } =
      await import("@/lib/event-bus/queues");

    const repository = new OvertimeRepository();
    const scheduledFor = new Date("2026-04-19T18:00:00.000Z");
    const schedule = await repository.upsertAutoCheckoutSchedule({
      overtimeId: "overtime-1",
      scheduledFor,
      jobId: null,
    });

    const deterministicJobId = `overtime:auto-checkout:${schedule.id}:v${schedule.version}`;

    await addOvertimeAutoCheckoutJob(
      {
        overtimeId: schedule.overtimeId,
        scheduleId: schedule.id,
        version: schedule.version,
      },
      {
        jobId: deterministicJobId,
        delay: 8 * 60 * 60 * 1000,
      },
    );

    expect(
      prismaMock.overtimeAutoCheckoutSchedule.findUnique,
    ).toHaveBeenCalledWith({
      where: { overtimeId: "overtime-1" },
      select: { version: true },
    });
    expect(prismaMock.overtimeAutoCheckoutSchedule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { overtimeId: "overtime-1" },
        create: expect.objectContaining({
          overtimeId: "overtime-1",
          scheduledFor,
          version: 3,
          jobId: null,
          scheduleStatus: "SCHEDULED",
        }),
        update: expect.objectContaining({
          scheduledFor,
          version: 3,
          jobId: null,
          scheduleStatus: "SCHEDULED",
        }),
      }),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      "overtime-auto-checkout",
      {
        overtimeId: "overtime-1",
        scheduleId: "schedule-1",
        version: 3,
      },
      expect.objectContaining({
        jobId: "overtime:auto-checkout:schedule-1:v3",
        delay: 8 * 60 * 60 * 1000,
      }),
    );
  });

  it("provides overtime auto-checkout queue helper contract", async () => {
    const { QUEUE_NAMES } = await import("@/lib/event-bus/types");
    const {
      addOvertimeAutoCheckoutJob,
      removeOvertimeAutoCheckoutJob,
      closeAllQueues,
    } = await import("@/lib/event-bus/queues");

    queueGetJob.mockResolvedValueOnce({ remove: queueRemove });

    expect(QUEUE_NAMES).toMatchObject({
      OVERTIME_AUTO_CHECKOUT: "radpro-overtime-auto-checkout",
    });

    await addOvertimeAutoCheckoutJob(
      { overtimeId: "overtime-1", scheduleId: "schedule-1", version: 3 },
      { jobId: "overtime:auto-checkout:schedule-1:v3", delay: 1200 },
    );

    await removeOvertimeAutoCheckoutJob("overtime:auto-checkout:schedule-1:v3");
    await closeAllQueues();

    expect(queueConstructor).toHaveBeenCalledWith(
      "radpro-overtime-auto-checkout",
      expect.any(Object),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      "overtime-auto-checkout",
      { overtimeId: "overtime-1", scheduleId: "schedule-1", version: 3 },
      expect.objectContaining({
        jobId: "overtime:auto-checkout:schedule-1:v3",
        delay: 1200,
      }),
    );
    expect(queueGetJob).toHaveBeenCalledWith(
      "overtime:auto-checkout:schedule-1:v3",
    );
    expect(queueRemove).toHaveBeenCalledTimes(1);
    expect(queueClose).toHaveBeenCalled();
  });
});
