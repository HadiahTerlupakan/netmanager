import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  sendCustomerPushNotification: vi.fn(),
  updateStatusPelanggan: vi.fn(),
  checkSiteRestriction: vi.fn(),
  cancelPaidPayment: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockFns.getServerSession(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
  prismaBilling: prismaMock,
}));

vi.mock("@/modules/notification", () => ({
  sendCustomerPushNotification: (...args: unknown[]) =>
    mockFns.sendCustomerPushNotification(...args),
}));

vi.mock("@/modules/pelanggan", () => ({
  getPelangganService: () => ({
    updateStatusPelanggan: mockFns.updateStatusPelanggan,
  }),
  PelangganBillingBridgeService: class MockPelangganBillingBridgeService {},
}));

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: (...args: unknown[]) =>
    mockFns.checkSiteRestriction(...args),
}));

vi.mock("@/modules/finance", () => ({
  cancelPaidPayment: (...args: unknown[]) => mockFns.cancelPaidPayment(...args),
  PaymentCancellationError: class PaymentCancellationError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));

import { POST } from "@/app/api/admin/payments/[id]/cancel/route";

describe("admin payments cancel route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getServerSession.mockResolvedValue({
      user: { name: "Admin", email: "admin@example.com" },
    });
    mockFns.sendCustomerPushNotification.mockResolvedValue(undefined);
    mockFns.updateStatusPelanggan.mockResolvedValue(undefined);
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: false,
      siteIds: [],
    });
    mockFns.cancelPaidPayment.mockResolvedValue(undefined);
    prismaMock.payment.findUnique.mockResolvedValue({
      id: "pay-1",
      gatewayStatus: "PAID",
      amount: 50000n,
      invoice: {
        id: "inv-1",
        pelangganId: "cust-1",
        paidAmount: 50000n,
        totalAmount: 50000n,
        status: "PAID",
      },
    });
    prismaMock.pelanggan.findUnique.mockResolvedValue({
      id: "cust-1",
      status: "AKTIF",
    });
    prismaMock.payment.update.mockResolvedValue({});
    prismaMock.invoice.update.mockResolvedValue({});
  });

  it("delegates customer isolation to pelanggan service instead of updating prisma directly", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/admin/payments/pay-1/cancel", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "pay-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockFns.cancelPaidPayment).toHaveBeenCalledWith({
      paymentId: "pay-1",
      adminLabel: "Admin",
      allowedSiteIds: undefined,
    });
  });
});
