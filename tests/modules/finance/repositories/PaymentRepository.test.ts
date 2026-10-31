import { describe, it, expect, beforeEach, vi } from "vitest";
import { PaymentRepository } from "@/modules/finance/repositories/PaymentRepository";
import { prismaBilling } from "@/modules/database";

// Mock prismaBilling
vi.mock("@/modules/database", () => ({
  prismaBilling: {
    payment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock helper functions
vi.mock(
  "@/modules/finance/repositories/paymentRepository.customer-payments",
  () => ({
    mapPaymentEntity: vi.fn((payment) => payment),
    createCustomerPaymentsForInvoices: vi.fn(),
    findFirstAuthPayment: vi.fn(),
    findPendingManualCheckout: vi.fn(),
    attachReceiptToPayments: vi.fn(),
    cancelPendingManualPayments: vi.fn(),
    markCustomerCheckoutFailed: vi.fn(),
  }),
);

describe("PaymentRepository", () => {
  let paymentRepository: PaymentRepository;

  const mockPayment = {
    id: "payment-1",
    invoiceId: "invoice-1",
    pelangganId: "customer-1",
    amount: 100000,
    paymentMethod: "BANK_TRANSFER",
    gatewayStatus: "SUCCESS",
    paymentDate: new Date("2026-05-05"),
    receiptUrl: "receipt.jpg",
    notes: "Payment received",
    createdAt: new Date("2026-05-05"),
    updatedAt: new Date("2026-05-05"),
  };

  beforeEach(() => {
    paymentRepository = new PaymentRepository();
    vi.clearAllMocks();
  });

  describe("findReceivedByDateRange", () => {
    it("harus return payments dalam date range", async () => {
      const startDate = new Date("2026-05-01");
      const endDate = new Date("2026-05-31");

      vi.mocked(prismaBilling.payment.findMany).mockResolvedValue([
        mockPayment,
      ] as never);

      const result = await paymentRepository.findReceivedByDateRange(
        startDate,
        endDate,
      );

      expect(result).toHaveLength(1);
      // Hanya uang yang benar-benar diterima: checkout menunggu, kedaluwarsa,
      // gagal, atau dibatalkan dulu ikut terjumlah sebagai pendapatan.
      expect(prismaBilling.payment.findMany).toHaveBeenCalledWith({
        where: {
          paymentDate: {
            gte: startDate,
            lte: endDate,
          },
          OR: [{ gatewayStatus: "PAID" }, { gatewayStatus: null }],
        },
      });
    });

    it("harus return empty array jika tidak ada payments", async () => {
      const startDate = new Date("2026-05-01");
      const endDate = new Date("2026-05-31");

      vi.mocked(prismaBilling.payment.findMany).mockResolvedValue([]);

      const result = await paymentRepository.findReceivedByDateRange(
        startDate,
        endDate,
      );

      expect(result).toHaveLength(0);
    });
  });

  describe("findMany", () => {
    it("harus return payments by filter", async () => {
      vi.mocked(prismaBilling.payment.findMany).mockResolvedValue([
        mockPayment,
      ] as never);

      const result = await paymentRepository.findMany({
        pelangganId: "customer-1",
      });

      expect(result).toHaveLength(1);
      expect(prismaBilling.payment.findMany).toHaveBeenCalledWith({
        where: { pelangganId: "customer-1" },
      });
    });

    it("harus support select fields", async () => {
      vi.mocked(prismaBilling.payment.findMany).mockResolvedValue([
        mockPayment,
      ] as never);

      await paymentRepository.findMany(
        { pelangganId: "customer-1" },
        { id: true, amount: true },
      );

      expect(prismaBilling.payment.findMany).toHaveBeenCalledWith({
        where: { pelangganId: "customer-1" },
        select: { id: true, amount: true },
      });
    });
  });

  describe("findByIdWithInvoice", () => {
    it("harus return payment with invoice", async () => {
      const paymentWithInvoice = {
        ...mockPayment,
        invoice: {
          id: "invoice-1",
          invoiceNumber: "INV-001",
          amount: 100000,
        },
      };

      vi.mocked(prismaBilling.payment.findUnique).mockResolvedValue(
        paymentWithInvoice as never,
      );

      const result = await paymentRepository.findByIdWithInvoice("payment-1");

      expect(result).toBeTruthy();
      expect(prismaBilling.payment.findUnique).toHaveBeenCalledWith({
        where: { id: "payment-1" },
        include: { invoice: true },
      });
    });

    it("harus return null jika payment tidak ditemukan", async () => {
      vi.mocked(prismaBilling.payment.findUnique).mockResolvedValue(null);

      const result = await paymentRepository.findByIdWithInvoice("payment-999");

      expect(result).toBeNull();
    });
  });
});
