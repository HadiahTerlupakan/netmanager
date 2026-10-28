// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { GatewayTransactionsResponse } from "@/app/admin/finance/payment-gateway/transaction-types";

const data: GatewayTransactionsResponse = {
  total: 1,
  page: 1,
  limit: 20,
  summary: [{ status: "CANCELLED", count: 1, amount: 11100 }],
  items: [
    {
      id: "p-va",
      checkoutId: "c-va",
      pelangganId: "cust-1",
      customerName: "TES LAB 02",
      invoiceId: "inv-1",
      invoiceNumber: "INV/2026/10/28-771907EB0151",
      invoiceStatus: "PAID",
      amount: 11100,
      discountAmount: 0,
      gateway: "DUITKU",
      methodCode: "BC",
      methodName: "BCA Virtual Account",
      gatewayStatus: "CANCELLED",
      status: "DIGANTI_METODE",
      reference: "PAY-VA",
      transactionId: "DS3715826GVEO4776KHCL30Y",
      pgTransactionId: "BC261EVTS1N27GPDQE5",
      fee: 5000,
      receivedAmount: 6100,
      vaNumber: "7007014007428430",
      paymentUrl: null,
      expiresAt: "2026-10-29T01:02:31Z",
      paidAt: null,
      createdAt: "2026-10-28T01:02:31Z",
      updatedAt: "2026-10-28T01:03:04Z",
    },
  ],
};

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: () => ({ data, isLoading: false, error: null as Error | null }),
}));

import PaymentGatewayTransactionsClient from "@/app/admin/finance/payment-gateway/PaymentGatewayTransactionsClient";

describe("halaman transaksi payment gateway", () => {
  it("menampilkan pelanggan, metode, dan status yang dapat dibaca", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<PaymentGatewayTransactionsClient />));

    const text = container.textContent ?? "";
    expect(text).toContain("TES LAB 02");
    expect(text).toContain("INV/2026/10/28-771907EB0151");
    expect(text).toContain("BCA Virtual Account");
    expect(text).toContain("7007014007428430");
    expect(text).toContain("Diganti metode");
    expect(text).toContain("Rp 11.100");
    // Kolom seperti catatan pembayaran Duitku.
    expect(text).toContain("DS3715826GVEO4776KHCL30Y");
    expect(text).toContain("PAY-VA");
    expect(text).toContain("BC261EVTS1N27GPDQE5");
    expect(text).toContain("Rp 6.100");
    expect(text).toContain("Rp 5.000");
    act(() => root.unmount());
  });
});
