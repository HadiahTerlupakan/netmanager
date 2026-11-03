import { beforeEach, describe, expect, it, vi } from "vitest";

const bus = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("@/lib/event-bus", () => ({
  eventBus: { publish: bus.publish },
  EVENT_NAMES: {
    RESELLER_COMMISSION_ACCRUED: "reseller:commission.accrued",
    RESELLER_COMMISSION_CANCELLED: "reseller:commission.cancelled",
    RESELLER_COMMISSION_CLAWED_BACK: "reseller:commission.clawed_back",
    RESELLER_SETTLEMENT_PAID: "reseller:settlement.paid",
  },
}));

import { EventBusResellerAccountingEvents } from "@/modules/reseller/services/event-bus-accounting-events";
import { resellerCommissionAccrualRef } from "@/lib/event-bus/types";
import type {
  ResellerCommissionAdjustmentEntity,
  ResellerCommissionEntity,
  ResellerSettlementEntity,
} from "@/modules/reseller/domain/entities/ResellerCommissionEntity";

const ACCRUED_AT = new Date("2026-10-05T00:00:00.000Z");
const COMMISSION = {
  id: "commission-1",
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  invoiceId: "invoice-1",
  commissionAmount: 10000,
  accruedAt: ACCRUED_AT,
  deletedAt: null,
} as ResellerCommissionEntity;

const ADJUSTMENT: ResellerCommissionAdjustmentEntity = {
  id: "adjustment-1",
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  pelangganId: "pelanggan-1",
  invoiceId: "invoice-1",
  sourceCommissionId: "commission-1",
  amount: 10000,
  reason: "Invoice di-void setelah komisi dibayar",
  createdAt: new Date("2026-11-02T00:00:00.000Z"),
  remainingAmount: 10000,
};

describe("EventBusResellerAccountingEvents", () => {
  const events = new EventBusResellerAccountingEvents();

  beforeEach(() => vi.clearAllMocks());

  it("mengirim koreksi komisi bertenant dengan id koreksi sebagai kunci jurnal", async () => {
    await events.commissionClawedBack(ADJUSTMENT);

    expect(bus.publish).toHaveBeenCalledWith(
      "reseller:commission.clawed_back",
      {
        tenantId: "tenant-1",
        adjustmentId: "adjustment-1",
        commissionId: "commission-1",
        resellerId: "reseller-1",
        invoiceId: "invoice-1",
        amount: 10000,
        recordedAt: "2026-11-02T00:00:00.000Z",
      },
    );
  });

  it("tidak mengirim koreksi tanpa tenant", async () => {
    await events.commissionClawedBack({ ...ADJUSTMENT, tenantId: null });

    expect(bus.publish).not.toHaveBeenCalled();
  });

  it("mengirim akru komisi bertenant dengan ref per akrual", async () => {
    await events.commissionAccrued(COMMISSION);

    expect(bus.publish).toHaveBeenCalledWith("reseller:commission.accrued", {
      tenantId: "tenant-1",
      commissionId: "commission-1",
      accrualRef: "commission-1:2026-10-05T00:00:00.000Z",
      resellerId: "reseller-1",
      invoiceId: "invoice-1",
      amount: 10000,
      accruedAt: ACCRUED_AT.toISOString(),
    });
  });

  it("pembatalan memakai ref akrual yang sama agar jurnal yang tepat dibalik", async () => {
    await events.commissionCancelled({
      ...COMMISSION,
      deletedAt: new Date("2026-10-06T00:00:00.000Z"),
    });

    expect(bus.publish).toHaveBeenCalledWith(
      "reseller:commission.cancelled",
      expect.objectContaining({
        tenantId: "tenant-1",
        accrualRef: resellerCommissionAccrualRef(COMMISSION.id, ACCRUED_AT),
        cancelledAt: "2026-10-06T00:00:00.000Z",
      }),
    );
  });

  it("komisi yang dipulihkan mendapat ref baru", () => {
    expect(
      resellerCommissionAccrualRef(
        "commission-1",
        new Date("2026-11-01T00:00:00.000Z"),
      ),
    ).not.toBe(resellerCommissionAccrualRef(COMMISSION.id, ACCRUED_AT));
  });

  it("tidak mengirim apa pun untuk data tanpa tenant", async () => {
    await events.commissionAccrued({ ...COMMISSION, tenantId: null });

    expect(bus.publish).not.toHaveBeenCalled();
  });

  it("mengirim pembayaran settlement beserta rekening sumber dana", async () => {
    await events.settlementPaid({
      id: "settlement-1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      totalAmount: 50000,
      paidAt: ACCRUED_AT,
      paymentAccountId: "account-1",
    } as ResellerSettlementEntity);

    expect(bus.publish).toHaveBeenCalledWith("reseller:settlement.paid", {
      tenantId: "tenant-1",
      settlementId: "settlement-1",
      resellerId: "reseller-1",
      amount: 50000,
      paidAt: ACCRUED_AT.toISOString(),
      accountId: "account-1",
    });
  });

  it("menelan galat publish: transaksi bisnis sudah tersimpan", async () => {
    bus.publish.mockRejectedValueOnce(new Error("redis down"));

    await expect(events.commissionAccrued(COMMISSION)).resolves.toBeUndefined();
  });
});
