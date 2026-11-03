import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { EventJobData } from "@/lib/event-bus/queues";

const journals = vi.hoisted(() => ({
  postResellerCommissionAccrual: vi.fn(),
  postResellerCommissionClawback: vi.fn(),
  postResellerSettlementPayment: vi.fn(),
  reverseResellerCommissionAccrual: vi.fn(),
}));
vi.mock(
  "@/modules/accounting/services/journal/reseller-commission-journals",
  () => journals,
);

import {
  handleResellerCommissionAccruedAccounting,
  handleResellerCommissionCancelledAccounting,
  handleResellerCommissionClawedBackAccounting,
  handleResellerSettlementPaidAccounting,
} from "@/modules/accounting/services/event-handlers/reseller-commission-accounting.handler";
import { CoaNotFoundError } from "@/modules/accounting/errors";

function job(eventName: string, payload: Record<string, unknown>) {
  return { data: { eventName, payload } } as unknown as Job<EventJobData>;
}

const ACCRUED = {
  tenantId: "tenant-1",
  commissionId: "commission-1",
  accrualRef: "commission-1:2026-10-05T00:00:00.000Z",
  resellerId: "reseller-1",
  invoiceId: "invoice-1",
  amount: 10000,
  accruedAt: "2026-10-05T00:00:00.000Z",
};

describe("handler akuntansi komisi reseller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("membukukan akru dengan tenant dari payload", async () => {
    await handleResellerCommissionAccruedAccounting(
      job("reseller:commission.accrued", ACCRUED),
    );

    expect(journals.postResellerCommissionAccrual).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      commissionId: "commission-1",
      accrualRef: ACCRUED.accrualRef,
      invoiceId: "invoice-1",
      amount: 10000,
      accruedAt: new Date(ACCRUED.accruedAt),
    });
  });

  it("menolak payload tanpa tenantId (system context lintas tenant)", async () => {
    const { tenantId: _tenantId, ...withoutTenant } = ACCRUED;

    await expect(
      handleResellerCommissionAccruedAccounting(
        job("reseller:commission.accrued", withoutTenant),
      ),
    ).rejects.toThrow("tidak valid");
    expect(journals.postResellerCommissionAccrual).not.toHaveBeenCalled();
  });

  it("melewati tenant yang COA-nya belum di-seed tanpa retry", async () => {
    journals.reverseResellerCommissionAccrual.mockRejectedValueOnce(
      new CoaNotFoundError("2-000"),
    );

    await expect(
      handleResellerCommissionCancelledAccounting(
        job("reseller:commission.cancelled", {
          tenantId: "tenant-1",
          accrualRef: ACCRUED.accrualRef,
          invoiceId: "invoice-1",
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it("meneruskan galat lain agar job di-retry", async () => {
    journals.postResellerSettlementPayment.mockRejectedValueOnce(
      new Error("db down"),
    );

    await expect(
      handleResellerSettlementPaidAccounting(
        job("reseller:settlement.paid", {
          tenantId: "tenant-1",
          settlementId: "settlement-1",
          resellerId: "reseller-1",
          amount: 50000,
          paidAt: "2026-11-03T00:00:00.000Z",
          accountId: "account-1",
        }),
      ),
    ).rejects.toThrow("db down");
  });

  it("menolak nominal pecahan atau nol", async () => {
    await expect(
      handleResellerCommissionAccruedAccounting(
        job("reseller:commission.accrued", { ...ACCRUED, amount: 10.5 }),
      ),
    ).rejects.toThrow("tidak valid");
  });

  it("membukukan koreksi komisi yang sudah dibayar", async () => {
    await handleResellerCommissionClawedBackAccounting(
      job("reseller:commission.clawed_back", {
        tenantId: "tenant-1",
        adjustmentId: "adjustment-1",
        commissionId: "commission-1",
        resellerId: "reseller-1",
        invoiceId: "invoice-1",
        amount: 10000,
        recordedAt: "2026-11-02T00:00:00.000Z",
      }),
    );

    expect(journals.postResellerCommissionClawback).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      adjustmentId: "adjustment-1",
      invoiceId: "invoice-1",
      amount: 10000,
      recordedAt: new Date("2026-11-02T00:00:00.000Z"),
    });
  });

  it("menolak koreksi tanpa tenant", async () => {
    await expect(
      handleResellerCommissionClawedBackAccounting(
        job("reseller:commission.clawed_back", {
          adjustmentId: "adjustment-1",
          invoiceId: "invoice-1",
          amount: 10000,
          recordedAt: "2026-11-02T00:00:00.000Z",
        }),
      ),
    ).rejects.toThrow("tidak valid");
    expect(journals.postResellerCommissionClawback).not.toHaveBeenCalled();
  });

  it("menerima settlement bertotal bersih 0 (habis dipotong koreksi)", async () => {
    await handleResellerSettlementPaidAccounting(
      job("reseller:settlement.paid", {
        tenantId: "tenant-1",
        settlementId: "settlement-1",
        resellerId: "reseller-1",
        amount: 0,
        paidAt: "2026-11-03T00:00:00.000Z",
        accountId: "account-1",
      }),
    );

    expect(journals.postResellerSettlementPayment).toHaveBeenCalledWith(
      expect.objectContaining({ settlementId: "settlement-1", amount: 0 }),
    );
  });
});
