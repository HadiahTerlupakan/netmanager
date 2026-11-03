import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResellerCommissionReversalService } from "@/modules/reseller/services/ResellerCommissionReversalService";
import type { IResellerCommissionReversalRepository } from "@/modules/reseller/domain/ports/IResellerCommissionReversalRepository";
import type { IResellerCommissionAdjustmentRepository } from "@/modules/reseller/domain/ports/IResellerCommissionAdjustmentRepository";
import type { IInvoicePaymentStatusReader } from "@/modules/reseller/domain/ports/IInvoicePaymentStatusReader";
import type { IResellerAccountingEvents } from "@/modules/reseller/domain/ports/IResellerAccountingEvents";
import type {
  ResellerCommissionAdjustmentEntity,
  ResellerCommissionEntity,
} from "@/modules/reseller/domain/entities/ResellerCommissionEntity";

const CANCELLED = {
  id: "commission-1",
  tenantId: "tenant-1",
  invoiceId: "invoice-1",
  status: "ACCRUED",
  settlementId: null,
  accruedAt: new Date("2026-10-05T00:00:00.000Z"),
  deletedAt: new Date("2026-11-02T00:00:00.000Z"),
} as ResellerCommissionEntity;

const CLAWBACK: ResellerCommissionAdjustmentEntity = {
  id: "adjustment-1",
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  pelangganId: "pelanggan-1",
  invoiceId: "invoice-1",
  sourceCommissionId: "commission-2",
  amount: 15000,
  reason: "Invoice di-void setelah komisi dibayar",
  createdAt: new Date("2026-11-02T00:00:00.000Z"),
  remainingAmount: 15000,
};

const INPUT = {
  tenantId: "tenant-1",
  invoiceId: "invoice-1",
  reason: "Invoice di-void setelah komisi dibayar",
};

describe("ResellerCommissionReversalService", () => {
  let reversals: IResellerCommissionReversalRepository;
  let adjustments: IResellerCommissionAdjustmentRepository;
  let invoiceStatus: IInvoicePaymentStatusReader;
  let accountingEvents: IResellerAccountingEvents;
  let service: ResellerCommissionReversalService;

  beforeEach(() => {
    reversals = {
      reverseForUnpaidInvoice: vi
        .fn()
        .mockResolvedValue({ cancelled: [], clawbacks: [] }),
    };
    adjustments = { findAdjustments: vi.fn() };
    invoiceStatus = {
      isPaid: vi.fn().mockResolvedValue(false),
      findPaidAmounts: vi.fn(),
    };
    accountingEvents = {
      commissionAccrued: vi.fn(),
      commissionCancelled: vi.fn(),
      commissionClawedBack: vi.fn(),
      settlementPaid: vi.fn(),
    };
    service = new ResellerCommissionReversalService(
      reversals,
      adjustments,
      invoiceStatus,
      accountingEvents,
    );
  });

  // Audit #13: void invoice PAID membatalkan komisi yang belum dibayar.
  it("membatalkan komisi belum dibayar dan membalik jurnal akrunya", async () => {
    vi.mocked(reversals.reverseForUnpaidInvoice).mockResolvedValueOnce({
      cancelled: [CANCELLED],
      clawbacks: [],
    });

    const summary = await service.reverseForUnpaidInvoice(INPUT);

    expect(summary).toEqual({ cancelledCount: 1, clawbackCount: 0 });
    expect(reversals.reverseForUnpaidInvoice).toHaveBeenCalledWith(INPUT);
    expect(accountingEvents.commissionCancelled).toHaveBeenCalledWith(
      CANCELLED,
    );
    expect(accountingEvents.commissionClawedBack).not.toHaveBeenCalled();
  });

  it("menagih balik komisi yang sudah dibayar lewat event koreksi", async () => {
    vi.mocked(reversals.reverseForUnpaidInvoice).mockResolvedValueOnce({
      cancelled: [],
      clawbacks: [CLAWBACK],
    });

    const summary = await service.reverseForUnpaidInvoice(INPUT);

    expect(summary).toEqual({ cancelledCount: 0, clawbackCount: 1 });
    expect(accountingEvents.commissionClawedBack).toHaveBeenCalledWith(
      CLAWBACK,
    );
    expect(accountingEvents.commissionCancelled).not.toHaveBeenCalled();
  });

  // At-least-once: replay mengabarkan ulang koreksi yang sudah tercatat agar
  // jurnal yang tertinggal (proses mati sebelum event) tetap terbentuk.
  it("mengabarkan ulang koreksi yang sudah tercatat saat replay", async () => {
    vi.mocked(reversals.reverseForUnpaidInvoice).mockResolvedValue({
      cancelled: [],
      clawbacks: [CLAWBACK],
    });

    await service.reverseForUnpaidInvoice(INPUT);
    await service.reverseForUnpaidInvoice(INPUT);

    expect(accountingEvents.commissionClawedBack).toHaveBeenCalledTimes(2);
  });

  // Reviewer: event yang diproses setelah invoice lunas lagi tidak boleh
  // membatalkan atau menagih balik komisi yang sah.
  it("tidak membalik apa pun bila invoice sudah lunas lagi", async () => {
    vi.mocked(invoiceStatus.isPaid).mockResolvedValueOnce(true);

    const summary = await service.reverseForUnpaidInvoice(INPUT);

    expect(summary).toEqual({ cancelledCount: 0, clawbackCount: 0 });
    expect(reversals.reverseForUnpaidInvoice).not.toHaveBeenCalled();
  });

  it("event tanpa tenant mencari komisi berdasarkan invoice saja", async () => {
    await service.reverseForUnpaidInvoice({
      invoiceId: "invoice-1",
      reason: INPUT.reason,
    });

    expect(reversals.reverseForUnpaidInvoice).toHaveBeenCalledWith({
      tenantId: null,
      invoiceId: "invoice-1",
      reason: INPUT.reason,
    });
  });

  it("mendaftar koreksi reseller lewat repository", async () => {
    vi.mocked(adjustments.findAdjustments).mockResolvedValueOnce({
      items: [CLAWBACK],
      total: 1,
    });

    const result = await service.listAdjustments({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      take: 10,
    });

    expect(result.items).toEqual([CLAWBACK]);
    expect(adjustments.findAdjustments).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      take: 10,
    });
  });
});
