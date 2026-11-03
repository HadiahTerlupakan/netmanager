import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { EventJobData } from "@/lib/event-bus/queues";

const fakeService = vi.hoisted(() => ({
  accrueFromPaidInvoice: vi.fn(),
}));
const fakeReversalService = vi.hoisted(() => ({
  reverseForUnpaidInvoice: vi.fn(),
}));

vi.mock("@/modules/reseller/services/ResellerCommissionService", () => ({
  getResellerCommissionService: () => fakeService,
}));
vi.mock(
  "@/modules/reseller/services/ResellerCommissionReversalService",
  () => ({
    getResellerCommissionReversalService: () => fakeReversalService,
  }),
);

import {
  handleInvoicePaidResellerCommission,
  handleInvoiceUnpaidResellerCommission,
} from "@/modules/reseller/services/reseller-event-handlers";
import { EVENT_NAMES } from "@/lib/event-bus/types";
import {
  getEventHandlers,
  registerDefaultHandlers,
} from "@/lib/event-bus/event-handlers";

function jobWith(
  payload: Record<string, unknown>,
  eventName = "billing:invoice.paid",
): Job<EventJobData> {
  return { data: { payload, eventName } } as unknown as Job<EventJobData>;
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

  // Audit #13 + clawback: void membalik komisi; alasan koreksi mengikuti event.
  it("reverses commissions when a paid invoice is voided", async () => {
    fakeReversalService.reverseForUnpaidInvoice.mockResolvedValueOnce({
      cancelledCount: 1,
      clawbackCount: 0,
    });

    await handleInvoiceUnpaidResellerCommission(
      jobWith(
        { tenantId: "tenant-1", invoiceId: "invoice-1" },
        EVENT_NAMES.INVOICE_VOIDED,
      ),
    );

    expect(fakeReversalService.reverseForUnpaidInvoice).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      invoiceId: "invoice-1",
      reason: "Invoice di-void setelah komisi dibayar",
    });
  });

  it("records the payment-reverted reason on a reverted payment", async () => {
    fakeReversalService.reverseForUnpaidInvoice.mockResolvedValueOnce({
      cancelledCount: 0,
      clawbackCount: 1,
    });

    await handleInvoiceUnpaidResellerCommission(
      jobWith({ invoiceId: "invoice-1" }, EVENT_NAMES.INVOICE_PAYMENT_REVERTED),
    );

    expect(fakeReversalService.reverseForUnpaidInvoice).toHaveBeenCalledWith({
      tenantId: null,
      invoiceId: "invoice-1",
      reason: "Pelunasan invoice ditarik setelah komisi dibayar",
    });
  });

  it("rejects a malformed unpaid payload", async () => {
    await expect(
      handleInvoiceUnpaidResellerCommission(jobWith({ tenantId: "t" })),
    ).rejects.toThrow("Payload invoice unpaid tidak valid");
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
