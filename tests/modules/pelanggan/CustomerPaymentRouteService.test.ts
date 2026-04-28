import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  validateInvoicesForPayment: vi.fn(),
  verifyCoupon: vi.fn(),
  recordUsage: vi.fn(),
  incrementUsage: vi.fn(),
  createPaymentsForInvoices: vi.fn(),
  findPelangganById: vi.fn(),
  createGatewayPayment: vi.fn(),
  updateGatewayMetadata: vi.fn(),
}));

vi.mock("@/modules/coupons", () => ({
  couponService: {
    verifyCoupon: mockFns.verifyCoupon,
    recordUsage: mockFns.recordUsage,
    incrementUsage: mockFns.incrementUsage,
  },
  CouponService: class MockCouponService {
    verifyCoupon = mockFns.verifyCoupon;
    recordUsage = mockFns.recordUsage;
    incrementUsage = mockFns.incrementUsage;
  },
}));

vi.mock("@/modules/finance", () => ({
  PaymentGatewayManager: class MockPaymentGatewayManager {
    createPayment = mockFns.createGatewayPayment;
  },
  createCustomerPaymentsForInvoices: mockFns.createPaymentsForInvoices,
  updateCustomerPaymentGatewayMetadata: mockFns.updateGatewayMetadata,
}));

vi.mock("@/modules/pelanggan/services/CustomerPortalService", () => ({
  CustomerPortalService: class MockCustomerPortalService {
    validateInvoicesForPayment = mockFns.validateInvoicesForPayment;
  },
}));

vi.mock("@/modules/pelanggan/repositories/PelangganRepository", () => ({
  PelangganRepository: class MockPelangganRepository {
    findById = mockFns.findPelangganById;
  },
}));

import { createCustomerPaymentForRoute } from "@/modules/pelanggan/services/CustomerPaymentRouteService";

describe("CustomerPaymentRouteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.validateInvoicesForPayment.mockResolvedValue({
      totalAmount: 100000,
    });
    mockFns.createPaymentsForInvoices.mockResolvedValue([
      { id: "pay-1", reference: "PAY-1" },
    ]);
  });

  it("creates manual customer payments through payment repository", async () => {
    const result = await createCustomerPaymentForRoute({
      customerId: "cust-1",
      tenantId: "tenant-1",
      invoiceIds: ["inv-1"],
      paymentMethod: "MANUAL",
      notes: "manual transfer",
    });

    expect(result).toEqual({
      payments: [{ id: "pay-1", reference: "PAY-1" }],
      paymentUrl: null,
      transactionId: null,
    });
    expect(mockFns.createPaymentsForInvoices).toHaveBeenCalledWith({
      customerId: "cust-1",
      tenantId: "tenant-1",
      invoiceIds: ["inv-1"],
      discountAmount: 0,
      paymentMethod: "MANUAL",
      notes: "manual transfer",
      couponId: null,
      couponService: expect.any(Object),
    });
  });

  it("creates gateway payment and stores gateway metadata", async () => {
    mockFns.findPelangganById.mockResolvedValue({
      id: "cust-1",
      nama: "Budi",
      email: "budi@example.com",
      noTelp: "08123",
    });
    mockFns.createGatewayPayment.mockResolvedValue({
      success: true,
      paymentUrl: "https://pay.example",
      transactionId: "trx-1",
      expiresAt: new Date("2026-04-10T01:00:00Z"),
      providerName: "midtrans",
    });

    const result = await createCustomerPaymentForRoute({
      customerId: "cust-1",
      tenantId: "tenant-1",
      invoiceIds: ["inv-1"],
      paymentMethod: "QRIS",
    });

    expect(result.paymentUrl).toBe("https://pay.example");
    expect(result.transactionId).toBe("trx-1");
    expect(mockFns.updateGatewayMetadata).toHaveBeenCalledWith({
      paymentIds: ["pay-1"],
      tenantId: "tenant-1",
      transactionId: "trx-1",
      paymentUrl: "https://pay.example",
      expiresAt: new Date("2026-04-10T01:00:00Z"),
      gatewayProvider: "midtrans",
    });
  });
});
