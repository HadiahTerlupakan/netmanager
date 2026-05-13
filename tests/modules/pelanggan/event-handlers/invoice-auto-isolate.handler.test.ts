import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { handleInvoiceAutoIsolate } from "@/modules/pelanggan/services/event-handlers/invoice-auto-isolate.handler";
import { EVENT_NAMES } from "@/lib/event-bus";

const mockExecute = vi.fn();

vi.mock("@/modules/finance", () => ({
  AutomaticIsolationExecutionService: vi
    .fn()
    .mockImplementation(function (this: { execute: typeof mockExecute }) {
      this.execute = mockExecute;
    }),
}));

function buildJob(payload: Record<string, unknown>): Job {
  return {
    data: {
      eventName: EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED,
      payload: { ...payload, timestamp: new Date().toISOString() },
    },
  } as unknown as Job;
}

describe("InvoiceAutoIsolateHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("memanggil executor dengan invoiceId dan pelangganId dari payload", async () => {
    mockExecute.mockResolvedValue(true);
    const job = buildJob({
      invoiceId: "inv-1",
      pelangganId: "cust-1",
      invoiceNumber: "INV/2026/001",
    });

    await handleInvoiceAutoIsolate(job);
    expect(mockExecute).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      pelangganId: "cust-1",
    });
  });

  it("melempar error supaya BullMQ retry ketika executor throw", async () => {
    mockExecute.mockRejectedValueOnce(new Error("DB connection error"));
    const job = buildJob({
      invoiceId: "inv-1",
      pelangganId: "cust-1",
      invoiceNumber: "INV/2026/001",
    });
    await expect(handleInvoiceAutoIsolate(job)).rejects.toThrow(
      "DB connection error",
    );
  });

  it("tetap sukses kalau executor return false (pelanggan sudah di-isolate atau settings disabled)", async () => {
    mockExecute.mockResolvedValue(false);
    const job = buildJob({
      invoiceId: "inv-1",
      pelangganId: "cust-1",
      invoiceNumber: "INV/2026/001",
    });
    await expect(handleInvoiceAutoIsolate(job)).resolves.not.toThrow();
  });

  it("melempar error ketika payload.invoiceId bukan string", async () => {
    const job = buildJob({
      invoiceId: 12345,
      pelangganId: "cust-1",
      invoiceNumber: "INV/2026/001",
    });
    await expect(handleInvoiceAutoIsolate(job)).rejects.toThrow(/invoiceId/);
  });

  it("melempar error ketika payload.pelangganId kosong", async () => {
    const job = buildJob({
      invoiceId: "inv-1",
      pelangganId: "",
      invoiceNumber: "INV/2026/001",
    });
    await expect(handleInvoiceAutoIsolate(job)).rejects.toThrow(/pelangganId/);
  });
});
