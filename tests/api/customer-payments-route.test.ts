import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  requireCustomerAuth: vi.fn(),
  getTenantIdFromContext: vi.fn(),
  validateInvoicesForPayment: vi.fn(),
  createCustomerPaymentForRoute: vi.fn(),
  verifyCoupon: vi.fn(),
  recordUsage: vi.fn(),
  incrementUsage: vi.fn(),
  createCustomerPaymentsForInvoices: vi.fn(),
  updateCustomerPaymentGatewayMetadata: vi.fn(),
  createPayment: vi.fn(),
  limitCustomerPaymentRequest: vi.fn(),
}));

vi.mock("@/app/api/customer/rate-limit", () => ({
  limitCustomerPaymentRequest: mockFns.limitCustomerPaymentRequest,
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
  createCustomerPaymentForRoute: mockFns.createCustomerPaymentForRoute,
}));

vi.mock("@/modules/coupons", () => ({
  CouponService: class {
    verifyCoupon = mockFns.verifyCoupon;
    recordUsage = mockFns.recordUsage;
    incrementUsage = mockFns.incrementUsage;
  },
}));

vi.mock("@/modules/finance", () => ({
  createCustomerPaymentsForInvoices: mockFns.createCustomerPaymentsForInvoices,
  updateCustomerPaymentGatewayMetadata:
    mockFns.updateCustomerPaymentGatewayMetadata,
  PaymentGatewayManager: class {
    createPayment = mockFns.createPayment;
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
import { RouteServiceError } from "@/lib/api/route-service-error";

describe("customer payments route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.limitCustomerPaymentRequest.mockReturnValue(null);

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
    mockFns.createCustomerPaymentForRoute.mockImplementation((input) =>
      Promise.resolve({
        payments: [
          {
            id: "payment-1",
            reference: "PAY-1",
          },
        ],
        paymentUrl:
          input.paymentMethod === "MIDTRANS"
            ? "https://pay.test/checkout"
            : null,
        transactionId: input.paymentMethod === "MIDTRANS" ? "txn-1" : null,
      }),
    );
    mockFns.createPayment.mockResolvedValue({
      success: true,
      paymentUrl: "https://pay.test/checkout",
      transactionId: "txn-1",
      expiresAt: new Date("2026-04-22T01:00:00.000Z"),
      providerName: "MIDTRANS",
    });
    prismaMock.pelanggan.findUnique.mockResolvedValue({
      id: "customer-1",
      nama: "Budi",
      email: "budi@example.com",
      noTelp: "08123456789",
    });
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
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
    expect(mockFns.createCustomerPaymentForRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer-1",
        tenantId: "tenant-a",
        invoiceIds: ["invoice-1"],
        paymentMethod: "MANUAL",
        notes: "catatan",
      }),
    );
  });

  it.each([
    ["null", { couponCode: null }],
    ["string kosong", { couponCode: "  " }],
    ["tanpa field", {}],
  ])(
    "menerima pembayaran tanpa kupon (couponCode %s) dan meneruskannya sebagai absen",
    async (_label, couponField) => {
      const request = new NextRequest(
        "http://localhost/api/customer/payments",
        {
          method: "POST",
          body: JSON.stringify({
            invoiceIds: ["invoice-1"],
            paymentMethod: "MANUAL_bank-1",
            ...couponField,
          }),
          headers: { "content-type": "application/json" },
        },
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const input = mockFns.createCustomerPaymentForRoute.mock.calls[0][0];
      expect(input.couponCode).toBeUndefined();
    },
  );

  it("meneruskan kode kupon yang diisi apa adanya", async () => {
    const request = new NextRequest("http://localhost/api/customer/payments", {
      method: "POST",
      body: JSON.stringify({
        invoiceIds: ["invoice-1"],
        paymentMethod: "MANUAL_bank-1",
        couponCode: "HEMAT10",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockFns.createCustomerPaymentForRoute).toHaveBeenCalledWith(
      expect.objectContaining({ couponCode: "HEMAT10" }),
    );
  });

  it("stores gateway metadata without any cast when gateway payment succeeds", async () => {
    const request = new NextRequest("http://localhost/api/customer/payments", {
      method: "POST",
      body: JSON.stringify({
        invoiceIds: ["invoice-1"],
        paymentMethod: "MIDTRANS",
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
    expect(mockFns.createCustomerPaymentForRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer-1",
        tenantId: "tenant-a",
        invoiceIds: ["invoice-1"],
        paymentMethod: "MIDTRANS",
        notes: "catatan",
      }),
    );
  });

  it("kupon yang ditolak service dijawab 400 dengan pesannya", async () => {
    mockFns.createCustomerPaymentForRoute.mockRejectedValue(
      new RouteServiceError("Kuota kupon habis", 400),
    );

    const response = await POST(buildPaymentRequest({ couponCode: "HEMAT10" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Kuota kupon habis");
  });

  // Aplikasi mobile kembali ke halaman publik yang membuka deep link-nya.
  it("meneruskan returnTo app ke service", async () => {
    const response = await POST(
      buildPaymentRequest({ paymentMethod: "SP", returnTo: "app" }),
    );

    expect(response.status).toBe(200);
    expect(mockFns.createCustomerPaymentForRoute).toHaveBeenCalledWith(
      expect.objectContaining({ returnTo: "app" }),
    );
  });

  it("menolak returnTo yang tidak dikenal", async () => {
    const response = await POST(
      buildPaymentRequest({ returnTo: "https://phishing.example" }),
    );

    expect(response.status).toBe(400);
    expect(mockFns.createCustomerPaymentForRoute).not.toHaveBeenCalled();
  });

  it("pelanggan yang melewati batas permintaan ditolak sebelum gateway dipanggil", async () => {
    mockFns.limitCustomerPaymentRequest.mockReturnValue(
      NextResponse.json({ success: false }, { status: 429 }),
    );

    const response = await POST(buildPaymentRequest());

    expect(response.status).toBe(429);
    expect(mockFns.limitCustomerPaymentRequest).toHaveBeenCalledWith(
      "createPayment",
      "customer-1",
    );
    expect(mockFns.createCustomerPaymentForRoute).not.toHaveBeenCalled();
  });

  it("menolak 400 bila paymentMethod tidak dikirim, sebelum service dipanggil", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/customer/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceIds: ["invoice-1"] }),
        headers: { "content-type": "application/json" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Metode pembayaran wajib diisi");
    expect(mockFns.createCustomerPaymentForRoute).not.toHaveBeenCalled();
  });
});

function buildPaymentRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/customer/payments", {
    method: "POST",
    body: JSON.stringify({
      invoiceIds: ["invoice-1"],
      paymentMethod: "MANUAL",
      ...overrides,
    }),
    headers: { "content-type": "application/json" },
  });
}
