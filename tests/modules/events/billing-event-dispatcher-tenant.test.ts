import { beforeEach, describe, expect, it, vi } from "vitest";

const publish = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@/lib/event-bus", async () => {
  const types = await import("@/lib/event-bus/types");
  return {
    eventBus: { publish },
    EVENT_NAMES: types.EVENT_NAMES,
    JOB_PRIORITIES: types.JOB_PRIORITIES,
  };
});

import { BillingEventDispatcher } from "@/modules/events/dispatchers/BillingEventDispatcher";
import { EVENT_NAMES } from "@/lib/event-bus/types";

/**
 * Worker menjalankan job di konteks tenant hanya bila payload membawa
 * tenantId. INVOICE_PAID dulu tidak membawanya, sehingga komisi reseller
 * (yang menyaring per tenant) tidak pernah terbit.
 */
describe("BillingEventDispatcher — tenantId pada event tagihan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("INVOICE_PAID membawa tenantId tagihan", async () => {
    await BillingEventDispatcher.onInvoicePaid(
      "inv-1",
      "pel-1",
      100000,
      { amountPaid: 100000, couponDiscount: 0, saldoUsed: 0 },
      "tenant-1",
    );

    expect(publish).toHaveBeenCalledWith(
      EVENT_NAMES.INVOICE_PAID,
      expect.objectContaining({ invoiceId: "inv-1", tenantId: "tenant-1" }),
      expect.anything(),
    );
  });

  it("INVOICE_PAID tanpa tenant tidak mengirim tenantId kosong", async () => {
    await BillingEventDispatcher.onInvoicePaid("inv-1", "pel-1", 100000);

    const [, payload] = publish.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(payload).not.toHaveProperty("tenantId");
  });

  it("INVOICE_PARTIALLY_PAID membawa tenantId tagihan", async () => {
    await BillingEventDispatcher.onInvoicePartiallyPaid(
      "inv-1",
      "pel-1",
      30000,
      "tenant-1",
    );

    expect(publish).toHaveBeenCalledWith(
      EVENT_NAMES.INVOICE_PARTIALLY_PAID,
      expect.objectContaining({ tenantId: "tenant-1" }),
    );
  });

  it("INVOICE_VOIDED diterbitkan dengan payload apa adanya", async () => {
    const payload = {
      invoiceId: "inv-1",
      pelangganId: "pel-1",
      previousStatus: "PAID",
      voidedAt: "2026-11-03T00:00:00.000Z",
      tenantId: "tenant-1",
    };

    await BillingEventDispatcher.onInvoiceVoided(payload);

    expect(publish).toHaveBeenCalledWith(
      EVENT_NAMES.INVOICE_VOIDED,
      payload,
      expect.anything(),
    );
  });
});
