import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  requireCustomerAuth: vi.fn(),
  getTenantIdFromContext: vi.fn(),
  validateInvoicesForPayment: vi.fn(),
  verifyCoupon: vi.fn(),
  recordUsage: vi.fn(),
  incrementUsage: vi.fn(),
}));

vi.mock("@/lib/customer-auth", () => ({
  requireCustomerAuth: mockFns.requireCustomerAuth,
}));

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: mockFns.getTenantIdFromContext,
}));

vi.mock("@/modules/pelanggan", () => ({
  CustomerPortalService: class {
    validateInvoicesForPayment = mockFns.validateInvoicesForPayment;
  },
}));

vi.mock("@/modules/coupons", () => ({
  CouponService: class {
    verifyCoupon = mockFns.verifyCoupon;
    recordUsage = mockFns.recordUsage;
    incrementUsage = mockFns.incrementUsage;
  },
}));

vi.mock("@/lib/api-response", () => ({
  apiSuccess: (data: unknown, meta?: { message?: string; status?: number }) =>
    NextResponse.json(
      {
        success: true,
        data,
        ...(meta?.message ? { message: meta.message } : {}),
      },
      { status: meta?.status ?? 200 },
    ),
  apiError: (message: string, _code?: string, init?: { status?: number }) =>
    NextResponse.json(
      { success: false, error: message },
      { status: init?.status ?? 400 },
    ),
  ApiErrors: {
    internalError: (message: string) =>
      NextResponse.json({ success: false, error: message }, { status: 500 }),
  },
  ErrorCodes: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
  },
}));

import { POST } from "@/app/api/customer/payments/route";

describe("customer payments route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prismaMock);
      }

      return callback;
    });

    mockFns.requireCustomerAuth.mockResolvedValue({
      session: {
        id: "customer-1",
        idPelanggan: "pelanggan-1",
        nama: "Budi",
        username: "budi",
        status: "AKTIF",
      },
    });
    mockFns.getTenantIdFromContext.mockResolvedValue({
      tenantId: "tenant-a",
      isSuperAdmin: false,
    });
    mockFns.validateInvoicesForPayment.mockResolvedValue({
      totalAmount: 125000,
    });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: "invoice-1",
      totalAmount: BigInt(125000),
    });
    prismaMock.payment.create.mockResolvedValue({
      id: "payment-1",
      reference: "PAY-1",
    });
  });

  it("stores tenantId on created billing payment", async () => {
    const request = new NextRequest("http://localhost/api/customer/payments", {
      method: "POST",
      body: JSON.stringify({
        invoiceIds: ["invoice-1"],
        paymentMethod: "MANUAL",
        notes: "catatan",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prismaMock.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
      }),
    });
  });
});
