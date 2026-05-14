import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { EVENT_NAMES } from "@/lib/event-bus";

const mockHandleInvoicePaid = vi.hoisted(() => vi.fn());

vi.mock("@/modules/finance/services/AutomaticBillingService", () => ({
  AutomaticBillingService: {
    handleInvoicePaid: mockHandleInvoicePaid,
  },
}));

import { handleInvoicePaidBilling } from "@/modules/finance/services/event-handlers/invoice-paid-billing.handler";

function buildJob(payload: Record<string, unknown>): Job {
  return {
    id: "job-1",
    data: {
      eventName: EVENT_NAMES.INVOICE_PAID,
      payload: { ...payload, timestamp: new Date().toISOString() },
    },
  } as unknown as Job;
}

describe("handleInvoicePaidBilling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("panggil AutomaticBillingService.handleInvoicePaid dengan invoiceId", async () => {
    mockHandleInvoicePaid.mockResolvedValue(undefined);

    await handleInvoicePaidBilling(
      buildJob({ invoiceId: "inv-1", pelangganId: "pel-1" }),
    );

    expect(mockHandleInvoicePaid).toHaveBeenCalledWith("inv-1");
  });

  it("throw kalau invoiceId bukan string", async () => {
    await expect(
      handleInvoicePaidBilling(
        buildJob({ invoiceId: null, pelangganId: "pel-1" }),
      ),
    ).rejects.toThrow(/invoiceId/);
  });

  it("propagate error dari AutomaticBillingService untuk BullMQ retry", async () => {
    mockHandleInvoicePaid.mockRejectedValue(new Error("DB timeout"));

    await expect(
      handleInvoicePaidBilling(
        buildJob({ invoiceId: "inv-1", pelangganId: "pel-1" }),
      ),
    ).rejects.toThrow("DB timeout");
  });
});
