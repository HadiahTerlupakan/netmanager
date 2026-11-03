import { describe, expect, it, vi } from "vitest";

import type { ResellerCommissionEntity } from "@/modules/reseller/domain/entities/ResellerCommissionEntity";
import type { ResellerStatusValue } from "@/modules/reseller/domain/entities/ResellerEntity";
import type { IResellerCommissionRepository } from "@/modules/reseller/domain/ports/IResellerCommissionRepository";
import { ResellerCommissionService } from "@/modules/reseller/services/ResellerCommissionService";

const STATUS_CHANGED_AT = new Date("2026-11-02T03:00:00.000Z");
const PAID_BEFORE_CHANGE = new Date("2026-11-01T00:00:00.000Z");
const PAID_AFTER_CHANGE = new Date("2026-11-03T00:00:00.000Z");

/** Hanya method yang dipakai jalur akrual; sisanya tidak boleh tersentuh. */
function createRepository(): IResellerCommissionRepository {
  return new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, key: string) =>
        (target[key] ??= vi.fn()),
    },
  ) as unknown as IResellerCommissionRepository;
}

function setup(
  resellerStatus: ResellerStatusValue,
  resellerStatusChangedAt: Date | null,
) {
  const repository = createRepository();
  vi.mocked(repository.findCustomerContext).mockResolvedValueOnce({
    tenantId: "tenant-1",
    pelangganId: "pelanggan-1",
    resellerId: "reseller-1",
    resellerStatus,
    resellerStatusChangedAt,
    hargaPaketId: "package-1",
  });
  const invoiceStatus = {
    isPaid: vi.fn().mockResolvedValue(true),
    findPaidAmounts: vi.fn().mockResolvedValue({
      totalAmount: 200000,
      taxAmount: 0,
      saldoKreditUsed: 0,
    }),
  };
  const service = new ResellerCommissionService(
    repository,
    { isEnabled: vi.fn().mockResolvedValue(true) },
    invoiceStatus,
    {
      commissionAccrued: vi.fn(),
      commissionCancelled: vi.fn(),
      settlementPaid: vi.fn(),
    },
  );
  return { repository, invoiceStatus, service };
}

function accrue(service: ResellerCommissionService, paidAt: Date) {
  return service.accrueFromPaidInvoice({
    tenantId: "tenant-1",
    invoiceId: "invoice-1",
    pelangganId: "pelanggan-1",
    amount: 200000,
    paidAt,
  });
}

function cancelledCommission(): ResellerCommissionEntity {
  const at = new Date("2026-10-30T00:00:00.000Z");
  return {
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
    period: "2026-10",
    settlementId: null,
    accruedAt: at,
    settledAt: null,
    paidAt: null,
    createdAt: at,
    updatedAt: at,
    deletedAt: at,
  };
}

describe("ResellerCommissionService — status kemitraan", () => {
  it.each(["INACTIVE", "SUSPENDED", "TERMINATED"] as const)(
    "tidak mengakru komisi untuk pembayaran sejak reseller %s",
    async (resellerStatus) => {
      const { repository, invoiceStatus, service } = setup(
        resellerStatus,
        STATUS_CHANGED_AT,
      );

      const result = await accrue(service, PAID_AFTER_CHANGE);

      expect(result).toBeNull();
      expect(invoiceStatus.findPaidAmounts).not.toHaveBeenCalled();
      expect(repository.createCommission).not.toHaveBeenCalled();
      expect(repository.restoreCancelledCommission).not.toHaveBeenCalled();
    },
  );

  it("non-ACTIVE tanpa jejak waktu perubahan tidak mengakru", async () => {
    const { repository, service } = setup("INACTIVE", null);

    expect(await accrue(service, PAID_BEFORE_CHANGE)).toBeNull();
    expect(repository.createCommission).not.toHaveBeenCalled();
  });

  it("event terlambat untuk pembayaran sebelum suspend tetap mengakru komisi", async () => {
    const { repository, service } = setup("SUSPENDED", STATUS_CHANGED_AT);
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce(null);
    vi.mocked(repository.findActiveCommissionRule).mockResolvedValueOnce({
      id: "rule-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: "package-1",
      type: "PERCENTAGE",
      rate: 10,
      fixedAmount: null,
      status: "ACTIVE",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    });

    await accrue(service, PAID_BEFORE_CHANGE);

    expect(repository.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        resellerId: "reseller-1",
        commissionAmount: 20000,
        accruedAt: PAID_BEFORE_CHANGE,
      }),
    );
  });

  it("komisi yang dibatalkan dipulihkan bila pelunasan ulang terjadi sebelum suspend", async () => {
    const { repository, service } = setup("SUSPENDED", STATUS_CHANGED_AT);
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce(
      cancelledCommission(),
    );

    await accrue(service, PAID_BEFORE_CHANGE);

    expect(repository.restoreCancelledCommission).toHaveBeenCalledWith(
      expect.objectContaining({ commissionId: "commission-1" }),
    );
  });

  it("pelunasan ulang sesudah suspend tidak memulihkan komisi", async () => {
    const { repository, service } = setup("TERMINATED", STATUS_CHANGED_AT);

    expect(await accrue(service, PAID_AFTER_CHANGE)).toBeNull();
    expect(repository.findCommissionByInvoiceId).not.toHaveBeenCalled();
    expect(repository.restoreCancelledCommission).not.toHaveBeenCalled();
  });
});
