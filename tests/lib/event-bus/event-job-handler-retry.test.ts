import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventJobData } from "@/lib/event-bus/queues";

const registry = vi.hoisted(() => ({
  handlers: [] as Array<(job: unknown) => Promise<void>>,
}));

vi.mock("@/lib/event-bus/event-handlers", () => ({
  getEventHandlers: () => registry.handlers,
}));
vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: { publish: vi.fn() },
}));

import { processEventJob } from "@/lib/event-bus/worker-processors";

function fakeJob() {
  const job = {
    data: {
      eventName: "billing:invoice.paid",
      payload: { invoiceId: "inv-1" },
      category: "billing",
      timestamp: "2026-10-28T00:00:00.000Z",
    } as EventJobData,
    updateData: vi.fn(async (data: EventJobData) => {
      job.data = data;
    }),
  };
  return job as typeof job & Job<EventJobData>;
}

describe("processEventJob handler isolation", () => {
  let notify: ReturnType<typeof vi.fn>;
  let accounting: ReturnType<typeof vi.fn>;
  let tax: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    notify = vi.fn(async () => {});
    accounting = vi.fn(async () => {});
    tax = vi.fn(async () => {});
    Object.defineProperty(notify, "name", { value: "handleNotify" });
    Object.defineProperty(accounting, "name", { value: "handleAccounting" });
    Object.defineProperty(tax, "name", { value: "handleTax" });
    registry.handlers = [notify, accounting, tax];
  });

  it("still runs the handlers after a failing one, then fails the job", async () => {
    accounting.mockRejectedValueOnce(new Error("column missing"));
    const job = fakeJob();

    await expect(processEventJob(job)).rejects.toThrow(
      /handleAccounting: column missing/,
    );
    expect(notify).toHaveBeenCalledTimes(1);
    expect(tax).toHaveBeenCalledTimes(1);
  });

  it("on retry runs only the handler that failed", async () => {
    accounting.mockRejectedValueOnce(new Error("column missing"));
    const job = fakeJob();

    await expect(processEventJob(job)).rejects.toThrow();
    await processEventJob(job);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(tax).toHaveBeenCalledTimes(1);
    expect(accounting).toHaveBeenCalledTimes(2);
  });

  it("leaves job data alone when every handler succeeds", async () => {
    const job = fakeJob();

    await processEventJob(job);

    expect(job.updateData).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
