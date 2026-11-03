import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prismaAuth } from "@/lib/prisma";
import { ResellerCommissionRepository } from "@/modules/reseller/repositories/ResellerCommissionRepository";
import { ResellerCommissionReversalRepository } from "@/modules/reseller/repositories/ResellerCommissionReversalRepository";
import { ResellerCommissionAdjustmentRepository } from "@/modules/reseller/repositories/ResellerCommissionAdjustmentRepository";
import { lockResellerAdjustments } from "@/modules/reseller/repositories/commission-locks";

/**
 * Clawback komisi reseller di Postgres sungguhan: pengeluaran komisi dari
 * settlement yang belum dibayar, koreksi komisi yang sudah dibayar, pemotongan
 * koreksi pada settlement berikutnya (tidak di bawah 0, sisa terbawa), dan
 * idempotensi di bawah event ganda yang berlomba.
 *
 * Dilewati tanpa `TEST_DATABASE_URL`; lihat ./scripts/setup-test-db.sh.
 */

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const RESELLER = "reseller-uji-clawback";
const RULE = "rule-uji-clawback";
const INVOICE_PREFIX = "invoice-uji-clawback-";
const REASON = "Invoice di-void setelah komisi dibayar";
const CONCURRENT_REVERSALS = 6;
/** Cukup lama agar pembalikan sempat tertahan kunci settlement yang terbuka. */
const BLOCKED_REVERSAL_WAIT_MS = 300;
const JULY = {
  periodStart: new Date("2026-07-01T00:00:00.000Z"),
  periodEnd: new Date("2026-07-31T23:59:59.999Z"),
};
const AUGUST = {
  periodStart: new Date("2026-08-01T00:00:00.000Z"),
  periodEnd: new Date("2026-08-31T23:59:59.999Z"),
};

const commissions = new ResellerCommissionRepository(prismaAuth as never);
const reversals = new ResellerCommissionReversalRepository(prismaAuth as never);
const adjustments = new ResellerCommissionAdjustmentRepository(
  prismaAuth as never,
);

async function bersihkan() {
  await prismaAuth.resellerCommissionAdjustmentApplication.deleteMany({
    where: { adjustment: { resellerId: RESELLER } },
  });
  await prismaAuth.resellerCommissionAdjustment.deleteMany({
    where: { resellerId: RESELLER },
  });
  await prismaAuth.resellerCommission.deleteMany({
    where: { resellerId: RESELLER },
  });
  await prismaAuth.resellerSettlement.deleteMany({
    where: { resellerId: RESELLER },
  });
  await prismaAuth.resellerCommissionRule.deleteMany({ where: { id: RULE } });
  await prismaAuth.reseller.deleteMany({ where: { id: RESELLER } });
}

async function akru(invoice: string, amount: number, accruedAt: Date) {
  const created = await commissions.createCommission({
    tenantId: null,
    resellerId: RESELLER,
    pelangganId: "pelanggan-uji-clawback",
    invoiceId: `${INVOICE_PREFIX}${invoice}`,
    paymentId: null,
    commissionRuleId: RULE,
    type: "FIXED",
    rate: null,
    baseAmount: amount * 10,
    commissionAmount: amount,
    period: accruedAt.toISOString().slice(0, 7),
    accruedAt,
  });
  if (!created) throw new Error("komisi uji gagal dibuat");
  return created;
}

async function settle(period: typeof JULY) {
  const outcome = await commissions.createSettlement({
    tenantId: null,
    resellerId: RESELLER,
    ...period,
    notes: null,
  });
  if (outcome.kind !== "settled") throw new Error(`settlement ${outcome.kind}`);
  return outcome.settlement;
}

/** Sama dengan efek markPaid pada data reseller (tanpa rekening Kas & Bank). */
async function tandaiDibayar(settlementId: string) {
  const paidAt = new Date("2026-08-05T00:00:00.000Z");
  await prismaAuth.resellerSettlement.update({
    where: { id: settlementId },
    data: { status: "PAID", paidAt },
  });
  await prismaAuth.resellerCommission.updateMany({
    where: { settlementId },
    data: { status: "PAID", paidAt },
  });
}

function batalkan(invoice: string) {
  return reversals.reverseForUnpaidInvoice({
    tenantId: null,
    invoiceId: `${INVOICE_PREFIX}${invoice}`,
    reason: REASON,
  });
}

function bacaSettlement(id: string) {
  return prismaAuth.resellerSettlement.findUniqueOrThrow({ where: { id } });
}

describeDb("Clawback komisi reseller", () => {
  beforeEach(async () => {
    await bersihkan();
    await prismaAuth.reseller.create({
      data: { id: RESELLER, code: "RSL-UJI-CLAW", name: "Reseller Uji" },
    });
    await prismaAuth.resellerCommissionRule.create({
      data: { id: RULE, resellerId: RESELLER, type: "FIXED", fixedAmount: 1 },
    });
  });

  afterAll(async () => {
    await bersihkan();
  });

  it("membatalkan komisi ACCRUED tanpa koreksi", async () => {
    await akru("a", 10000, new Date("2026-07-05T00:00:00.000Z"));

    const reversal = await batalkan("a");

    expect(reversal.cancelled).toHaveLength(1);
    expect(reversal.clawbacks).toEqual([]);
    expect((await batalkan("a")).cancelled).toEqual([]);
  });

  it("mengeluarkan komisi dari settlement PENDING dan menghitung ulang totalnya", async () => {
    await akru("a", 10000, new Date("2026-07-05T00:00:00.000Z"));
    await akru("b", 25000, new Date("2026-07-06T00:00:00.000Z"));
    const settlement = await settle(JULY);

    const reversal = await batalkan("a");

    expect(reversal.cancelled).toEqual([
      expect.objectContaining({
        status: "ACCRUED",
        settlementId: null,
        deletedAt: expect.any(Date),
      }),
    ]);
    expect(reversal.clawbacks).toEqual([]);
    const recomputed = await bacaSettlement(settlement.id);
    expect(recomputed).toMatchObject({
      totalAmount: 25000,
      commissionCount: 1,
      adjustmentAmount: 0,
      deletedAt: null,
    });
    // Komisi yang dikeluarkan pulih seperti ACCRUED biasa bila lunas lagi.
    const restored = await commissions.restoreCancelledCommission({
      commissionId: reversal.cancelled[0].id,
      accruedAt: new Date("2026-08-02T00:00:00.000Z"),
      period: "2026-08",
    });
    expect(restored).toMatchObject({ status: "ACCRUED", deletedAt: null });
  });

  it("membatalkan settlement yang tidak lagi berisi komisi", async () => {
    await akru("a", 10000, new Date("2026-07-05T00:00:00.000Z"));
    const settlement = await settle(JULY);
    await prismaAuth.resellerSettlement.update({
      where: { id: settlement.id },
      data: { status: "APPROVED" },
    });

    await batalkan("a");

    expect(await bacaSettlement(settlement.id)).toMatchObject({
      totalAmount: 0,
      commissionCount: 0,
      deletedAt: expect.any(Date),
    });
  });

  it("menagih balik komisi yang sudah dibayar, sekali saja meski event berulang", async () => {
    const paid = await akru("a", 10000, new Date("2026-07-05T00:00:00.000Z"));
    const settlement = await settle(JULY);
    await tandaiDibayar(settlement.id);

    const first = await batalkan("a");
    const replay = await batalkan("a");

    expect(first.cancelled).toEqual([]);
    expect(first.clawbacks).toEqual([
      expect.objectContaining({
        sourceCommissionId: paid.id,
        amount: 10000,
        remainingAmount: 10000,
        reason: REASON,
      }),
    ]);
    // Replay mengabarkan ulang koreksi yang sama (jurnal idempoten per id).
    expect(replay.clawbacks.map((entry) => entry.id)).toEqual(
      first.clawbacks.map((entry) => entry.id),
    );
    const commission = await prismaAuth.resellerCommission.findUniqueOrThrow({
      where: { id: paid.id },
    });
    expect(commission.status).toBe("REVERSED");
    expect(commission.deletedAt).toBeNull();
    // Settlement yang sudah dibayar tidak diubah.
    expect(await bacaSettlement(settlement.id)).toMatchObject({
      status: "PAID",
      totalAmount: 10000,
    });
  });

  it("event ganda yang berlomba hanya mencatat satu koreksi", async () => {
    await akru("a", 10000, new Date("2026-07-05T00:00:00.000Z"));
    await tandaiDibayar((await settle(JULY)).id);

    await Promise.all(
      Array.from({ length: CONCURRENT_REVERSALS }, () => batalkan("a")),
    );

    expect(
      await prismaAuth.resellerCommissionAdjustment.count({
        where: { resellerId: RESELLER },
      }),
    ).toBe(1);
  });

  it("memotong koreksi dari settlement berikutnya, tidak di bawah 0, sisanya terbawa", async () => {
    await akru("a", 30000, new Date("2026-07-05T00:00:00.000Z"));
    await tandaiDibayar((await settle(JULY)).id);
    await batalkan("a");

    await akru("b", 12000, new Date("2026-08-05T00:00:00.000Z"));
    const august = await settle(AUGUST);

    expect(august).toMatchObject({
      totalAmount: 0,
      adjustmentAmount: 12000,
      commissionCount: 1,
    });
    const [open] = (
      await adjustments.findAdjustments({
        tenantId: null,
        resellerId: RESELLER,
      })
    ).items;
    expect(open.remainingAmount).toBe(18000);

    await akru("c", 50000, new Date("2026-08-20T00:00:00.000Z"));
    const next = await settle(AUGUST);

    expect(next).toMatchObject({ totalAmount: 32000, adjustmentAmount: 18000 });
    const [settled] = (
      await adjustments.findAdjustments({
        tenantId: null,
        resellerId: RESELLER,
      })
    ).items;
    expect(settled.remainingAmount).toBe(0);
  });

  it("dua settlement bersamaan tidak memotong sisa koreksi yang sama dua kali", async () => {
    await akru("a", 30000, new Date("2026-07-05T00:00:00.000Z"));
    await tandaiDibayar((await settle(JULY)).id);
    await batalkan("a");
    await akru("b", 25000, new Date("2026-08-05T00:00:00.000Z"));
    await akru("c", 25000, new Date("2026-09-05T00:00:00.000Z"));

    const [august, september] = await Promise.all([
      settle(AUGUST),
      settle({
        periodStart: new Date("2026-09-01T00:00:00.000Z"),
        periodEnd: new Date("2026-09-30T23:59:59.999Z"),
      }),
    ]);

    expect(august.adjustmentAmount + september.adjustmentAmount).toBe(30000);
    expect(august.totalAmount + september.totalAmount).toBe(20000);
  });

  it("melepas koreksi yang dipotongkan bila komisi settlement itu dikeluarkan", async () => {
    await akru("a", 30000, new Date("2026-07-05T00:00:00.000Z"));
    await tandaiDibayar((await settle(JULY)).id);
    await batalkan("a");
    await akru("b", 20000, new Date("2026-08-05T00:00:00.000Z"));
    const august = await settle(AUGUST);
    expect(august.adjustmentAmount).toBe(20000);

    await batalkan("b");

    expect(await bacaSettlement(august.id)).toMatchObject({
      deletedAt: expect.any(Date),
      adjustmentAmount: 0,
    });
    const [open] = (
      await adjustments.findAdjustments({
        tenantId: null,
        resellerId: RESELLER,
      })
    ).items;
    expect(open.remainingAmount).toBe(30000);
  });
  // Settlement yang sedang dibuat memegang kunci koreksi reseller; pembalikan
  // wajib menunggunya lalu membaca ulang kandidat, bukan membatalkan dari
  // snapshot ACCRUED yang sudah basi (klaimnya cocok 0 baris, hilang diam-diam).
  it("pembalikan yang berlomba dengan pembuatan settlement tetap mengeluarkan komisinya", async () => {
    const commission = await akru(
      "a",
      10000,
      new Date("2026-07-05T00:00:00.000Z"),
    );
    let releaseSettlement: () => void = () => undefined;
    const settlementGate = new Promise<void>((resolve) => {
      releaseSettlement = resolve;
    });
    let markClaimed: () => void = () => undefined;
    const claimed = new Promise<void>((resolve) => {
      markClaimed = resolve;
    });
    const settlementId = "settlement-uji-clawback-race";

    // Meniru settleInTransaction: kunci reseller, buat settlement, klaim.
    const settling = prismaAuth.$transaction(
      async (tx) => {
        await lockResellerAdjustments(tx, RESELLER);
        await tx.resellerSettlement.create({
          data: {
            id: settlementId,
            resellerId: RESELLER,
            ...JULY,
            totalAmount: 10000,
            commissionCount: 1,
          },
        });
        await tx.resellerCommission.updateMany({
          where: { id: commission.id, status: "ACCRUED", settlementId: null },
          data: { status: "SETTLED", settlementId, settledAt: new Date() },
        });
        markClaimed();
        await settlementGate;
      },
      { timeout: 10000 },
    );
    await claimed;
    const reversing = batalkan("a");
    await new Promise((resolve) =>
      setTimeout(resolve, BLOCKED_REVERSAL_WAIT_MS),
    );
    releaseSettlement();
    await settling;
    const reversal = await reversing;

    expect(reversal.cancelled).toEqual([
      expect.objectContaining({ id: commission.id, settlementId: null }),
    ]);
    expect(
      await prismaAuth.resellerCommission.findUniqueOrThrow({
        where: { id: commission.id },
      }),
    ).toMatchObject({ settlementId: null, deletedAt: expect.any(Date) });
    expect(await bacaSettlement(settlementId)).toMatchObject({
      commissionCount: 0,
      deletedAt: expect.any(Date),
    });
  });

  it("settlement APPROVED yang komisinya dikeluarkan kembali PENDING dan wajib disetujui ulang", async () => {
    await akru("a", 10000, new Date("2026-07-05T00:00:00.000Z"));
    await akru("b", 25000, new Date("2026-07-06T00:00:00.000Z"));
    const settlement = await settle(JULY);
    await prismaAuth.resellerSettlement.update({
      where: { id: settlement.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date("2026-08-01T00:00:00.000Z"),
        approvedById: "penyetuju-1",
      },
    });

    await batalkan("a");

    expect(await bacaSettlement(settlement.id)).toMatchObject({
      status: "PENDING",
      approvedAt: null,
      approvedById: null,
      totalAmount: 25000,
      deletedAt: null,
    });
  });

  // paid → settlement PAID → pelunasan ditarik → lunas lagi → ditarik lagi.
  it("komisi yang ditagih balik terbit ulang saat lunas lagi dan bisa ditagih balik lagi", async () => {
    const paid = await akru("a", 10000, new Date("2026-07-05T00:00:00.000Z"));
    await tandaiDibayar((await settle(JULY)).id);
    const [firstClawback] = (await batalkan("a")).clawbacks;

    const reaccrued = await commissions.reaccrueReversedCommission({
      commissionId: paid.id,
      invoiceId: paid.invoiceId,
      accruedAt: new Date("2026-08-10T00:00:00.000Z"),
      period: "2026-08",
    });
    const replay = await commissions.reaccrueReversedCommission({
      commissionId: paid.id,
      invoiceId: paid.invoiceId,
      accruedAt: new Date("2026-08-10T00:00:00.000Z"),
      period: "2026-08",
    });

    expect(reaccrued).toMatchObject({
      status: "ACCRUED",
      settlementId: null,
      paidAt: null,
      period: "2026-08",
    });
    expect(replay).toBeNull();
    // Akrual baru mengimbangi koreksinya: settlement berikutnya bernilai 0.
    const august = await settle(AUGUST);
    expect(august).toMatchObject({
      totalAmount: 0,
      adjustmentAmount: 10000,
      commissionCount: 1,
    });
    await tandaiDibayar(august.id);

    const second = await batalkan("a");

    expect(second.clawbacks).toHaveLength(2);
    expect(second.clawbacks.map((entry) => entry.id)).toContain(
      firstClawback.id,
    );
    expect(
      second.clawbacks.find((entry) => entry.id !== firstClawback.id),
    ).toMatchObject({ amount: 10000, remainingAmount: 10000 });
  });
});
