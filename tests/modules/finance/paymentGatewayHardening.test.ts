import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

const mockFns = vi.hoisted(() => ({
  processWebhook: vi.fn(),
  handleInvoicePaid: vi.fn(),
}));

vi.mock("@/modules/finance/services/AutomaticBillingService", () => ({
  AutomaticBillingService: {
    handleInvoicePaid: mockFns.handleInvoicePaid,
  },
}));

vi.mock("@/modules/finance/services/payment-gateway/gateway-manager", () => ({
  PaymentGatewayManager: class {
    processWebhook = mockFns.processWebhook;
  },
}));

import { WebhookProcessingService } from "@/modules/finance/services/payment-gateway/webhook-processing-service";
import { DuitkuProvider } from "@/modules/finance/services/payment-gateway/providers/duitku-provider";
import { TripayProvider } from "@/modules/finance/services/payment-gateway/providers/tripay-provider";

describe("payment gateway hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prismaMock);
      }

      return callback;
    });
    mockFns.handleInvoicePaid.mockResolvedValue(undefined);
  });

  it("uses webhook route that exists for Duitku callback", async () => {
    const provider = new DuitkuProvider();
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        statusCode: "00",
        paymentUrl: "https://duitku.test/pay",
        vaNumber: "12345",
        reference: "DUITKU-1",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    provider.initialize({
      apiKey: "api-key",
      merchantId: "merchant-id",
      isProduction: false,
    });

    await provider.createPayment({
      orderId: "INV-1",
      amount: 150000,
      description: "Invoice 1",
      customerName: "Budi",
      customerEmail: "budi@example.com",
      customerPhone: "081234567890",
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));

    expect(body.callbackUrl).toBe("undefined/api/webhooks/duitku");
  });

  it("verifies Tripay webhook with raw body instead of re-serialized payload", () => {
    const provider = new TripayProvider();
    const rawBody = '{ "status":"PAID", "merchant_ref":"INV-1" }';
    const signature = crypto
      .createHmac("sha256", "tripay-secret")
      .update(rawBody)
      .digest("hex");

    provider.initialize({
      apiKey: "tripay-api",
      apiSecret: "tripay-secret",
      merchantId: "merchant-code",
      isProduction: false,
    });

    const isValid = provider.verifyWebhook(
      { merchant_ref: "INV-1", status: "PAID" },
      signature,
      rawBody,
    );

    expect(isValid).toBe(true);
  });

  it("rejects paid webhook when amount does not match stored payment", async () => {
    const service = new WebhookProcessingService();

    prismaMock.payment.findFirst.mockResolvedValue({
      id: "pay-1",
      reference: "INV-1",
      amount: BigInt(100000),
      tenantId: null,
      gatewayStatus: "PENDING",
      invoiceId: "inv-1",
      notes: null,
    });
    mockFns.processWebhook.mockResolvedValue({
      orderId: "INV-1",
      status: "PAID",
      amount: 150000,
      transactionId: "tx-1",
    });

    const result = await service.process({
      providerType: "TRIPAY",
      rawBody: JSON.stringify({ merchant_ref: "INV-1" }),
      headers: new Headers({ "x-callback-signature": "sig" }),
      tenantId: "tenant-a",
    });

    expect(result).toEqual({
      status: 200,
      body: { status: "ok", message: "Payment amount mismatch" },
    });
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
  });

  it("rejects webhook when transaction identity differs from stored payment", async () => {
    const service = new WebhookProcessingService();

    prismaMock.payment.findFirst.mockResolvedValue({
      id: "pay-1",
      reference: "INV-1",
      amount: BigInt(100000),
      tenantId: null,
      transactionId: "tx-stored",
      gatewayStatus: "PENDING",
      invoiceId: "inv-1",
      notes: null,
    });
    mockFns.processWebhook.mockResolvedValue({
      orderId: "INV-1",
      status: "PAID",
      amount: 100000,
      transactionId: "tx-other",
    });

    const result = await service.process({
      providerType: "TRIPAY",
      rawBody: JSON.stringify({ merchant_ref: "INV-1" }),
      headers: new Headers({ "x-callback-signature": "sig" }),
      tenantId: "tenant-a",
    });

    expect(result).toEqual({
      status: 200,
      body: { status: "ok", message: "Payment transaction mismatch" },
    });
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
  });

  it("keeps stored transaction identity when webhook omits transactionId", async () => {
    const service = new WebhookProcessingService();

    prismaMock.payment.findFirst.mockResolvedValue({
      id: "pay-1",
      reference: "INV-1",
      amount: BigInt(100000),
      tenantId: null,
      transactionId: "tx-stored",
      gatewayStatus: "PENDING",
      invoiceId: "inv-1",
      notes: null,
    });
    prismaMock.payment.findUnique.mockResolvedValue({
      id: "pay-1",
      transactionId: "tx-stored",
      gatewayStatus: "PENDING",
    });
    prismaMock.payment.update.mockResolvedValue({ id: "pay-1" });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: "inv-1",
      totalAmount: BigInt(100000),
      status: "PENDING",
      payment: [{ amount: BigInt(100000), gatewayStatus: "PAID" }],
    });
    prismaMock.invoice.update.mockResolvedValue({ id: "inv-1" });
    mockFns.processWebhook.mockResolvedValue({
      orderId: "INV-1",
      status: "PAID",
      amount: 100000,
    });

    await service.process({
      providerType: "TRIPAY",
      rawBody: JSON.stringify({ merchant_ref: "INV-1" }),
      headers: new Headers({ "x-callback-signature": "sig" }),
      tenantId: "tenant-a",
    });

    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: expect.objectContaining({
        transactionId: "tx-stored",
      }),
    });
  });

  it("does not auto-match Moota webhook by amount only", async () => {
    const service = new WebhookProcessingService();

    prismaMock.unmatchedMutation.findUnique.mockResolvedValue(null);
    prismaMock.unmatchedMutation.create.mockResolvedValue({ id: "um-1" });
    mockFns.processWebhook.mockResolvedValue({
      orderId: "",
      status: "PAID",
      amount: 100000,
      raw: {
        mutation_id: "mut-1",
        amount: "100000",
        description: "Transfer masuk",
        type: "CR",
        date: "2026-04-22T00:00:00.000Z",
        bank_id: "bank-1",
      },
    });

    const result = await service.process({
      providerType: "MOOTA",
      rawBody: JSON.stringify({ amount: 100000 }),
      headers: new Headers({ signature: "sig" }),
    });

    expect(result).toEqual({
      status: 200,
      body: { status: "ok", message: "Payment record not found" },
    });
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
    expect(prismaMock.unmatchedMutation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "MOOTA",
        transactionId: "mut-1",
        amount: 100000,
      }),
    });
  });

  it("ignores payment with same reference from different tenant", async () => {
    const service = new WebhookProcessingService();
    const foreignPayment: {
      id: string;
      reference: string;
      amount: bigint;
      tenantId: string;
      transactionId: string;
      gatewayStatus: string;
      invoiceId: string;
      notes: string | null;
    } = {
      id: "pay-foreign",
      reference: "INV-1",
      amount: BigInt(100000),
      tenantId: "tenant-b",
      transactionId: "tx-foreign",
      gatewayStatus: "PENDING",
      invoiceId: "inv-foreign",
      notes: null,
    };

    prismaMock.payment.findFirst.mockImplementation(
      async (args: { where?: { tenantId?: string } }) => {
        return args.where?.tenantId === "tenant-a" ? null : foreignPayment;
      },
    );
    mockFns.processWebhook.mockResolvedValue({
      orderId: "INV-1",
      status: "PAID",
      amount: 100000,
      transactionId: "tx-foreign",
    });

    const result = await service.process({
      providerType: "TRIPAY",
      rawBody: JSON.stringify({ merchant_ref: "INV-1" }),
      headers: new Headers({ "x-callback-signature": "sig" }),
      tenantId: "tenant-a",
    } as never);

    expect(result).toEqual({
      status: 200,
      body: { status: "ok", message: "Payment record not found" },
    });
    expect(prismaMock.payment.findFirst).toHaveBeenCalledWith({
      where: { reference: "INV-1", tenantId: "tenant-a" },
    });
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
  });

  it("fails closed when tenant context is missing for tenant-scoped webhook lookup", async () => {
    const service = new WebhookProcessingService();

    prismaMock.payment.findFirst.mockResolvedValue({
      id: "pay-foreign",
      reference: "INV-1",
      amount: BigInt(100000),
      tenantId: "tenant-b",
      transactionId: "tx-foreign",
      gatewayStatus: "PENDING",
      invoiceId: "inv-foreign",
      notes: null,
    });
    mockFns.processWebhook.mockResolvedValue({
      orderId: "INV-1",
      status: "PAID",
      amount: 100000,
      transactionId: "tx-foreign",
    });

    const result = await service.process({
      providerType: "TRIPAY",
      rawBody: JSON.stringify({ merchant_ref: "INV-1" }),
      headers: new Headers({ "x-callback-signature": "sig" }),
      tenantId: null,
    });

    expect(result).toEqual({
      status: 200,
      body: { status: "ok", message: "Payment record not found" },
    });
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
  });
});
