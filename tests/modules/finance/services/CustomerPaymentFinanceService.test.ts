import { describe, it, expect, beforeEach, vi } from "vitest";
import * as CustomerPaymentFinanceService from "@/modules/finance/services/CustomerPaymentFinanceService";

// Mock repositories dengan class constructor
const mockPaymentRepository = {
  createCustomerPaymentsForInvoices: vi.fn(),
  updateGatewayMetadata: vi.fn(),
  findPendingManualCheckout: vi.fn(),
  markAsFailed: vi.fn(),
  findLatestPending: vi.fn(),
};

const mockInvoiceRepository = {
  findCustomerPaymentStatus: vi.fn(),
};

vi.mock("@/modules/finance/repositories/PaymentRepository", () => ({
  PaymentRepository: class {
    createCustomerPaymentsForInvoices =
      mockPaymentRepository.createCustomerPaymentsForInvoices;
    updateGatewayMetadata = mockPaymentRepository.updateGatewayMetadata;
    findPendingManualCheckout = mockPaymentRepository.findPendingManualCheckout;
    markAsFailed = mockPaymentRepository.markAsFailed;
    findLatestPending = mockPaymentRepository.findLatestPending;
  },
}));

vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: class {
    findCustomerPaymentStatus = mockInvoiceRepository.findCustomerPaymentStatus;
  },
}));

describe("CustomerPaymentFinanceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPaymentRepository.findLatestPending.mockResolvedValue(null);
  });

  describe("createCustomerPaymentsForInvoices", () => {
    it("harus create payments untuk multiple invoices", async () => {
      const options = {
        customerId: "customer-1",
        tenantId: "tenant-1",
        invoiceIds: ["inv-1", "inv-2"],
        discountAmount: 10000,
        paymentMethod: "BANK_TRANSFER",
        notes: "Payment notes",
      };

      mockPaymentRepository.createCustomerPaymentsForInvoices.mockResolvedValue(
        [
          { id: "payment-1", invoiceId: "inv-1" },
          { id: "payment-2", invoiceId: "inv-2" },
        ],
      );

      const result =
        await CustomerPaymentFinanceService.createCustomerPaymentsForInvoices(
          options,
        );

      expect(result).toHaveLength(2);
      expect(
        mockPaymentRepository.createCustomerPaymentsForInvoices,
      ).toHaveBeenCalledWith(options);
    });

    it("harus support coupon service", async () => {
      const mockCouponService = {
        recordUsage: vi.fn(),
        incrementUsage: vi.fn(),
      };

      const options = {
        customerId: "customer-1",
        invoiceIds: ["inv-1"],
        discountAmount: 5000,
        paymentMethod: "BANK_TRANSFER",
        couponId: "coupon-1",
        couponService: mockCouponService,
      };

      mockPaymentRepository.createCustomerPaymentsForInvoices.mockResolvedValue(
        [{ id: "payment-1" }],
      );

      await CustomerPaymentFinanceService.createCustomerPaymentsForInvoices(
        options,
      );

      expect(
        mockPaymentRepository.createCustomerPaymentsForInvoices,
      ).toHaveBeenCalledWith(options);
    });
  });

  describe("updateCustomerPaymentGatewayMetadata", () => {
    it("harus update gateway metadata untuk payments", async () => {
      const options = {
        paymentIds: ["payment-1", "payment-2"],
        tenantId: "tenant-1",
        transactionId: "txn-123",
        paymentUrl: "https://payment.gateway/pay/123",
        expiresAt: new Date("2026-05-06"),
        gatewayProvider: "XENDIT",
      };

      mockPaymentRepository.updateGatewayMetadata.mockResolvedValue({
        count: 2,
      });

      const result =
        await CustomerPaymentFinanceService.updateCustomerPaymentGatewayMetadata(
          options,
        );

      expect(result).toEqual({ count: 2 });
      expect(mockPaymentRepository.updateGatewayMetadata).toHaveBeenCalledWith(
        options,
      );
    });

    it("harus support optional fields", async () => {
      const options = {
        paymentIds: ["payment-1"],
        transactionId: "txn-123",
      };

      mockPaymentRepository.updateGatewayMetadata.mockResolvedValue({
        count: 1,
      });

      await CustomerPaymentFinanceService.updateCustomerPaymentGatewayMetadata(
        options,
      );

      expect(mockPaymentRepository.updateGatewayMetadata).toHaveBeenCalledWith(
        options,
      );
    });
  });

  describe("checkout transfer manual", () => {
    it("dicari dengan id pelanggan dari sesi sebagai pelangganId", async () => {
      mockPaymentRepository.findPendingManualCheckout.mockResolvedValue([
        { id: "payment-1" },
      ]);

      const result =
        await CustomerPaymentFinanceService.findPendingManualCustomerCheckout({
          invoiceId: "inv-1",
          customerId: "customer-1",
        });

      expect(result).toEqual([{ id: "payment-1" }]);
      expect(
        mockPaymentRepository.findPendingManualCheckout,
      ).toHaveBeenCalledWith({ invoiceId: "inv-1", pelangganId: "customer-1" });
    });
  });

  describe("markCustomerPaymentsAsFailed", () => {
    it("menyimpan alasan penolakan gateway", async () => {
      await CustomerPaymentFinanceService.markCustomerPaymentsAsFailed(
        ["payment-1"],
        "Duitku HTTP 404: Payment channel not available",
      );

      expect(mockPaymentRepository.markAsFailed).toHaveBeenCalledWith(
        ["payment-1"],
        "Duitku HTTP 404: Payment channel not available",
      );
    });
  });

  // Ganti metode yang ditolak gateway meninggalkan payment FAILED terbaru,
  // sementara VA/QR lama masih menunggu dan masih bisa dibayar.
  describe("getCustomerInvoicePaymentSnapshot", () => {
    it("percobaan yang ditolak tidak menutupi checkout yang masih menunggu", async () => {
      mockInvoiceRepository.findCustomerPaymentStatus.mockResolvedValue({
        status: "SENT",
        payment: [{ id: "pay-gagal", gatewayStatus: "FAILED" }],
      });
      mockPaymentRepository.findLatestPending.mockResolvedValue({
        id: "pay-va-lama",
        gatewayStatus: "PENDING",
      });

      await expect(
        CustomerPaymentFinanceService.getCustomerInvoicePaymentSnapshot({
          invoiceId: "inv-1",
          customerId: "customer-1",
        }),
      ).resolves.toEqual({
        status: "SENT",
        paymentId: "pay-va-lama",
        gatewayStatus: "PENDING",
      });
      expect(mockPaymentRepository.findLatestPending).toHaveBeenCalledWith({
        invoiceId: "inv-1",
        pelangganId: "customer-1",
      });
    });
  });

  describe("getCustomerInvoicePaymentStatus", () => {
    it("harus return PAID status jika invoice sudah paid", async () => {
      const options = {
        invoiceId: "inv-1",
        customerId: "customer-1",
      };

      mockInvoiceRepository.findCustomerPaymentStatus.mockResolvedValue({
        status: "PAID",
        payment: [],
      });

      const result =
        await CustomerPaymentFinanceService.getCustomerInvoicePaymentStatus(
          options,
        );

      expect(result).toBe("PAID");
    });

    it("harus return FAILED jika latest payment failed", async () => {
      const options = {
        invoiceId: "inv-1",
        customerId: "customer-1",
      };

      mockInvoiceRepository.findCustomerPaymentStatus.mockResolvedValue({
        status: "UNPAID",
        payment: [{ gatewayStatus: "FAILED" }],
      });

      const result =
        await CustomerPaymentFinanceService.getCustomerInvoicePaymentStatus(
          options,
        );

      expect(result).toBe("FAILED");
    });

    it("harus return FAILED jika latest payment cancelled", async () => {
      const options = {
        invoiceId: "inv-1",
        customerId: "customer-1",
      };

      mockInvoiceRepository.findCustomerPaymentStatus.mockResolvedValue({
        status: "UNPAID",
        payment: [{ gatewayStatus: "CANCELLED" }],
      });

      const result =
        await CustomerPaymentFinanceService.getCustomerInvoicePaymentStatus(
          options,
        );

      expect(result).toBe("FAILED");
    });

    // Aplikasi mobile menangani EXPIRED; dulu tidak pernah dikirim sehingga
    // kartu "menunggu" bertahan sampai koneksi SSE habis.
    it("harus return EXPIRED jika latest payment kedaluwarsa", async () => {
      mockInvoiceRepository.findCustomerPaymentStatus.mockResolvedValue({
        status: "OVERDUE",
        payment: [{ id: "pay-9", gatewayStatus: "EXPIRED" }],
      });

      const snapshot =
        await CustomerPaymentFinanceService.getCustomerInvoicePaymentSnapshot({
          invoiceId: "inv-1",
          customerId: "customer-1",
        });

      expect(snapshot).toEqual({
        status: "EXPIRED",
        paymentId: "pay-9",
        gatewayStatus: "EXPIRED",
      });
    });

    it("harus return invoice status jika payment pending", async () => {
      const options = {
        invoiceId: "inv-1",
        customerId: "customer-1",
      };

      mockInvoiceRepository.findCustomerPaymentStatus.mockResolvedValue({
        status: "UNPAID",
        payment: [{ gatewayStatus: "PENDING" }],
      });

      const result =
        await CustomerPaymentFinanceService.getCustomerInvoicePaymentStatus(
          options,
        );

      expect(result).toBe("UNPAID");
    });

    it("harus return invoice status jika tidak ada payment", async () => {
      const options = {
        invoiceId: "inv-1",
        customerId: "customer-1",
      };

      mockInvoiceRepository.findCustomerPaymentStatus.mockResolvedValue({
        status: "UNPAID",
        payment: [],
      });

      const result =
        await CustomerPaymentFinanceService.getCustomerInvoicePaymentStatus(
          options,
        );

      expect(result).toBe("UNPAID");
    });

    it("harus return null jika invoice tidak ditemukan", async () => {
      const options = {
        invoiceId: "inv-999",
        customerId: "customer-1",
      };

      mockInvoiceRepository.findCustomerPaymentStatus.mockResolvedValue(null);

      const result =
        await CustomerPaymentFinanceService.getCustomerInvoicePaymentStatus(
          options,
        );

      expect(result).toBeNull();
    });
  });
});
