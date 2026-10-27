import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  invoice: { findUnique: vi.fn() },
  payment: { create: vi.fn() },
}));

vi.mock("@/modules/database", () => ({
  prismaBilling: {
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
  },
  prismaBillingAuth: {},
}));

import { createCustomerPaymentsForInvoices } from "@/modules/finance/repositories/paymentRepository.customer-payments";

describe("createCustomerPaymentsForInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.payment.create.mockImplementation(({ data }) => Promise.resolve(data));
  });

  it("invoice PARTIAL_PAID dibayar sebesar sisa tagihan, bukan total", async () => {
    tx.invoice.findUnique.mockResolvedValue({
      id: "inv-1",
      status: "PARTIAL_PAID",
      totalAmount: BigInt(150000),
      paidAmount: BigInt(50000),
    });

    const [payment] = await createCustomerPaymentsForInvoices({
      customerId: "cust-1",
      tenantId: "tenant-1",
      invoiceIds: ["inv-1"],
      discountAmount: 10000,
      paymentMethod: "MANUAL_bank-1",
    });

    expect(Number(payment.amount)).toBe(90000);
  });
});
