import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({ cancelSchedules: vi.fn() }));

vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  cancelInvoiceBillingSchedules: palsu.cancelSchedules,
}));

import { handlePaidInvoiceCustomerState } from "@/modules/finance/services/automatic-billing-payment.helpers";

const CUSTOMER = {
  id: "cust-1",
  jatuhTempo: new Date("2026-11-26T17:00:00.000Z"), // 27 Nov WIB
  tipe: "REGULER",
  status: "AKTIF",
};

function setup(invoice: { invoiceNumber: string; dueDate: Date }) {
  const invoiceRepo = {
    findUnique: vi.fn().mockResolvedValue({
      id: "inv-1",
      pelangganId: "cust-1",
      status: "PAID",
      ...invoice,
    }),
  };
  const pelangganBridge = {
    findById: vi.fn().mockResolvedValue(CUSTOMER),
    updateJatuhTempo: vi.fn(),
  };
  return { invoiceRepo, pelangganBridge };
}

/**
 * Melunasi invoice prorate (selisih upgrade di tengah periode) dulu
 * memindahkan jatuh tempo ke jatuh tempo prorate (+7 hari) + 1 bulan:
 * upgrade 28 Okt dengan jatuh tempo 27 Nov berakhir di 4 Des.
 */
describe("jatuh tempo setelah invoice lunas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invoice prorate tidak menggeser jatuh tempo pelanggan", async () => {
    const deps = setup({
      invoiceNumber: "PRORATE/1793144094127/abc123",
      dueDate: new Date("2026-11-03T17:00:00.000Z"),
    });

    await handlePaidInvoiceCustomerState({
      invoiceId: "inv-1",
      invoiceRepo: deps.invoiceRepo as never,
      pelangganBridge: deps.pelangganBridge as never,
    });

    expect(deps.pelangganBridge.updateJatuhTempo).not.toHaveBeenCalled();
    expect(palsu.cancelSchedules).toHaveBeenCalledWith("inv-1");
  });

  it("invoice langganan biasa tetap memperpanjang jatuh tempo", async () => {
    const deps = setup({
      invoiceNumber: "INV/2026/11/27-ABC",
      dueDate: new Date("2026-11-26T17:00:00.000Z"),
    });

    await handlePaidInvoiceCustomerState({
      invoiceId: "inv-1",
      invoiceRepo: deps.invoiceRepo as never,
      pelangganBridge: deps.pelangganBridge as never,
    });

    expect(deps.pelangganBridge.updateJatuhTempo).toHaveBeenCalledWith(
      "cust-1",
      new Date("2026-12-26T17:00:00.000Z"),
    );
  });
});
