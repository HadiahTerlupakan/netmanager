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
  markPaymentsAsFailed: vi.fn(),
  reserveUsage: vi.fn(),
  releaseUsage: vi.fn(),
  recomputeInvoice: vi.fn(),
  publish: vi.fn(),
  routedProvider: vi.fn(),
  replacePending: vi.fn(),
}));

vi.mock("@/modules/payment-gateway", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/payment-gateway")>()),
  replacePendingGatewayCheckouts: mockFns.replacePending,
}));

vi.mock("@/lib/event-bus", () => ({
  eventBus: { publish: mockFns.publish },
  EVENT_NAMES: { COUPON_USED: "billing:coupon.used" },
}));

vi.mock("@/modules/coupons", () => ({
  couponService: {
    verifyCoupon: mockFns.verifyCoupon,
    recordUsage: mockFns.recordUsage,
    incrementUsage: mockFns.incrementUsage,
    reserveUsage: mockFns.reserveUsage,
    releaseUsage: mockFns.releaseUsage,
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
    createPaymentWithProvider = (provider: string, params: unknown) => {
      mockFns.routedProvider(provider);
      return mockFns.createGatewayPayment(params);
    };
  },
  createCustomerPaymentsForInvoices: mockFns.createPaymentsForInvoices,
  updateCustomerPaymentGatewayMetadata: mockFns.updateGatewayMetadata,
  markCustomerPaymentsAsFailed: mockFns.markPaymentsAsFailed,
  recomputeInvoicePaymentState: mockFns.recomputeInvoice,
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

  // Pelanggan yang mengganti metode (VA ke QRIS) membayar lagi invoice yang
  // checkout lamanya masih menunggu; checkout itu ditutup lebih dulu.
  it("menutup checkout gateway lama sebelum kupon diverifikasi", async () => {
    const order: string[] = [];
    mockFns.replacePending.mockImplementation(async () => {
      order.push("replace");
    });
    mockFns.verifyCoupon.mockImplementation(async () => {
      order.push("coupon");
      return { valid: false, error: "x" };
    });

    await createCustomerPaymentForRoute({
      customerId: "cust-1",
      tenantId: "tenant-1",
      invoiceIds: ["inv-1"],
      couponCode: "HEMAT",
      paymentMethod: "SP",
    }).catch(() => undefined);

    expect(mockFns.replacePending).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cust-1", invoiceIds: ["inv-1"] }),
    );
    expect(order).toEqual(["replace", "coupon"]);
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
      vaNumber: null,
      qrString: null,
    });
    expect(mockFns.createPaymentsForInvoices).toHaveBeenCalledWith({
      customerId: "cust-1",
      tenantId: "tenant-1",
      invoiceIds: ["inv-1"],
      discountAmount: 0,
      paymentMethod: "MANUAL",
      notes: "manual transfer",
      couponUsageId: null,
      couponId: null,
    });
  });

  it("couponCode null diperlakukan sebagai tanpa kupon", async () => {
    await createCustomerPaymentForRoute({
      customerId: "cust-1",
      tenantId: "tenant-1",
      invoiceIds: ["inv-1"],
      couponCode: null,
      paymentMethod: "MANUAL",
    });

    expect(mockFns.verifyCoupon).not.toHaveBeenCalled();
    expect(mockFns.createPaymentsForInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ discountAmount: 0 }),
    );
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
      vaNumber: "7007014001179806",
      qrString: "000201010212",
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
    // Portal menampilkan nomor VA / QRIS sendiri, tanpa mengalihkan
    // pelanggan ke halaman bayar gateway.
    expect(result).toMatchObject({
      vaNumber: "7007014001179806",
      qrString: "000201010212",
    });
    expect(mockFns.updateGatewayMetadata).toHaveBeenCalledWith({
      paymentIds: ["pay-1"],
      tenantId: "tenant-1",
      transactionId: "trx-1",
      paymentUrl: "https://pay.example",
      vaNumber: "7007014001179806",
      qrString: "000201010212",
      expiresAt: new Date("2026-04-10T01:00:00Z"),
      gatewayProvider: "midtrans",
    });
  });

  it("kupon yang ditolak (mis. kuota habis) menjadi error 400 berpesan", async () => {
    mockFns.verifyCoupon.mockResolvedValue({
      valid: false,
      error: "Kuota kupon habis",
    });

    await expect(
      createCustomerPaymentForRoute({
        customerId: "cust-1",
        tenantId: "tenant-1",
        invoiceIds: ["inv-1"],
        couponCode: "HEMAT10",
        paymentMethod: "MANUAL",
      }),
    ).rejects.toMatchObject({ message: "Kuota kupon habis", status: 400 });
    expect(mockFns.createPaymentsForInvoices).not.toHaveBeenCalled();
  });

  it("menolak kupon bila tenant tidak diketahui agar kupon ISP lain tak terpakai", async () => {
    mockFns.verifyCoupon.mockResolvedValue({
      valid: true,
      discountAmount: 10000,
      couponId: "coupon-tenant-lain",
    });

    await expect(
      createCustomerPaymentForRoute({
        customerId: "cust-1",
        tenantId: null,
        invoiceIds: ["inv-1"],
        couponCode: "HEMAT10",
        paymentMethod: "MANUAL",
      }),
    ).rejects.toMatchObject({
      message: "Tenant ID tidak ditemukan",
      status: 400,
    });
    expect(mockFns.verifyCoupon).not.toHaveBeenCalled();
    expect(mockFns.createPaymentsForInvoices).not.toHaveBeenCalled();
  });

  it.each([
    [
      "menjawab success:false",
      () =>
        mockFns.createGatewayPayment.mockResolvedValue({
          success: false,
          error: "merchant nonaktif",
        }),
    ],
    [
      "melempar error",
      () =>
        mockFns.createGatewayPayment.mockRejectedValue(new Error("timeout")),
    ],
  ])(
    "gateway yang %s menggagalkan pembayaran PENDING dan menolak permintaan",
    async (_label, arrangeGateway) => {
      mockFns.findPelangganById.mockResolvedValue({
        id: "cust-1",
        nama: "Budi",
      });
      arrangeGateway();

      await expect(
        createCustomerPaymentForRoute({
          customerId: "cust-1",
          tenantId: "tenant-1",
          invoiceIds: ["inv-1"],
          paymentMethod: "QRIS",
        }),
      ).rejects.toMatchObject({ status: 502 });
      expect(mockFns.markPaymentsAsFailed).toHaveBeenCalledWith(["pay-1"]);
      expect(mockFns.updateGatewayMetadata).not.toHaveBeenCalled();
    },
  );

  describe("kupon", () => {
    const gatewayPelanggan = () => {
      mockFns.findPelangganById.mockResolvedValue({
        id: "cust-1",
        nama: "Budi",
      });
    };
    const bayarDenganKupon = (paymentMethod: string) =>
      createCustomerPaymentForRoute({
        customerId: "cust-1",
        tenantId: "tenant-1",
        invoiceIds: ["inv-1"],
        couponCode: "HEMAT10",
        paymentMethod,
      });

    beforeEach(() => {
      mockFns.verifyCoupon.mockResolvedValue({
        valid: true,
        discountAmount: 10000,
        couponId: "coupon-1",
      });
      mockFns.reserveUsage.mockResolvedValue("usage-1");
    });

    it("dipesan sebelum pembayaran dibuat, ditagih sebesar sisa setelah potongan", async () => {
      gatewayPelanggan();
      mockFns.createGatewayPayment.mockResolvedValue({
        success: true,
        paymentUrl: "https://pay.example",
      });

      await bayarDenganKupon("QRIS");

      expect(mockFns.createGatewayPayment).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 90000 }),
      );
      expect(mockFns.reserveUsage).toHaveBeenCalledWith("coupon-1", "cust-1");
      expect(mockFns.releaseUsage).not.toHaveBeenCalled();
      expect(mockFns.publish).toHaveBeenCalledWith(
        "billing:coupon.used",
        expect.objectContaining({
          couponId: "coupon-1",
          discountAmount: 10000,
        }),
      );
    });

    it("dilepas lagi bila gateway gagal", async () => {
      gatewayPelanggan();
      mockFns.createGatewayPayment.mockRejectedValue(new Error("timeout"));

      await expect(bayarDenganKupon("QRIS")).rejects.toMatchObject({
        status: 502,
      });
      expect(mockFns.releaseUsage).toHaveBeenCalledWith("usage-1");
      expect(mockFns.publish).not.toHaveBeenCalled();
    });

    it("potongan 100% tidak memanggil gateway dan melunasi invoice", async () => {
      mockFns.verifyCoupon.mockResolvedValue({
        valid: true,
        discountAmount: 100000,
        couponId: "coupon-1",
      });
      mockFns.createPaymentsForInvoices.mockResolvedValue([
        { id: "pay-1", invoiceId: "inv-1", gatewayStatus: "PAID" },
      ]);

      const result = await bayarDenganKupon("QRIS");

      expect(mockFns.createGatewayPayment).not.toHaveBeenCalled();
      expect(mockFns.recomputeInvoice).toHaveBeenCalledWith("inv-1");
      expect(result.paymentUrl).toBeNull();
    });

    it("kuota habis saat dipesan menolak tanpa membuat pembayaran", async () => {
      mockFns.reserveUsage.mockResolvedValue(null);

      await expect(bayarDenganKupon("QRIS")).rejects.toMatchObject({
        message: "Kuota kupon habis",
        status: 400,
      });
      expect(mockFns.createPaymentsForInvoices).not.toHaveBeenCalled();
    });
  });

  // Tenant dengan beberapa gateway dulu selalu ditagih lewat gateway
  // pertama, yang tidak mengenal kode channel gateway lain.
  it.each([
    ["BRIVA", "TRIPAY"],
    ["BC", "DUITKU"],
    ["MIDTRANS_SNAP", "MIDTRANS"],
  ])("kode %s ditagih lewat %s", async (paymentMethod, provider) => {
    mockFns.findPelangganById.mockResolvedValue({ id: "cust-1", nama: "Budi" });
    mockFns.createGatewayPayment.mockResolvedValue({
      success: true,
      paymentUrl: "https://pay.example",
    });

    await createCustomerPaymentForRoute({
      customerId: "cust-1",
      tenantId: "tenant-1",
      invoiceIds: ["inv-1"],
      paymentMethod,
    });

    expect(mockFns.routedProvider).toHaveBeenCalledWith(provider);
  });
});
