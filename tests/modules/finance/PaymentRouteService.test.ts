import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  findPelangganById: vi.fn(),
  findInvoice: vi.fn(),
  findInvoiceWithPayment: vi.fn(),
  findPaginatedWithInvoice: vi.fn(),
  createPaymentWithInvoice: vi.fn(),
  updateInvoicePaymentStatus: vi.fn(),
  findPaymentWithInvoice: vi.fn(),
}));

vi.mock("@/modules/pelanggan/repositories/PelangganRepository", () => ({
  PelangganRepository: class MockPelangganRepository {
    findById = mockFns.findPelangganById;
  },
}));

vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: class MockInvoiceRepository {
    findRawById = mockFns.findInvoice;
    findWithPayment = mockFns.findInvoiceWithPayment;
    updatePaymentStatus = mockFns.updateInvoicePaymentStatus;
  },
}));

vi.mock("@/modules/finance/repositories/PaymentRepository", () => ({
  PaymentRepository: class MockPaymentRepository {
    findPaginatedWithInvoice = mockFns.findPaginatedWithInvoice;
    createWithInvoice = mockFns.createPaymentWithInvoice;
    findByIdWithInvoice = mockFns.findPaymentWithInvoice;
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
    logActivitySafe: vi.fn(),
    logAuth: vi.fn(),
    apiRequest: vi.fn(),
    dbOperation: vi.fn(),
  },
  logActivitySafe: vi.fn(),
}));

import {
  createPaymentForRoute,
  getPaymentForRoute,
  listPaymentsForRoute,
} from "@/modules/finance/services/PaymentRouteService";

describe("PaymentRouteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists payments with date filters and pagination", async () => {
    mockFns.findPaginatedWithInvoice.mockResolvedValue({
      data: [{ id: "pay-1" }],
      total: 1,
    });

    await listPaymentsForRoute({
      filters: {
        pelangganId: "cust-1",
        paymentMethod: "BANK_TRANSFER",
        startDate: "2026-04-01",
        endDate: "2026-04-30",
        page: 1,
        limit: 20,
      },
    });

    expect(mockFns.findPaginatedWithInvoice).toHaveBeenCalledWith({
      where: {
        pelangganId: "cust-1",
        paymentMethod: "BANK_TRANSFER",
        paymentDate: {
          gte: new Date("2026-04-01"),
          lte: new Date("2026-04-30"),
        },
      },
      page: 1,
      limit: 20,
    });
  });

  it("creates payment and updates linked invoice status", async () => {
    mockFns.findPelangganById.mockResolvedValue({ id: "cust-1" });
    mockFns.findInvoice.mockResolvedValue({ id: "inv-1" });
    mockFns.createPaymentWithInvoice.mockResolvedValue({
      id: "pay-1",
      invoice: { id: "inv-1" },
    });
    mockFns.findInvoiceWithPayment.mockResolvedValue({
      id: "inv-1",
      totalAmount: 100000n,
      status: "SENT",
      payment: [{ amount: 50000n }, { amount: 50000n }],
    });

    const result = await createPaymentForRoute({
      input: {
        invoiceId: "inv-1",
        pelangganId: "cust-1",
        amount: 50000,
        paymentDate: "2026-04-10",
        paymentMethod: "CASH",
      },
      user: { id: "user-1" },
    });

    expect(result).toEqual({
      status: "created",
      data: { id: "pay-1", invoice: { id: "inv-1" } },
    });
    expect(mockFns.updateInvoicePaymentStatus).toHaveBeenCalledWith("inv-1", {
      paidAmount: 100000n,
      status: "PAID",
      paidAt: expect.any(Date),
    });
  });

  it("returns not found when pelanggan is missing", async () => {
    mockFns.findPelangganById.mockResolvedValue(null);

    await expect(
      createPaymentForRoute({
        input: {
          pelangganId: "cust-1",
          amount: 50000,
          paymentDate: "2026-04-10",
          paymentMethod: "CASH",
        },
        user: { id: "user-1" },
      }),
    ).resolves.toEqual({ status: "pelanggan-not-found" });
  });

  it("forbids non-super-admin access outside payment site", async () => {
    mockFns.findPaymentWithInvoice.mockResolvedValue({
      id: "pay-1",
      tenantId: "tenant-2",
      invoice: { siteId: "site-2" },
    });

    await expect(
      getPaymentForRoute({
        paymentId: "pay-1",
        user: { isSuperAdmin: false, siteId: "site-1", tenantId: "tenant-1" },
      }),
    ).resolves.toEqual({ status: "forbidden-site" });
  });
});
