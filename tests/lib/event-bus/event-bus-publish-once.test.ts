import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresi: event yang persistent sekaligus async masuk antrean dua kali —
 * sekali langsung dari publish, sekali lagi oleh outbox processor yang
 * mengirim baris PENDING yang sama. Di router lab, setiap isolir, aktifkan
 * kembali, dan ganti paket memutus sesi pelanggan dua kali berselang 1–4
 * detik (satu siklus polling outbox), dan handler lain (notifikasi, MRR,
 * komisi) ikut berjalan dua kali.
 */

const saveToOutbox = vi.fn();
const markEventProcessed = vi.fn();
const fetchPendingEvents = vi.fn();
const markEventFailed = vi.fn();
const addEventJob = vi.fn();

vi.mock("@/lib/event-bus/outbox", () => ({
  saveToOutbox,
  markEventProcessed,
  fetchPendingEvents,
  markEventFailed,
}));
vi.mock("@/lib/event-bus/queues", () => ({ addEventJob }));
vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: (_label: string, fn: () => unknown) => fn(),
}));

const { eventBus } = await import("@/lib/event-bus/event-bus");
const { EVENT_NAMES } = await import("@/lib/event-bus/types");
const { runOutboxCycle } = await import("@/lib/event-bus/outbox-processor");

const isolated = {
  customerId: "c-1",
  customerName: "TES LAB 02",
  oldStatus: "AKTIF",
  newStatus: "ISOLIR",
};

beforeEach(() => {
  vi.clearAllMocks();
  saveToOutbox.mockResolvedValue("outbox-1");
  addEventJob.mockResolvedValue(undefined);
  markEventProcessed.mockResolvedValue(undefined);
});

describe("eventBus.publish — event persistent + async", () => {
  it("masuk antrean sekali dengan jobId outbox, lalu baris outbox ditutup", async () => {
    await eventBus.publish(EVENT_NAMES.CUSTOMER_ISOLATED, isolated);

    expect(addEventJob).toHaveBeenCalledTimes(1);
    expect(addEventJob.mock.calls[0]![2]).toMatchObject({ jobId: "outbox-1" });
    expect(markEventProcessed).toHaveBeenCalledWith("outbox-1");
  });

  it("outbox processor memakai jobId yang sama sehingga BullMQ menolak kembarannya", async () => {
    fetchPendingEvents.mockResolvedValue([
      {
        id: "outbox-1",
        eventName: EVENT_NAMES.CUSTOMER_ISOLATED,
        payload: isolated,
        priority: 2,
        category: "customer",
        retryCount: 0,
        maxRetries: 5,
        createdAt: new Date(),
      },
    ]);

    await runOutboxCycle();

    expect(addEventJob.mock.calls[0]![2]).toMatchObject({ jobId: "outbox-1" });
  });

  it("gagal kirim langsung membiarkan baris PENDING untuk dikirim processor", async () => {
    addEventJob.mockRejectedValueOnce(new Error("redis down"));

    await eventBus.publish(EVENT_NAMES.CUSTOMER_ISOLATED, isolated);

    expect(markEventProcessed).not.toHaveBeenCalled();
  });
});
