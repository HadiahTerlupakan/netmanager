import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResellerCommissionService } from "@/modules/reseller/services/ResellerCommissionService";
import type { IResellerCommissionRepository } from "@/modules/reseller/domain/ports/IResellerCommissionRepository";
import type { IResellerModuleGate } from "@/modules/reseller/domain/ports/IResellerModuleGate";
import type { IInvoicePaymentStatusReader } from "@/modules/reseller/domain/ports/IInvoicePaymentStatusReader";
import type { IResellerAccountingEvents } from "@/modules/reseller/domain/ports/IResellerAccountingEvents";
import type {
  ResellerCommissionEntity,
  ResellerCommissionRuleEntity,
  ResellerSettlementEntity,
} from "@/modules/reseller/domain/entities/ResellerCommissionEntity";
import { AppError } from "@/lib/errors";

function createRepository(): IResellerCommissionRepository {
  return {
    findCustomerContext: vi.fn(),
    findActiveCommissionRule: vi.fn(),
    findCommissionByInvoiceId: vi.fn(),
    createCommission: vi.fn(),
    resellerExists: vi.fn().mockResolvedValue(true),
    restoreCancelledCommission: vi.fn(),
    reaccrueReversedCommission: vi.fn(),
    findCommissions: vi.fn(),
    createSettlement: vi.fn(),
    findSettlements: vi.fn(),
    getCommissionSummary: vi.fn(),
  };
}

const RULE: ResellerCommissionRuleEntity = {
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
};

const SETTLEMENT: ResellerSettlementEntity = {
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
  approvedById: null,
  paidById: null,
  paymentMethod: null,
  paymentReference: null,
  paymentAccountId: null,
  adjustmentAmount: 0,
  deletedAt: null,
};

const JULY_PERIOD = {
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  periodStart: new Date("2026-07-01T00:00:00.000Z"),
  periodEnd: new Date("2026-07-31T23:59:59.999Z"),
};

const CUSTOMER = {
  tenantId: "tenant-1",
  pelangganId: "pelanggan-1",
  resellerId: "reseller-1",
  resellerStatus: "ACTIVE" as const,
  resellerStatusChangedAt: null as Date | null,
  hargaPaketId: "package-1",
};

const PAID_INPUT = {
  tenantId: "tenant-1",
  invoiceId: "invoice-1",
  pelangganId: "pelanggan-1",
  amount: 200000,
  paidAt: new Date("2026-07-08T00:00:00.000Z"),
};

const COMMISSION: ResellerCommissionEntity = {
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
};

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected promise to reject");
}

describe("ResellerCommissionService", () => {
  let repository: IResellerCommissionRepository;
  let moduleGate: IResellerModuleGate;
  let invoiceStatus: IInvoicePaymentStatusReader;
  let accountingEvents: IResellerAccountingEvents;
  let service: ResellerCommissionService;

  beforeEach(() => {
    repository = createRepository();
    moduleGate = { isEnabled: vi.fn().mockResolvedValue(true) };
    invoiceStatus = {
      isPaid: vi.fn().mockResolvedValue(true),
      // Invoice tanpa PPN: DPP = total = 200.000.
      findPaidAmounts: vi.fn().mockResolvedValue({
        totalAmount: 200000,
        taxAmount: 0,
        saldoKreditUsed: 0,
      }),
    };
    accountingEvents = {
      commissionAccrued: vi.fn(),
      commissionCancelled: vi.fn(),
      commissionClawedBack: vi.fn(),
      settlementPaid: vi.fn(),
    };
    service = new ResellerCommissionService(
      repository,
      moduleGate,
      invoiceStatus,
      accountingEvents,
    );
  });

  it("accrues percentage commission when paid invoice belongs to reseller customer", async () => {
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce(null);
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce({
      tenantId: "tenant-1",
      pelangganId: "pelanggan-1",
      resellerId: "reseller-1",
      resellerStatus: "ACTIVE",
      resellerStatusChangedAt: null,
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
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce({
      tenantId: "tenant-1",
      pelangganId: "pelanggan-1",
      resellerId: "reseller-1",
      resellerStatus: "ACTIVE",
      resellerStatusChangedAt: null,
      hargaPaketId: "package-1",
    });
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
    expect(repository.findCommissionByInvoiceId).toHaveBeenCalledWith(
      "tenant-1",
      "invoice-1",
    );
    expect(repository.createCommission).not.toHaveBeenCalled();
  });

  it("creates settlement from accrued commissions in period", async () => {
    vi.mocked(repository.createSettlement).mockResolvedValueOnce({
      kind: "settled",
      settlement: SETTLEMENT,
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

  // Audit #1/#3/#9: INVOICE_PAID tidak membawa tenantId; dulu service memfilter
  // tenantId null sehingga komisi tidak pernah terbit.
  it("resolves tenant from the customer when the event has no tenantId", async () => {
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce({
      tenantId: "tenant-1",
      pelangganId: "pelanggan-1",
      resellerId: "reseller-1",
      resellerStatus: "ACTIVE",
      resellerStatusChangedAt: null,
      hargaPaketId: "package-1",
    });
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce(null);
    vi.mocked(repository.findActiveCommissionRule).mockResolvedValueOnce(RULE);

    await service.accrueFromPaidInvoice({
      invoiceId: "invoice-1",
      pelangganId: "pelanggan-1",
      amount: 200000,
      paidAt: new Date("2026-07-08T00:00:00.000Z"),
    });

    expect(repository.findCustomerContext).toHaveBeenCalledWith(
      null,
      "pelanggan-1",
    );
    expect(repository.findCommissionByInvoiceId).toHaveBeenCalledWith(
      "tenant-1",
      "invoice-1",
    );
    expect(repository.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        commissionAmount: 20000,
      }),
    );
  });

  // Audit #32: modul nonaktif tidak boleh tetap menerbitkan komisi.
  it("does not accrue when the tenant disabled the reseller module", async () => {
    vi.mocked(moduleGate.isEnabled).mockResolvedValueOnce(false);
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce({
      tenantId: "tenant-1",
      pelangganId: "pelanggan-1",
      resellerId: "reseller-1",
      resellerStatus: "ACTIVE",
      resellerStatusChangedAt: null,
      hargaPaketId: "package-1",
    });
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValue(null);
    vi.mocked(repository.findActiveCommissionRule).mockResolvedValue(RULE);

    const result = await service.accrueFromPaidInvoice({
      tenantId: "tenant-1",
      invoiceId: "invoice-1",
      pelangganId: "pelanggan-1",
      amount: 200000,
      paidAt: new Date("2026-07-08T00:00:00.000Z"),
    });

    expect(result).toBeNull();
    expect(moduleGate.isEnabled).toHaveBeenCalledWith("tenant-1");
    expect(repository.createCommission).not.toHaveBeenCalled();
  });

  // Reviewer: INVOICE_PAID yang tiba/di-retry setelah invoice di-void atau
  // pelunasannya ditarik dulu tetap menerbitkan komisi yang tak pernah batal.
  it("does not accrue when the invoice is no longer paid", async () => {
    vi.mocked(invoiceStatus.findPaidAmounts).mockResolvedValueOnce(null);
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce(CUSTOMER);
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValue(null);
    vi.mocked(repository.findActiveCommissionRule).mockResolvedValue(RULE);

    const result = await service.accrueFromPaidInvoice(PAID_INPUT);

    expect(result).toBeNull();
    expect(invoiceStatus.findPaidAmounts).toHaveBeenCalledWith("invoice-1");
    expect(repository.createCommission).not.toHaveBeenCalled();
  });

  // Reviewer: komisi yang dibatalkan saat invoice sempat tidak lunas harus
  // terbit lagi ketika invoice lunas lagi, bukan dianggap "sudah ada".
  it("restores a commission cancelled while the invoice was unpaid", async () => {
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce(CUSTOMER);
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce({
      ...COMMISSION,
      deletedAt: new Date("2026-07-09T00:00:00.000Z"),
    });
    vi.mocked(repository.restoreCancelledCommission).mockResolvedValueOnce(
      COMMISSION,
    );

    const result = await service.accrueFromPaidInvoice({
      ...PAID_INPUT,
      paidAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    expect(result).toBe(COMMISSION);
    expect(repository.restoreCancelledCommission).toHaveBeenCalledWith({
      commissionId: "commission-1",
      accruedAt: new Date("2026-08-02T00:00:00.000Z"),
      period: "2026-08",
    });
    expect(repository.createCommission).not.toHaveBeenCalled();
  });

  // Reviewer: proses mati setelah komisi tersimpan dan sebelum event akru
  // terkirim; ulangan INVOICE_PAID harus membentuk jurnal akrunya.
  it("re-announces the accrual of an active commission on a duplicate paid event", async () => {
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce(CUSTOMER);
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce(
      COMMISSION,
    );

    const result = await service.accrueFromPaidInvoice(PAID_INPUT);

    expect(result).toBeNull();
    expect(repository.createCommission).not.toHaveBeenCalled();
    expect(repository.restoreCancelledCommission).not.toHaveBeenCalled();
    expect(accountingEvents.commissionAccrued).toHaveBeenCalledTimes(1);
    expect(accountingEvents.commissionAccrued).toHaveBeenCalledWith(COMMISSION);
  });

  it("does not announce a cancelled settled commission that stays cancelled", async () => {
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce(CUSTOMER);
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce({
      ...COMMISSION,
      status: "SETTLED",
      settlementId: "settlement-1",
      deletedAt: new Date("2026-07-09T00:00:00.000Z"),
    });

    await service.accrueFromPaidInvoice(PAID_INPUT);

    expect(accountingEvents.commissionAccrued).not.toHaveBeenCalled();
  });

  it("never restores a cancelled commission that was already settled", async () => {
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce(CUSTOMER);
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce({
      ...COMMISSION,
      status: "SETTLED",
      settlementId: "settlement-1",
      deletedAt: new Date("2026-07-09T00:00:00.000Z"),
    });

    const result = await service.accrueFromPaidInvoice(PAID_INPUT);

    expect(result).toBeNull();
    expect(repository.restoreCancelledCommission).not.toHaveBeenCalled();
  });

  // Clawback: komisi yang sudah ditagih balik terbit ulang sebagai akrual
  // baru bila invoice lunas kembali, agar koreksinya diimbangi dan reseller
  // tetap berkomisi sekali atas invoice yang benar-benar lunas.
  it("re-accrues a reversed commission when the invoice is paid again", async () => {
    const repaidAt = new Date("2026-08-10T00:00:00.000Z");
    const reaccrued = {
      ...COMMISSION,
      accruedAt: repaidAt,
      period: "2026-08",
    };
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce(CUSTOMER);
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce({
      ...COMMISSION,
      status: "REVERSED",
      settlementId: "settlement-1",
    });
    vi.mocked(repository.reaccrueReversedCommission).mockResolvedValueOnce(
      reaccrued,
    );

    const result = await service.accrueFromPaidInvoice({
      ...PAID_INPUT,
      paidAt: repaidAt,
    });

    expect(result).toEqual(reaccrued);
    expect(repository.reaccrueReversedCommission).toHaveBeenCalledWith({
      commissionId: "commission-1",
      invoiceId: "invoice-1",
      accruedAt: repaidAt,
      period: "2026-08",
    });
    expect(accountingEvents.commissionAccrued).toHaveBeenCalledWith(reaccrued);
    expect(repository.createCommission).not.toHaveBeenCalled();
  });

  it("does not announce when the reversed commission was already re-accrued", async () => {
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce(CUSTOMER);
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce({
      ...COMMISSION,
      status: "REVERSED",
    });
    vi.mocked(repository.reaccrueReversedCommission).mockResolvedValueOnce(
      null,
    );

    const result = await service.accrueFromPaidInvoice(PAID_INPUT);

    expect(result).toBeNull();
    expect(accountingEvents.commissionAccrued).not.toHaveBeenCalled();
  });

  // Ref jurnal akru dan kunci koreksi memakai accruedAt: akrual baru dengan
  // tanggal yang sama (pelunasan lama diulang) akan tertahan akrual lama.
  it("moves the new accrual strictly after the previous one", async () => {
    vi.mocked(repository.findCustomerContext).mockResolvedValueOnce(CUSTOMER);
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce({
      ...COMMISSION,
      status: "REVERSED",
    });

    await service.accrueFromPaidInvoice(PAID_INPUT);

    expect(repository.reaccrueReversedCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        accruedAt: new Date(COMMISSION.accruedAt.getTime() + 1),
      }),
    );
  });

  // Audit #38: kondisi bisnis settlement dijawab 400/404/409, bukan 500.
  it("rejects settlement with 400 when no commission can be settled", async () => {
    vi.mocked(repository.createSettlement).mockResolvedValueOnce({
      kind: "empty",
    });

    const error = await captureError(service.createSettlement(JULY_PERIOD));

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(400);
  });

  it("rejects settlement with 404 when the reseller does not exist", async () => {
    vi.mocked(repository.resellerExists).mockResolvedValueOnce(false);

    const error = await captureError(service.createSettlement(JULY_PERIOD));

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(404);
    expect(repository.createSettlement).not.toHaveBeenCalled();
  });

  it("rejects settlement with 400 when the period is reversed", async () => {
    const error = await captureError(
      service.createSettlement({
        ...JULY_PERIOD,
        periodStart: JULY_PERIOD.periodEnd,
        periodEnd: JULY_PERIOD.periodStart,
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(400);
    expect(repository.createSettlement).not.toHaveBeenCalled();
  });

  // Audit #4/#12: settlement serentak yang kalah tidak boleh tercatat.
  it("rejects settlement with 409 when another request claimed the commissions", async () => {
    vi.mocked(repository.createSettlement).mockResolvedValueOnce({
      kind: "conflict",
    });

    const error = await captureError(service.createSettlement(JULY_PERIOD));

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(409);
  });
});
