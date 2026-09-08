import { beforeEach, describe, expect, it, vi } from "vitest";

const queueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const queueClose = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const queueGetJob = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const queueConstructor = vi.hoisted(() => vi.fn());

const mockFns = vi.hoisted(() => ({
  processors: [] as Array<{
    queueName: string;
    processor: (job: { data: unknown }) => Promise<unknown>;
  }>,
  runAutoCheckoutJob: vi.fn().mockResolvedValue({
    attendanceId: "attendance-1",
    status: "processed",
  }),
  runWithRequestTenantContext: vi.fn(
    <T>(_ctx: unknown, callback: () => Promise<T>) => callback(),
  ),
  runAsSystemContext: vi.fn(<T>(_reason: string, callback: () => Promise<T>) =>
    callback(),
  ),
}));

vi.mock("bullmq", () => {
  class QueueMock {
    constructor(name: string, options: unknown) {
      queueConstructor(name, options);
    }

    add = queueAdd;
    close = queueClose;
    getJob = queueGetJob;
    getWaitingCount = vi.fn().mockResolvedValue(0);
    getActiveCount = vi.fn().mockResolvedValue(0);
    getCompletedCount = vi.fn().mockResolvedValue(0);
    getFailedCount = vi.fn().mockResolvedValue(0);
    getDelayedCount = vi.fn().mockResolvedValue(0);
  }

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
    Queue: QueueMock,
    Worker: WorkerMock,
  };
});

class RedisMock {
  on = vi.fn();
  once = vi.fn((event: string, callback: () => void) => {
    if (event === "ready") {
      // Immediately call the callback to simulate ready state
      setTimeout(callback, 0);
    }
  });
  duplicate = vi.fn(() => ({ on: vi.fn(), once: vi.fn() }));
}

vi.mock("ioredis", () => ({ default: RedisMock, Redis: RedisMock }));

vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: mockFns.runAsSystemContext,
  runWithRequestTenantContext: mockFns.runWithRequestTenantContext,
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/modules/attendance/services/AutoCheckoutService", () => ({
  AutoCheckoutService: {
    runAutoCheckoutJob: mockFns.runAutoCheckoutJob,
  },
}));

describe("attendance auto checkout worker startup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    queueGetJob.mockResolvedValue(null);
    mockFns.processors.length = 0;
  });

  it("adds deterministic attendance auto-checkout jobs", async () => {
    const { addAttendanceAutoCheckoutJob } =
      await import("@/lib/event-bus/queues");

    await addAttendanceAutoCheckoutJob(
      {
        attendanceId: "attendance-1",
        tenantId: "tenant-1",
        mode: "FIXED",
        expectedAutoCheckoutAt: "2026-04-24T10:00:00.000Z",
        sourceCheckInDate: "2026-04-24",
      },
      { jobId: "attendance.auto-checkout.attendance-1" },
    );

    expect(queueConstructor).toHaveBeenCalledWith(
      "radpro-attendance-auto-checkout",
      expect.any(Object),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      "attendance-auto-checkout",
      {
        attendanceId: "attendance-1",
        tenantId: "tenant-1",
        mode: "FIXED",
        expectedAutoCheckoutAt: "2026-04-24T10:00:00.000Z",
        sourceCheckInDate: "2026-04-24",
      },
      expect.objectContaining({
        jobId: "attendance.auto-checkout.attendance-1",
      }),
    );
  });

  it("removes completed deterministic job before re-enqueueing attendance auto-checkout", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const getState = vi.fn().mockResolvedValue("completed");
    queueGetJob.mockResolvedValueOnce({ getState, remove });

    const { addAttendanceAutoCheckoutJob } =
      await import("@/lib/event-bus/queues");

    await addAttendanceAutoCheckoutJob(
      {
        attendanceId: "attendance-1",
        tenantId: "tenant-1",
        mode: "FIXED",
        expectedAutoCheckoutAt: "2026-04-24T10:01:00.000Z",
        sourceCheckInDate: "2026-04-24",
      },
      { jobId: "attendance.auto-checkout.attendance-1" },
    );

    expect(queueGetJob).toHaveBeenCalledWith(
      "attendance.auto-checkout.attendance-1",
    );
    expect(getState).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(queueAdd).toHaveBeenCalledWith(
      "attendance-auto-checkout",
      expect.objectContaining({
        expectedAutoCheckoutAt: "2026-04-24T10:01:00.000Z",
      }),
      expect.objectContaining({
        jobId: "attendance.auto-checkout.attendance-1",
      }),
    );
  });

  it("removes only failed attendance auto-checkout job before recovery enqueue", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const getState = vi.fn().mockResolvedValue("failed");
    queueGetJob.mockResolvedValueOnce({ getState, remove });

    const { removeFailedAttendanceAutoCheckoutJob } =
      await import("@/lib/event-bus/queues");

    const removed = await removeFailedAttendanceAutoCheckoutJob(
      "attendance.auto-checkout.attendance-1",
    );

    expect(removed).toBe(true);
    expect(queueGetJob).toHaveBeenCalledWith(
      "attendance.auto-checkout.attendance-1",
    );
    expect(getState).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });

  it("keeps non-failed deterministic job untouched", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const getState = vi.fn().mockResolvedValue("completed");
    queueGetJob.mockResolvedValueOnce({ getState, remove });

    const { removeFailedAttendanceAutoCheckoutJob } =
      await import("@/lib/event-bus/queues");

    const removed = await removeFailedAttendanceAutoCheckoutJob(
      "attendance.auto-checkout.attendance-1",
    );

    expect(removed).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it("registers and dispatches the dedicated attendance auto-checkout worker", async () => {
    const { startWorkers } = await import("@/lib/event-bus/workers");
    const { QUEUE_NAMES } = await import("@/lib/event-bus/types");

    startWorkers();

    // Wait for Redis ready event to trigger worker creation
    await new Promise((resolve) => setTimeout(resolve, 100));

    const attendanceWorker = mockFns.processors.find(
      (item) => item.queueName === QUEUE_NAMES.ATTENDANCE_AUTO_CHECKOUT,
    );

    expect(attendanceWorker).toBeDefined();

    await attendanceWorker!.processor({
      data: {
        attendanceId: "attendance-1",
        tenantId: "tenant-1",
        mode: "FIXED",
        expectedAutoCheckoutAt: "2026-04-24T10:00:00.000Z",
        sourceCheckInDate: "2026-04-24",
      },
    });

    expect(mockFns.runAutoCheckoutJob).toHaveBeenCalledWith({
      attendanceId: "attendance-1",
      tenantId: "tenant-1",
      mode: "FIXED",
      expectedAutoCheckoutAt: "2026-04-24T10:00:00.000Z",
      sourceCheckInDate: "2026-04-24",
    });

    // Job ini membawa tenantId di top-level (bukan di payload). Worker WAJIB
    // menjalankannya dalam konteks tenant tersebut, bukan jatuh ke system
    // context (super admin lintas tenant) yang membocorkan isolasi.
    expect(mockFns.runWithRequestTenantContext).toHaveBeenCalledWith(
      { tenantId: "tenant-1", isSuperAdmin: false },
      expect.any(Function),
    );
    expect(mockFns.runAsSystemContext).not.toHaveBeenCalled();
  }, 20000);
});
