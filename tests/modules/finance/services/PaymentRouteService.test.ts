import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  GatewayPaymentStatus,
  PaymentMethod,
  Prisma as PrismaBilling,
} from "@/modules/finance/lib/billing-prisma-boundary";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPaymentRepository = vi.hoisted(() => ({
  findPaginatedWithInvoice: vi.fn(),
  findByIdWithInvoice: vi.fn(),
  createWithInvoice: vi.fn(),
}));

const mockInvoiceRepository = vi.hoisted(() => ({
  findRawById: vi.fn(),
  findWithPayment: vi.fn(),
  updatePaymentStatus: vi.fn(),
}));

const mockRecompute = vi.hoisted(() => vi.fn());

const mockPelangganService = {
  getPelanggan: vi.fn(),
};

vi.mock("@/modules/finance/repositories/PaymentRepository", () => ({
  PaymentRepository: class {
    findPaginatedWithInvoice = mockPaymentRepository.findPaginatedWithInvoice;
    findByIdWithInvoice = mockPaymentRepository.findByIdWithInvoice;
    createWithInvoice = mockPaymentRepository.createWithInvoice;
  },
}));

vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: class {
    findRawById = mockInvoiceRepository.findRawById;
    findWithPayment = mockInvoiceRepository.findWithPayment;
    updatePaymentStatus = mockInvoiceRepository.updatePaymentStatus;
  },
}));

vi.mock("@/modules/finance/services/InvoicePaymentStateService", () => ({
  InvoicePaymentStateService: class MockInvoicePaymentStateService {
    recompute(...args: [string]) {
      return mockRecompute(...args);
    }
  },
}));

vi.mock("@/modules/pelanggan", () => ({
  getPelangganService: () => mockPelangganService,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
    logActivitySafe: vi.fn(),
    logAuth: vi.fn(),
    apiRequest: vi.fn(),
    dbOperation: vi.fn(),
  },
  logActivitySafe: vi.fn(),
}));

import * as PaymentRouteService from "@/modules/finance/services/PaymentRouteService";

describe("PaymentRouteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listPaymentsForRoute", () => {
    it("harus return paginated payments", async () => {
      const mockPayments = [
        { id: "payment-1", amount: 100000n },
        { id: "payment-2", amount: 200000n },
      ];

      mockPaymentRepository.findPaginatedWithInvoice.mockResolvedValue({
        data: mockPayments,
        total: 10,
      });

      const result = await PaymentRouteService.listPaymentsForRoute({
        filters: { page: 1, limit: 10 },
      });

      expect(result.data).toEqual(mockPayments);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("harus support filter by pelangganId", async () => {
      mockPaymentRepository.findPaginatedWithInvoice.mockResolvedValue({
        data: [],
        total: 0,
      });

      await PaymentRouteService.listPaymentsForRoute({
        filters: { pelangganId: "customer-1", page: 1, limit: 10 },
      });

      expect(
        mockPaymentRepository.findPaginatedWithInvoice,
      ).toHaveBeenCalledWith({
        where: { pelangganId: "customer-1" },
        page: 1,
        limit: 10,
      });
    });

    it("harus support filter by date range", async () => {
      mockPaymentRepository.findPaginatedWithInvoice.mockResolvedValue({
        data: [],
        total: 0,
      });

      await PaymentRouteService.listPaymentsForRoute({
        filters: {
          startDate: "2026-05-01",
          endDate: "2026-05-31",
          page: 1,
          limit: 10,
        },
      });

      expect(
        mockPaymentRepository.findPaginatedWithInvoice,
      ).toHaveBeenCalledWith({
        where: {
          paymentDate: {
            gte: new Date("2026-05-01"),
            lte: new Date("2026-05-31"),
          },
        },
        page: 1,
        limit: 10,
      });
    });

    it("harus calculate pagination correctly", async () => {
      mockPaymentRepository.findPaginatedWithInvoice.mockResolvedValue({
        data: [],
        total: 25,
      });

      const result = await PaymentRouteService.listPaymentsForRoute({
        filters: { page: 2, limit: 10 },
      });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });
  });

  describe("getPaymentForRoute", () => {
    it("harus return payment jika ditemukan dan user superadmin", async () => {
      const mockPayment = { id: "payment-1", amount: 100000n };
      mockPaymentRepository.findByIdWithInvoice.mockResolvedValue(mockPayment);

      const result = await PaymentRouteService.getPaymentForRoute({
        paymentId: "payment-1",
        user: { isSuperAdmin: true },
      });

      expect(result).toEqual({ status: "ok", data: mockPayment });
    });

    it("harus return not-found jika payment tidak ada", async () => {
      mockPaymentRepository.findByIdWithInvoice.mockResolvedValue(null);

      const result = await PaymentRouteService.getPaymentForRoute({
        paymentId: "payment-999",
      });

      expect(result).toEqual({ status: "not-found" });
    });

    it("harus check siteId access untuk non-superadmin", async () => {
      mockPaymentRepository.findByIdWithInvoice.mockResolvedValue({
        id: "payment-1",
        invoice: { siteId: "site-1" },
      });

      const result = await PaymentRouteService.getPaymentForRoute({
        paymentId: "payment-1",
        user: { siteId: "site-2" },
      });

      expect(result).toEqual({ status: "forbidden-site" });
    });

    it("harus allow access jika siteId match", async () => {
      const mockPayment = {
        id: "payment-1",
        invoice: { siteId: "site-1" },
      };
      mockPaymentRepository.findByIdWithInvoice.mockResolvedValue(mockPayment);

      const result = await PaymentRouteService.getPaymentForRoute({
        paymentId: "payment-1",
        user: { siteId: "site-1" },
      });

      expect(result).toEqual({ status: "ok", data: mockPayment });
    });

    it("harus check tenantId access jika tidak ada siteId", async () => {
      mockPaymentRepository.findByIdWithInvoice.mockResolvedValue({
        id: "payment-1",
        tenantId: "tenant-1",
      });

      const result = await PaymentRouteService.getPaymentForRoute({
        paymentId: "payment-1",
        user: { tenantId: "tenant-2" },
      });

      expect(result).toEqual({ status: "forbidden-tenant" });
    });
  });

  describe("createPaymentForRoute", () => {
    it("harus return pelanggan-not-found jika pelanggan tidak ada", async () => {
      mockPelangganService.getPelanggan.mockResolvedValue(null);

      const result = await PaymentRouteService.createPaymentForRoute({
        input: {
          pelangganId: "customer-999",
          amount: 100000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
        },
        user: { id: "user-1" },
      });

      expect(result).toEqual({ status: "pelanggan-not-found" });
    });

    it("harus return invoice-not-found jika invoice tidak ada", async () => {
      mockPelangganService.getPelanggan.mockResolvedValue({ id: "customer-1" });
      mockInvoiceRepository.findRawById.mockResolvedValue(null);

      const result = await PaymentRouteService.createPaymentForRoute({
        input: {
          pelangganId: "customer-1",
          invoiceId: "invoice-999",
          amount: 100000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
        },
        user: { id: "user-1" },
      });

      expect(result).toEqual({ status: "invoice-not-found" });
    });

    it("harus return invoice-not-found jika invoice bukan milik pelanggan", async () => {
      mockPelangganService.getPelanggan.mockResolvedValue({ id: "customer-1" });
      mockInvoiceRepository.findRawById.mockResolvedValue({
        id: "invoice-1",
        pelangganId: "customer-2",
      });

      const result = await PaymentRouteService.createPaymentForRoute({
        input: {
          pelangganId: "customer-1",
          invoiceId: "invoice-1",
          amount: 100000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
        },
        user: { id: "user-1" },
      });

      expect(result).toEqual({ status: "invoice-not-found" });
      expect(mockPaymentRepository.createWithInvoice).not.toHaveBeenCalled();
    });

    it("harus create payment dan delegasi recompute ke InvoicePaymentStateService", async () => {
      mockPelangganService.getPelanggan.mockResolvedValue({ id: "customer-1" });
      mockInvoiceRepository.findRawById.mockResolvedValue({
        id: "invoice-1",
        pelangganId: "customer-1",
      });
      mockPaymentRepository.createWithInvoice.mockResolvedValue({
        id: "payment-1",
        amount: 100000n,
      });

      const result = await PaymentRouteService.createPaymentForRoute({
        input: {
          pelangganId: "customer-1",
          invoiceId: "invoice-1",
          amount: 100000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
        },
        user: { id: "user-1" },
      });

      expect(result.status).toBe("created");
      expect(mockPaymentRepository.createWithInvoice).toHaveBeenCalled();
      expect(mockRecompute).toHaveBeenCalledWith("invoice-1");
      expect(mockInvoiceRepository.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it("harus create payment tanpa invoice (skip recompute)", async () => {
      mockPelangganService.getPelanggan.mockResolvedValue({ id: "customer-1" });
      mockPaymentRepository.createWithInvoice.mockResolvedValue({
        id: "payment-1",
        amount: 100000n,
      });

      const result = await PaymentRouteService.createPaymentForRoute({
        input: {
          pelangganId: "customer-1",
          amount: 100000,
          paymentMethod: PaymentMethod.CASH,
        },
        user: { id: "user-1" },
      });

      expect(result.status).toBe("created");
      expect(mockRecompute).not.toHaveBeenCalled();
      expect(mockInvoiceRepository.findWithPayment).not.toHaveBeenCalled();
    });

    it("harus set default payment status ke PAID", async () => {
      mockPelangganService.getPelanggan.mockResolvedValue({ id: "customer-1" });
      mockPaymentRepository.createWithInvoice.mockResolvedValue({
        id: "payment-1",
        amount: 100000n,
      });

      await PaymentRouteService.createPaymentForRoute({
        input: {
          pelangganId: "customer-1",
          amount: 100000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
        },
        user: { id: "user-1" },
      });

      expect(mockPaymentRepository.createWithInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          gatewayStatus: GatewayPaymentStatus.PAID,
        }),
      );
    });
  });

  describe("mapPaymentRouteError", () => {
    it("harus map foreign key error", () => {
      const error = new PrismaBilling.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: "5.0.0",
        },
      );

      const result = PaymentRouteService.mapPaymentRouteError(error);

      expect(result).toEqual({ status: "foreign-key-error" });
    });

    it("harus map unknown error dengan message", () => {
      const error = new Error("Database connection failed");

      const result = PaymentRouteService.mapPaymentRouteError(error);

      expect(result).toEqual({
        status: "unknown",
        message: "Database connection failed",
      });
    });

    it("harus map unknown error tanpa message", () => {
      const error = "string error";

      const result = PaymentRouteService.mapPaymentRouteError(error);

      expect(result).toEqual({
        status: "unknown",
        message: "Terjadi kesalahan server",
      });
    });
  });
});
