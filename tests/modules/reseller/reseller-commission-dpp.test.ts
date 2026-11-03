import { describe, expect, it, vi } from "vitest";
import {
  calculateCommissionAmount,
  calculateCommissionBase,
  percentToBasisPoints,
} from "@/modules/reseller/domain/commission-base";
import { ResellerCommissionService } from "@/modules/reseller/services/ResellerCommissionService";
import type { IResellerCommissionRepository } from "@/modules/reseller/domain/ports/IResellerCommissionRepository";
import type { ResellerCommissionEntity } from "@/modules/reseller/domain/entities/ResellerCommissionEntity";

/** Dasar komisi = DPP (tagihan tanpa PPN), bukan total tagihan. */

describe("calculateCommissionBase", () => {
  it("mengurangkan PPN dari total tagihan", () => {
    expect(
      calculateCommissionBase({
        totalAmount: 111000,
        taxAmount: 11000,
        saldoKreditUsed: 0,
      }),
    ).toBe(100000);
  });

  it("memakai total apa adanya untuk invoice tanpa PPN", () => {
    expect(
      calculateCommissionBase({
        totalAmount: 150000,
        taxAmount: 0,
        saldoKreditUsed: 0,
      }),
    ).toBe(150000);
  });

  // Reviewer: saldo kredit ikut tersimpan di discountAmount dan mengecilkan
  // totalAmount, padahal ia alat bayar (uang pelanggan yang sudah diterima).
  it("tidak mengurangkan saldo kredit: lunas penuh dengan saldo tetap ber-DPP penuh", () => {
    expect(
      calculateCommissionBase({
        totalAmount: 0,
        taxAmount: 11000,
        saldoKreditUsed: 111000,
      }),
    ).toBe(100000);
  });

  it("saldo kredit sebagian tidak mengecilkan DPP", () => {
    expect(
      calculateCommissionBase({
        totalAmount: 61000,
        taxAmount: 11000,
        saldoKreditUsed: 50000,
      }),
    ).toBe(100000);
  });

  it("potongan harga sungguhan tetap mengurangi DPP", () => {
    // Subtotal 100.000 − diskon 10.000 = 90.000; PPN 11% = 9.900.
    expect(
      calculateCommissionBase({
        totalAmount: 99900,
        taxAmount: 9900,
        saldoKreditUsed: 0,
      }),
    ).toBe(90000);
  });

  it("tidak pernah negatif", () => {
    expect(
      calculateCommissionBase({
        totalAmount: 0,
        taxAmount: 11000,
        saldoKreditUsed: 0,
      }),
    ).toBe(0);
  });
});

describe("calculateCommissionAmount", () => {
  it("membulatkan komisi persen ke bawah", () => {
    expect(
      calculateCommissionAmount(
        { type: "PERCENTAGE", rate: 7, fixedAmount: null },
        100001,
      ),
    ).toBe(7000);
  });

  it.each([
    // 2,5% × 100.001 = 2.500,025 → 2.500
    [2.5, 100001, 2500],
    // 2,55% × 100.000 = 2.550 tepat; float naif (2.55*100000/100) = 2549.999…
    [2.55, 100000, 2550],
    [0.07, 1000000, 700],
    [0.29, 100, 0],
    [33.33, 300, 99],
    [100, 123456, 123456],
  ])(
    "persen desimal %d%% dari DPP %d dihitung eksak = %d",
    (rate, baseAmount, expected) => {
      expect(
        calculateCommissionAmount(
          { type: "PERCENTAGE", rate, fixedAmount: null },
          baseAmount,
        ),
      ).toBe(expected);
    },
  );

  it("basis poin menyerap galat float persen", () => {
    expect(percentToBasisPoints(2.55)).toBe(255);
    expect(percentToBasisPoints(0.29)).toBe(29);
    expect(percentToBasisPoints(10)).toBe(1000);
  });

  it("memberi nominal tetap untuk DPP positif", () => {
    expect(
      calculateCommissionAmount(
        { type: "FIXED", rate: null, fixedAmount: 5000 },
        100000,
      ),
    ).toBe(5000);
  });

  it("tidak memberi komisi untuk DPP nol, termasuk aturan nominal", () => {
    expect(
      calculateCommissionAmount(
        { type: "FIXED", rate: null, fixedAmount: 5000 },
        0,
      ),
    ).toBe(0);
  });
});

function createRepository(): IResellerCommissionRepository {
  return {
    findCustomerContext: vi.fn().mockResolvedValue({
      tenantId: "tenant-1",
      pelangganId: "pelanggan-1",
      resellerId: "reseller-1",
      resellerStatus: "ACTIVE",
      resellerStatusChangedAt: null,
      hargaPaketId: "package-1",
    }),
    findActiveCommissionRule: vi.fn().mockResolvedValue({
      id: "rule-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: null,
      type: "PERCENTAGE",
      rate: 10,
      fixedAmount: null,
      status: "ACTIVE",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    }),
    findCommissionByInvoiceId: vi.fn().mockResolvedValue(null),
    createCommission: vi.fn(
      async (data) =>
        ({
          ...data,
          id: "commission-1",
          status: "ACCRUED",
          settlementId: null,
          settledAt: null,
          paidAt: null,
          createdAt: data.accruedAt,
          updatedAt: data.accruedAt,
          deletedAt: null,
        }) as ResellerCommissionEntity,
    ),
    resellerExists: vi.fn(),
    restoreCancelledCommission: vi.fn(),
    reaccrueReversedCommission: vi.fn(),
    findCommissions: vi.fn(),
    createSettlement: vi.fn(),
    findSettlements: vi.fn(),
    getCommissionSummary: vi.fn(),
  };
}

function setup(amounts: {
  totalAmount: number;
  taxAmount: number;
  saldoKreditUsed?: number;
}) {
  const repository = createRepository();
  const accountingEvents = {
    commissionAccrued: vi.fn(),
    commissionCancelled: vi.fn(),
    commissionClawedBack: vi.fn(),
    settlementPaid: vi.fn(),
  };
  const service = new ResellerCommissionService(
    repository,
    { isEnabled: vi.fn().mockResolvedValue(true) },
    {
      isPaid: vi.fn().mockResolvedValue(true),
      findPaidAmounts: vi
        .fn()
        .mockResolvedValue({ saldoKreditUsed: 0, ...amounts }),
    },
    accountingEvents,
  );
  return { repository, accountingEvents, service };
}

const PAID_EVENT = {
  tenantId: "tenant-1",
  invoiceId: "invoice-1",
  pelangganId: "pelanggan-1",
  // Payload INVOICE_PAID membawa total TERMASUK PPN; komisi tidak memakainya.
  amount: 111000,
  paidAt: new Date("2026-10-05T00:00:00.000Z"),
};

describe("ResellerCommissionService — dasar komisi DPP", () => {
  it("menghitung komisi dari DPP invoice ber-PPN, bukan dari total", async () => {
    const { repository, accountingEvents, service } = setup({
      totalAmount: 111000,
      taxAmount: 11000,
    });

    const commission = await service.accrueFromPaidInvoice(PAID_EVENT);

    expect(repository.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({ baseAmount: 100000, commissionAmount: 10000 }),
    );
    expect(accountingEvents.commissionAccrued).toHaveBeenCalledWith(commission);
  });

  it("menghitung komisi dari total untuk invoice tanpa PPN", async () => {
    const { repository, service } = setup({
      totalAmount: 100000,
      taxAmount: 0,
    });

    await service.accrueFromPaidInvoice({ ...PAID_EVENT, amount: 100000 });

    expect(repository.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({ baseAmount: 100000, commissionAmount: 10000 }),
    );
  });

  it("berkomisi atas invoice yang dilunasi penuh dengan saldo kredit", async () => {
    const { repository, service } = setup({
      totalAmount: 0,
      taxAmount: 11000,
      saldoKreditUsed: 111000,
    });

    await service.accrueFromPaidInvoice({ ...PAID_EVENT, amount: 0 });

    expect(repository.createCommission).toHaveBeenCalledWith(
      expect.objectContaining({ baseAmount: 100000, commissionAmount: 10000 }),
    );
  });

  it("tidak mengabarkan accounting bila komisi tidak terbit", async () => {
    const { repository, accountingEvents, service } = setup({
      totalAmount: 11000,
      taxAmount: 11000,
    });

    const commission = await service.accrueFromPaidInvoice(PAID_EVENT);

    expect(commission).toBeNull();
    expect(repository.createCommission).not.toHaveBeenCalled();
    expect(accountingEvents.commissionAccrued).not.toHaveBeenCalled();
  });

  it("mengabarkan accounting saat komisi yang batal dipulihkan", async () => {
    const { repository, accountingEvents, service } = setup({
      totalAmount: 111000,
      taxAmount: 11000,
    });
    const restored = {
      id: "commission-1",
      accruedAt: PAID_EVENT.paidAt,
    } as ResellerCommissionEntity;
    vi.mocked(repository.findCommissionByInvoiceId).mockResolvedValueOnce({
      ...restored,
      status: "ACCRUED",
      settlementId: null,
      deletedAt: new Date("2026-10-02T00:00:00.000Z"),
    } as ResellerCommissionEntity);
    vi.mocked(repository.restoreCancelledCommission).mockResolvedValueOnce(
      restored,
    );

    await service.accrueFromPaidInvoice(PAID_EVENT);

    expect(accountingEvents.commissionAccrued).toHaveBeenCalledWith(restored);
  });
});
