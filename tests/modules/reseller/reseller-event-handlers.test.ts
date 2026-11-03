import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { EventJobData } from "@/lib/event-bus/queues";

const fakeService = vi.hoisted(() => ({
  accrueFromPaidInvoice: vi.fn(),
  cancelAccruedForUnpaidInvoice: vi.fn(),
}));

vi.mock("@/modules/reseller/services/ResellerCommissionService", () => ({
  getResellerCommissionService: () => fakeService,
}));

import {
  handleInvoicePaidResellerCommission,
  handleInvoiceUnpaidResellerCommission,
} from "@/modules/reseller/services/reseller-event-handlers";
import { EVENT_NAMES } from "@/lib/event-bus/types";
import {
  getEventHandlers,
  registerDefaultHandlers,
} from "@/lib/event-bus/event-handlers";

function jobWith(payload: Record<string, unknown>): Job<EventJobData> {
  return { data: { payload } } as unknown as Job<EventJobData>;
}

describe("reseller event handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the event tenant to accrual", async () => {
    await handleInvoicePaidResellerCommission(
      jobWith({
        tenantId: "tenant-1",
        invoiceId: "invoice-1",
        pelangganId: "pelanggan-1",
        amount: 200000,
        paidAt: "2026-07-08T00:00:00.000Z",
      }),
    );

    expect(fakeService.accrueFromPaidInvoice).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      invoiceId: "invoice-1",
      pelangganId: "pelanggan-1",
      amount: 200000,
      paidAt: new Date("2026-07-08T00:00:00.000Z"),
    });
  });

  it("rejects a malformed paid payload", async () => {
    await expect(
      handleInvoicePaidResellerCommission(jobWith({ invoiceId: "invoice-1" })),
    ).rejects.toThrow("Payload invoice paid tidak valid");
  });

  // Audit #13: void invoice PAID harus membatalkan komisi yang belum disettle.
  it("cancels accrued commissions when a paid invoice is voided", async () => {
    fakeService.cancelAccruedForUnpaidInvoice.mockResolvedValueOnce(1);

    await handleInvoiceUnpaidResellerCommission(
      jobWith({ tenantId: "tenant-1", invoiceId: "invoice-1" }),
    );

    expect(fakeService.cancelAccruedForUnpaidInvoice).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      invoiceId: "invoice-1",
    });
  });

  it("registers the unpaid handler on INVOICE_VOIDED", () => {
    registerDefaultHandlers();

    expect(getEventHandlers(EVENT_NAMES.INVOICE_VOIDED)).toContain(
      handleInvoiceUnpaidResellerCommission,
    );
  });

  // Reviewer: PAID yang turun karena payment di-refund/dihapus juga harus
  // menahan komisi ACCRUED.
  it("registers the unpaid handler on INVOICE_PAYMENT_REVERTED", () => {
    registerDefaultHandlers();

    expect(getEventHandlers(EVENT_NAMES.INVOICE_PAYMENT_REVERTED)).toContain(
      handleInvoiceUnpaidResellerCommission,
    );
  });
});
