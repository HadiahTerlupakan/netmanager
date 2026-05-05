import { describe, it, expect, beforeEach, vi } from "vitest";
import { InvoiceRepository } from "@/modules/finance/repositories/InvoiceRepository";
import { prismaBilling } from "@/lib/prisma-billing";

vi.mock("@/lib/prisma-billing", () => ({
  prismaBilling: {
    invoice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/modules/finance/repositories/invoiceRepository.write", () => ({
  createInvoice: vi.fn(),
  createInvoicePayment: vi.fn(),
  createInvoiceWithItems: vi.fn(),
  updateInvoiceWithItemsTransaction: vi.fn(),
  voidInvoiceTransaction: vi.fn(),
}));

vi.mock("@/modules/finance/repositories/invoiceRepository.read", () => ({
  findAuthInvoiceEntity: vi.fn(),
  findAuthInvoiceWithPaymentEntity: vi.fn(),
  findInvoiceEntitiesForExactDueDate: vi.fn(),
  findInvoiceEntityById: vi.fn(),
  findInvoiceWithItemsAndPaymentsBySiteEntity: vi.fn(),
  findInvoiceWithItemsAndPaymentsEntity: vi.fn(),
  findInvoiceWithItemsEntity: vi.fn(),
  findInvoiceWithPaymentEntity: vi.fn(),
  findOverdueInvoiceEntities: vi.fn(),
  findPaginatedInvoicesWithItemsAndPayments: vi.fn(),
}));

describe("InvoiceRepository", () => {
  let repository: InvoiceRepository;

  const mockInvoice = {
    id: "invoice-1",
    invoiceNumber: "INV/2026/05/05-ABC123",
    pelangganId: "customer-1",
    issueDate: new Date("2026-05-05"),
    dueDate: new Date("2026-05-31"),
    status: "SENT",
    subtotal: 500000n,
    taxAmount: 55000n,
    discountAmount: 0n,
    totalAmount: 555000n,
    paidAmount: 0n,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockInvoiceWithPayment = {
    ...mockInvoice,
    payment: [
      {
        id: "payment-1",
        amount: 555000n,
        paymentDate: new Date("2026-05-10"),
        gatewayStatus: "PAID",
      },
    ],
  };

  beforeEach(() => {
    repository = new InvoiceRepository();
    vi.clearAllMocks();
  });

  describe("findUnique", () => {
    it("harus return invoice dengan payment", async () => {
      const { findInvoiceWithPaymentEntity } =
        await import("@/modules/finance/repositories/invoiceRepository.read");
      vi.mocked(findInvoiceWithPaymentEntity).mockResolvedValue(
        mockInvoiceWithPayment as never,
      );

      const result = await repository.findUnique("invoice-1");

      expect(result).toEqual(mockInvoiceWithPayment);
      expect(findInvoiceWithPaymentEntity).toHaveBeenCalledWith("invoice-1");
    });

    it("harus return null jika invoice tidak ditemukan", async () => {
      const { findInvoiceWithPaymentEntity } =
        await import("@/modules/finance/repositories/invoiceRepository.read");
      vi.mocked(findInvoiceWithPaymentEntity).mockResolvedValue(null);

      const result = await repository.findUnique("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findRawById", () => {
    it("harus return invoice entity by ID", async () => {
      const { findInvoiceEntityById } =
        await import("@/modules/finance/repositories/invoiceRepository.read");
      vi.mocked(findInvoiceEntityById).mockResolvedValue(mockInvoice as never);

      const result = await repository.findRawById("invoice-1");

      expect(result).toEqual(mockInvoice);
      expect(findInvoiceEntityById).toHaveBeenCalledWith("invoice-1");
    });
  });

  describe("findWithPayment", () => {
    it("harus return invoice dengan payment info", async () => {
      const { findInvoiceWithPaymentEntity } =
        await import("@/modules/finance/repositories/invoiceRepository.read");
      vi.mocked(findInvoiceWithPaymentEntity).mockResolvedValue(
        mockInvoiceWithPayment as never,
      );

      const result = await repository.findWithPayment("invoice-1");

      expect(result).toEqual(mockInvoiceWithPayment);
    });
  });

  describe("findWithItemsAndPayments", () => {
    it("harus return invoice dengan items dan payments", async () => {
      const { findInvoiceWithItemsAndPaymentsEntity } =
        await import("@/modules/finance/repositories/invoiceRepository.read");
      const mockInvoiceWithItems = {
        ...mockInvoiceWithPayment,
        invoiceItem: [
          {
            id: "item-1",
            description: "Internet Package",
            quantity: 1,
            unitPrice: 500000n,
            totalPrice: 500000n,
          },
        ],
      };

      vi.mocked(findInvoiceWithItemsAndPaymentsEntity).mockResolvedValue(
        mockInvoiceWithItems as never,
      );

      const result = await repository.findWithItemsAndPayments("invoice-1");

      expect(result).toEqual(mockInvoiceWithItems);
      expect(findInvoiceWithItemsAndPaymentsEntity).toHaveBeenCalledWith(
        "invoice-1",
      );
    });
  });

  describe("findCustomerPaymentStatus", () => {
    it("harus return payment status untuk customer", async () => {
      const mockPaymentStatus = {
        id: "invoice-1",
        status: "PAID",
        payment: [
          {
            id: "payment-1",
            gatewayStatus: "PAID",
          },
        ],
      };

      vi.mocked(prismaBilling.invoice.findUnique).mockResolvedValue(
        mockPaymentStatus as never,
      );

      const result = await repository.findCustomerPaymentStatus({
        invoiceId: "invoice-1",
        pelangganId: "customer-1",
      });

      expect(result).toEqual(mockPaymentStatus);
      expect(prismaBilling.invoice.findUnique).toHaveBeenCalledWith({
        where: {
          id: "invoice-1",
          pelangganId: "customer-1",
        },
        select: expect.any(Object),
      });
    });
  });

  describe("findMany", () => {
    it("harus return list invoices dengan filter", async () => {
      vi.mocked(prismaBilling.invoice.findMany).mockResolvedValue([
        mockInvoice as never,
      ]);

      const result = await repository.findMany({
        pelangganId: "customer-1",
      });

      expect(result).toHaveLength(1);
      expect(prismaBilling.invoice.findMany).toHaveBeenCalledWith({
        where: { pelangganId: "customer-1" },
      });
    });

    it("harus return list invoices dengan select fields", async () => {
      vi.mocked(prismaBilling.invoice.findMany).mockResolvedValue([
        { id: "invoice-1", status: "SENT" } as never,
      ]);

      const result = await repository.findMany(
        { pelangganId: "customer-1" },
        { id: true, status: true },
      );

      expect(result).toHaveLength(1);
      expect(prismaBilling.invoice.findMany).toHaveBeenCalledWith({
        where: { pelangganId: "customer-1" },
        select: { id: true, status: true },
      });
    });
  });

  describe("findPaginatedWithItemsAndPayments", () => {
    it("harus return paginated invoices", async () => {
      const { findPaginatedInvoicesWithItemsAndPayments } =
        await import("@/modules/finance/repositories/invoiceRepository.read");
      const mockPaginatedResult = {
        data: [mockInvoiceWithPayment],
        total: 1,
      };

      vi.mocked(findPaginatedInvoicesWithItemsAndPayments).mockResolvedValue(
        mockPaginatedResult as never,
      );

      const result = await repository.findPaginatedWithItemsAndPayments({
        where: { pelangganId: "customer-1" },
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(findPaginatedInvoicesWithItemsAndPayments).toHaveBeenCalledWith({
        where: { pelangganId: "customer-1" },
        page: 1,
        limit: 10,
      });
    });
  });

  describe("create", () => {
    it("harus create invoice baru", async () => {
      const { createInvoice } =
        await import("@/modules/finance/repositories/invoiceRepository.write");
      const createInput = {
        pelangganId: "customer-1",
        issueDate: new Date("2026-05-05"),
        dueDate: new Date("2026-05-31"),
        status: "SENT",
        subtotal: 500000n,
        taxAmount: 55000n,
        totalAmount: 555000n,
      };

      vi.mocked(createInvoice).mockResolvedValue(mockInvoice as never);

      const result = await repository.create(createInput as never);

      expect(result).toEqual(mockInvoice);
      expect(createInvoice).toHaveBeenCalledWith(createInput);
    });
  });

  describe("update", () => {
    it("harus update invoice", async () => {
      vi.mocked(prismaBilling.invoice.update).mockResolvedValue({
        ...mockInvoice,
        status: "PAID",
      } as never);

      const result = await repository.update("invoice-1", {
        status: "PAID",
      } as never);

      expect(result.status).toBe("PAID");
      expect(prismaBilling.invoice.update).toHaveBeenCalledWith({
        where: { id: "invoice-1" },
        data: { status: "PAID" },
      });
    });
  });

  describe("deleteById", () => {
    it("harus delete invoice", async () => {
      vi.mocked(prismaBilling.invoice.delete).mockResolvedValue(
        mockInvoice as never,
      );

      await repository.deleteById("invoice-1");

      expect(prismaBilling.invoice.delete).toHaveBeenCalledWith({
        where: { id: "invoice-1" },
      });
    });
  });
});
