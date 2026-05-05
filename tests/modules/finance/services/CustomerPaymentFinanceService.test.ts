import { describe, it, expect, beforeEach, vi } from "vitest";
import * as CustomerPaymentFinanceService from "@/modules/finance/services/CustomerPaymentFinanceService";

// Mock repositories dengan class constructor
const mockPaymentRepository = {
  createCustomerPaymentsForInvoices: vi.fn(),
  updateGatewayMetadata: vi.fn(),
  findPendingManualTransfer: vi.fn(),
  updateReceipt: vi.fn(),
};

const mockInvoiceRepository = {
  findCustomerPaymentStatus: vi.fn(),
};

vi.mock("@/modules/finance/repositories/PaymentRepository", () => ({
  PaymentRepository: class {
    createCustomerPaymentsForInvoices =
      mockPaymentRepository.createCustomerPaymentsForInvoices;
    updateGatewayMetadata = mockPaymentRepository.updateGatewayMetadata;
    findPendingManualTransfer = mockPaymentRepository.findPendingManualTransfer;
    updateReceipt = mockPaymentRepository.updateReceipt;
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

  describe("findPendingManualCustomerTransfer", () => {
    it("harus find pending manual transfer payment", async () => {
      const options = {
        invoiceId: "inv-1",
        customerId: "customer-1",
      };

      const mockPayment = {
        id: "payment-1",
        invoiceId: "inv-1",
        pelangganId: "customer-1",
        gatewayStatus: "PENDING",
        paymentMethod: "BANK_TRANSFER",
      };

      mockPaymentRepository.findPendingManualTransfer.mockResolvedValue(
        mockPayment,
      );

      const result =
        await CustomerPaymentFinanceService.findPendingManualCustomerTransfer(
          options,
        );

      expect(result).toEqual(mockPayment);
      expect(
        mockPaymentRepository.findPendingManualTransfer,
      ).toHaveBeenCalledWith({
        invoiceId: "inv-1",
        pelangganId: "customer-1",
      });
    });

    it("harus return null jika tidak ada pending payment", async () => {
      const options = {
        invoiceId: "inv-1",
        customerId: "customer-1",
      };

      mockPaymentRepository.findPendingManualTransfer.mockResolvedValue(null);

      const result =
        await CustomerPaymentFinanceService.findPendingManualCustomerTransfer(
          options,
        );

      expect(result).toBeNull();
    });
  });

  describe("updateCustomerPaymentReceipt", () => {
    it("harus update payment receipt", async () => {
      const options = {
        paymentId: "payment-1",
        receiptUrl: "https://storage.com/receipt.jpg",
        notes: "Receipt uploaded",
      };

      const mockUpdatedPayment = {
        id: "payment-1",
        receiptUrl: "https://storage.com/receipt.jpg",
        notes: "Receipt uploaded",
      };

      mockPaymentRepository.updateReceipt.mockResolvedValue(mockUpdatedPayment);

      const result =
        await CustomerPaymentFinanceService.updateCustomerPaymentReceipt(
          options,
        );

      expect(result).toEqual(mockUpdatedPayment);
      expect(mockPaymentRepository.updateReceipt).toHaveBeenCalledWith(options);
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
