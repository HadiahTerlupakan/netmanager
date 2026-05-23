import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const mockFns = vi.hoisted(() => ({
  processors: [] as Array<{
    queueName: string;
    processor: (job: { data: unknown }) => Promise<unknown>;
  }>,
  addOvertimeAutoCheckoutJob: vi.fn().mockResolvedValue(undefined),
  getOvertimeAutoCheckoutJob: vi.fn(),
  runScheduledAutoCheckout: vi.fn().mockResolvedValue("completed"),
}));

vi.mock("bullmq", () => {
  class WorkerMock {
    name: string;
    closing = false;
    on = vi.fn();
    close = vi.fn();

    constructor(
      queueName: string,
      processor: (job: { data: unknown }) => Promise<unknown>,
    ) {
      this.name = String(queueName);
      mockFns.processors.push({ queueName, processor });
    }
  }

  return {
    Worker: WorkerMock,
  };
});

class RedisMock {
  on = vi.fn();
  once = vi.fn((event: string, callback: () => void) => {
    if (event === "ready") {
      setTimeout(callback, 0);
    }
  });
  duplicate = vi.fn(() => ({
    on: vi.fn(),
    once: vi.fn((event: string, callback: () => void) => {
      if (event === "ready") {
        setTimeout(callback, 0);
      }
    }),
  }));
}

vi.mock("ioredis", () => ({
  default: RedisMock,
}));

vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: <T>(_reason: string, callback: () => Promise<T>) =>
    callback(),
  runWithRequestTenantContext: <T>(_ctx: unknown, callback: () => Promise<T>) =>
    callback(),
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/event-bus/queues", async () => {
  const actual = await vi.importActual<typeof import("@/lib/event-bus/queues")>(
    "@/lib/event-bus/queues",
  );

  return {
    ...actual,
    addOvertimeAutoCheckoutJob: mockFns.addOvertimeAutoCheckoutJob,
    getOvertimeAutoCheckoutJob: mockFns.getOvertimeAutoCheckoutJob,
  };
});

vi.mock("@/modules/overtime/services/OvertimeAutoCheckoutService", () => ({
  OvertimeAutoCheckoutService: {
    runScheduledAutoCheckout: mockFns.runScheduledAutoCheckout,
  },
}));

describe("overtime auto checkout worker startup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFns.processors.length = 0;
    Object.assign(prismaMock, {
      overtimeAutoCheckoutSchedule: prismaMock.overtimeAutoCheckoutSchedule,
    });
  });

  it("rehydrates only schedules whose BullMQ job is missing and stores deterministic job ids", async () => {
    vi.setSystemTime(new Date("2026-04-19T10:00:00.000Z"));

    prismaMock.overtimeAutoCheckoutSchedule.findMany.mockResolvedValueOnce([
      {
        id: "schedule-1",
        overtimeId: "overtime-1",
        version: 2,
        scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
        jobId: "existing-future-job",
        scheduleStatus: "SCHEDULED",
      },
      {
        id: "schedule-2",
        overtimeId: "overtime-2",
        version: 4,
        scheduledFor: new Date("2026-04-19T09:55:00.000Z"),
        jobId: "old-job",
        scheduleStatus: "SCHEDULED",
      },
    ] as never);
    mockFns.getOvertimeAutoCheckoutJob
      .mockResolvedValueOnce({ id: "existing-future-job" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.overtimeAutoCheckoutSchedule.update.mockResolvedValueOnce({
      id: "schedule-2",
    } as never);

    const { rehydrateOvertimeAutoCheckoutJobs } =
      await import("@/lib/event-bus/workers");

    await rehydrateOvertimeAutoCheckoutJobs();

    expect(
      prismaMock.overtimeAutoCheckoutSchedule.findMany,
    ).toHaveBeenCalledWith({
      where: {
        scheduleStatus: "SCHEDULED",
      },
      orderBy: { scheduledFor: "asc" },
    });
    expect(mockFns.getOvertimeAutoCheckoutJob).toHaveBeenNthCalledWith(
      1,
      "existing-future-job",
    );
    expect(mockFns.getOvertimeAutoCheckoutJob).toHaveBeenNthCalledWith(
      2,
      "old-job",
    );
    expect(mockFns.getOvertimeAutoCheckoutJob).toHaveBeenNthCalledWith(
      3,
      "overtime:auto-checkout:schedule-2:v4",
    );
    expect(mockFns.addOvertimeAutoCheckoutJob).toHaveBeenCalledTimes(1);
    expect(mockFns.addOvertimeAutoCheckoutJob).toHaveBeenCalledWith(
      {
        overtimeId: "overtime-2",
        scheduleId: "schedule-2",
        version: 4,
      },
      {
        jobId: "overtime:auto-checkout:schedule-2:v4",
        delay: 0,
      },
    );

    expect(
      prismaMock.overtimeAutoCheckoutSchedule.update,
    ).toHaveBeenCalledTimes(1);
    expect(prismaMock.overtimeAutoCheckoutSchedule.update).toHaveBeenCalledWith(
      {
        where: { overtimeId: "overtime-2" },
        data: { jobId: "overtime:auto-checkout:schedule-2:v4" },
      },
    );
  }, 20000);

  it("skips rehydration when overtime auto checkout table is not migrated yet", async () => {
    prismaMock.overtimeAutoCheckoutSchedule.findMany.mockRejectedValueOnce(
      Object.assign(new Error("missing table"), { code: "P2021" }),
    );

    const { rehydrateOvertimeAutoCheckoutJobs } =
      await import("@/lib/event-bus/workers");

    await expect(rehydrateOvertimeAutoCheckoutJobs()).resolves.toBeUndefined();
    expect(mockFns.addOvertimeAutoCheckoutJob).not.toHaveBeenCalled();
  }, 20000);

  it("processes overtime auto checkout jobs through the dedicated worker", async () => {
    const { startWorkers } = await import("@/lib/event-bus/workers");
    const { QUEUE_NAMES } = await import("@/lib/event-bus/types");

    startWorkers();

    // Wait longer for Redis ready event and worker creation
    await new Promise((resolve) => setTimeout(resolve, 200));

    const overtimeWorker = mockFns.processors.find(
      (item) => item.queueName === QUEUE_NAMES.OVERTIME_AUTO_CHECKOUT,
    );

    expect(overtimeWorker).toBeDefined();

    await overtimeWorker!.processor({
      data: {
        overtimeId: "overtime-1",
        scheduleId: "schedule-1",
        version: 3,
      },
    });

    expect(mockFns.runScheduledAutoCheckout).toHaveBeenCalledWith({
      overtimeId: "overtime-1",
      scheduleId: "schedule-1",
      version: 3,
    });
  }, 20000);
});
