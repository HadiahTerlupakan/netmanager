import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResellerCommissionService } from "@/modules/reseller/services/ResellerCommissionService";
import type { IResellerCommissionRepository } from "@/modules/reseller/domain/ports/IResellerCommissionRepository";

function createRepository(): IResellerCommissionRepository {
  return {
    findCustomerContext: vi.fn(),
    findActiveCommissionRule: vi.fn(),
    findCommissionByInvoiceId: vi.fn(),
    createCommission: vi.fn(),
    findCommissions: vi.fn(),
    createSettlement: vi.fn(),
    findSettlements: vi.fn(),
    getCommissionSummary: vi.fn(),
  };
}

describe("ResellerCommissionService", () => {
  let repository: IResellerCommissionRepository;
  let service: ResellerCommissionService;

  beforeEach(() => {
    repository = createRepository();
    service = new ResellerCommissionService(repository);
  });

  it("accrues percentage commission when paid invoice belongs to reseller customer", async () => {
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce(null);
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce({
      tenantId: "tenant-1",
      pelangganId: "pelanggan-1",
      resellerId: "reseller-1",
      hargaPaketId: "package-1",
    });
    vi.mocked(repository.findActiveCommissionRule).mockResolvedValueOnce({
      id: "rule-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: "package-1",
      type: "PERCENTAGE",
      rate: 10,
      fixedAmount: null,
      status: "ACTIVE",
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      endsAt: null,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      deletedAt: null,
    });
    vi.mocked(repository.createCommission).mockResolvedValueOnce({
      id: "commission-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      pelangganId: "pelanggan-1",
      invoiceId: "invoice-1",
      paymentId: null,
      commissionRuleId: "rule-1",
      type: "PERCENTAGE",
      rate: 10,
      baseAmount: 200000,
      commissionAmount: 20000,
      status: "ACCRUED",
      period: "2026-07",
      settlementId: null,
      accruedAt: new Date("2026-07-08T00:00:00.000Z"),
      settledAt: null,
      paidAt: null,
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      updatedAt: new Date("2026-07-08T00:00:00.000Z"),
      deletedAt: null,
    });

    const result = await service.accrueFromPaidInvoice({
      invoiceId: "invoice-1",
      pelangganId: "pelanggan-1",
      amount: 200000,
      paidAt: new Date("2026-07-08T00:00:00.000Z"),
    });

    expect(result?.commissionAmount).toBe(20000);
    expect(repository.createCommission).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      pelangganId: "pelanggan-1",
      invoiceId: "invoice-1",
      paymentId: null,
      commissionRuleId: "rule-1",
      type: "PERCENTAGE",
      rate: 10,
      baseAmount: 200000,
      commissionAmount: 20000,
      period: "2026-07",
      accruedAt: new Date("2026-07-08T00:00:00.000Z"),
    });
  });

  it("skips commission when invoice was already accrued", async () => {
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce({
      id: "commission-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      pelangganId: "pelanggan-1",
      invoiceId: "invoice-1",
      paymentId: null,
      commissionRuleId: "rule-1",
      type: "PERCENTAGE",
      rate: 10,
      baseAmount: 200000,
      commissionAmount: 20000,
      status: "ACCRUED",
      period: "2026-07",
      settlementId: null,
      accruedAt: new Date("2026-07-08T00:00:00.000Z"),
      settledAt: null,
      paidAt: null,
      createdAt: new Date("2026-07-08T00:00:00.000Z"),
      updatedAt: new Date("2026-07-08T00:00:00.000Z"),
      deletedAt: null,
    });

    const result = await service.accrueFromPaidInvoice({
      invoiceId: "invoice-1",
      pelangganId: "pelanggan-1",
      amount: 200000,
      paidAt: new Date("2026-07-08T00:00:00.000Z"),
    });

    expect(result).toBeNull();
    expect(repository.createCommission).not.toHaveBeenCalled();
  });

  it("creates settlement from accrued commissions in period", async () => {
    vi.mocked(repository.createSettlement).mockResolvedValueOnce({
      id: "settlement-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.999Z"),
      totalAmount: 50000,
      commissionCount: 2,
      status: "PENDING",
      notes: null,
      createdAt: new Date("2026-07-31T00:00:00.000Z"),
      updatedAt: new Date("2026-07-31T00:00:00.000Z"),
      approvedAt: null,
      paidAt: null,
      deletedAt: null,
    });

    const result = await service.createSettlement({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.999Z"),
    });

    expect(result.totalAmount).toBe(50000);
    expect(repository.createSettlement).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.999Z"),
      notes: null,
    });
  });
});
