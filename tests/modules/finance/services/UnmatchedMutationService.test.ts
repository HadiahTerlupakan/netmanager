import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnmatchedMutationService } from "@/modules/finance/services/UnmatchedMutationService";

function createDeps() {
  const createdPayments: Array<{ id: string }> = [];

  const unmatchedRepo = {
    findById: vi.fn().mockResolvedValue({
      id: "mut-1",
      amount: "150000",
      date: new Date("2026-09-01T00:00:00.000Z"),
      transactionId: "TRX-1",
      provider: "BCA",
    }),
    update: vi.fn().mockResolvedValue({ id: "mut-1", status: "RESOLVED" }),
    count: vi.fn(),
    findMany: vi.fn(),
  };

  const billingRepo = {
    findInvoiceById: vi.fn().mockResolvedValue({
      id: "inv-1",
      pelangganId: "cust-1",
      payment: [],
    }),
    createPayment: vi.fn(async (data: { id: string }) => {
      createdPayments.push({ id: data.id });
      return data;
    }),
  };

  return { unmatchedRepo, billingRepo, createdPayments };
}

describe("UnmatchedMutationService.resolve — id pembayaran", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  // Regresi: id dibentuk dari `PAY-${Date.now()}`. Dua resolusi dalam
  // milidetik yang sama menghasilkan id identik dan menabrak primary key.
  it("menghasilkan id unik walau jam sistem beku di milidetik yang sama", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T10:00:00.000Z"));

    const deps = createDeps();
    const service = new UnmatchedMutationService(
      deps.unmatchedRepo as never,
      deps.billingRepo as never,
    );

    await service.resolve({
      mutationId: "mut-1",
      invoiceId: "inv-1",
      userId: "admin-1",
    });
    await service.resolve({
      mutationId: "mut-1",
      invoiceId: "inv-1",
      userId: "admin-1",
    });

    vi.useRealTimers();

    expect(deps.createdPayments).toHaveLength(2);
    expect(deps.createdPayments[0]?.id).not.toBe(deps.createdPayments[1]?.id);
  });

  it("tidak memakai timestamp sebagai id pembayaran", async () => {
    const deps = createDeps();
    const service = new UnmatchedMutationService(
      deps.unmatchedRepo as never,
      deps.billingRepo as never,
    );

    await service.resolve({
      mutationId: "mut-1",
      invoiceId: "inv-1",
      userId: "admin-1",
    });

    expect(deps.createdPayments[0]?.id).not.toMatch(/^PAY-\d+$/);
  });
});
