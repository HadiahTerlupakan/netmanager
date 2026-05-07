import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../../setup";
import { PemasukanRepository } from "@/modules/finance/repositories/PemasukanRepository";
import { PengeluaranRepository } from "@/modules/finance/repositories/PengeluaranRepository";
import { BillingAnalyticsRepository } from "@/modules/finance/repositories/BillingAnalyticsRepository";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import type { PrismaClient } from "@prisma/client";

const billingMockFns = vi.hoisted(() => ({
  invoiceFindMany: vi.fn(),
  paymentFindMany: vi.fn(),
  paymentGroupBy: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: vi.fn(),
}));

vi.mock("@/lib/prisma-billing", () => ({
  prismaBilling: {
    invoice: {
      findMany: billingMockFns.invoiceFindMany,
    },
    payment: {
      findMany: billingMockFns.paymentFindMany,
      groupBy: billingMockFns.paymentGroupBy,
    },
  },
}));

describe("Finance Repositories - IDOR Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PemasukanRepository", () => {
    it("should isolate findAll by tenantId", async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValue({
        tenantId: "tenant-X",
        isSuperAdmin: false,
      });
      const repo = new PemasukanRepository(
        prismaMock as unknown as PrismaClient,
      );

      Object.assign(prismaMock, { pemasukan: prismaMock.pemasukan });
      prismaMock.pemasukan.findMany.mockResolvedValue([]);

      await repo.findAll();

      expect(prismaMock.pemasukan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "tenant-X" },
        }),
      );
    });
  });

  describe("PengeluaranRepository", () => {
    it("should isolate findAll by tenantId", async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValue({
        tenantId: "tenant-Y",
        isSuperAdmin: false,
      });
      const repo = new PengeluaranRepository(
        prismaMock as unknown as PrismaClient,
      );

      Object.assign(prismaMock, { pengeluaran: prismaMock.pengeluaran });
      prismaMock.pengeluaran.findMany.mockResolvedValue([]);

      await repo.findAll();

      expect(prismaMock.pengeluaran.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "tenant-Y" },
        }),
      );
    });
  });

  describe("BillingAnalyticsRepository", () => {
    it("should isolate getInvoicesWithPayments by tenantId", async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValue({
        tenantId: "tenant-Z",
        isSuperAdmin: false,
      });
      const repo = new BillingAnalyticsRepository();

      await repo.getInvoicesWithPayments(new Date(), new Date());

      expect(billingMockFns.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: "tenant-Z" }),
        }),
      );
    });

    it("should isolate groupBy top customers by tenantId", async () => {
      vi.mocked(getTenantIdFromContext).mockResolvedValue({
        tenantId: "tenant-Z",
        isSuperAdmin: false,
      });
      const repo = new BillingAnalyticsRepository();

      Object.assign(prismaMock, { pelanggan: prismaMock.pelanggan });
      billingMockFns.paymentGroupBy.mockResolvedValue([]);
      prismaMock.pelanggan.findMany.mockResolvedValue([]);

      await repo.getTopCustomersByPayment(new Date(), new Date());

      expect(billingMockFns.paymentGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: "tenant-Z" }),
        }),
      );
    });
  });
});
