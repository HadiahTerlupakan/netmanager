import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prismaAuth } from "@/lib/prisma";
import { ResellerCommissionRepository } from "@/modules/reseller/repositories/ResellerCommissionRepository";

/**
 * Dua penjaga uang reseller yang hanya bisa dibuktikan Postgres sungguhan:
 *
 * 1. Settlement bersamaan untuk reseller dan periode yang sama tidak boleh
 *    men-settle komisi yang sama dua kali (audit #4/#12): UPDATE kedua harus
 *    menunggu row lock lalu menilai ulang `status = ACCRUED`.
 * 2. Akru bersamaan untuk invoice yang sama dengan tenantId NULL tidak boleh
 *    menghasilkan dua komisi: unique (tenantId, invoiceId) tidak berlaku untuk
 *    NULL, jadi yang menjaga adalah advisory lock per invoice.
 *
 * Dilewati tanpa `TEST_DATABASE_URL`; lihat ./scripts/setup-test-db.sh.
 */

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const RESELLER = "reseller-uji-konkurensi";
const RULE = "rule-uji-konkurensi";
const INVOICE_PREFIX = "invoice-uji-konkurensi-";
const ROUNDS = 8;
const CONCURRENT_SETTLEMENTS = 4;
const COMMISSIONS_PER_ROUND = 3;
const CONCURRENT_ACCRUALS = 6;
const PERIOD = {
  periodStart: new Date("2026-07-01T00:00:00.000Z"),
  periodEnd: new Date("2026-07-31T23:59:59.999Z"),
};

const repo = new ResellerCommissionRepository(prismaAuth as never);

async function bersihkan() {
  await prismaAuth.resellerCommission.deleteMany({
    where: { resellerId: RESELLER },
  });
  await prismaAuth.resellerSettlement.deleteMany({
    where: { resellerId: RESELLER },
  });
  await prismaAuth.resellerCommissionRule.deleteMany({ where: { id: RULE } });
  await prismaAuth.reseller.deleteMany({ where: { id: RESELLER } });
}

function commissionData(invoiceId: string) {
  return {
    tenantId: null as string | null,
    resellerId: RESELLER,
    pelangganId: "pelanggan-uji-konkurensi",
    invoiceId,
    paymentId: null as string | null,
    commissionRuleId: RULE,
    type: "PERCENTAGE" as const,
    rate: 10,
    baseAmount: 100000,
    commissionAmount: 10000,
    period: "2026-07",
    accruedAt: new Date("2026-07-10T00:00:00.000Z"),
  };
}

describeDb("ResellerCommissionRepository — konkurensi", () => {
  beforeEach(async () => {
    await bersihkan();
    await prismaAuth.reseller.create({
      data: { id: RESELLER, code: "RSL-UJI-KONK", name: "Reseller Uji" },
    });
    await prismaAuth.resellerCommissionRule.create({
      data: { id: RULE, resellerId: RESELLER, type: "PERCENTAGE", rate: 10 },
    });
  });

  afterAll(async () => {
    await bersihkan();
  });

  it("settlement bersamaan tidak pernah men-settle komisi yang sama dua kali", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      for (let index = 0; index < COMMISSIONS_PER_ROUND; index += 1) {
        await repo.createCommission(
          commissionData(`${INVOICE_PREFIX}${round}-${index}`),
        );
      }

      const outcomes = await Promise.all(
        Array.from({ length: CONCURRENT_SETTLEMENTS }, () =>
          repo.createSettlement({
            tenantId: null,
            resellerId: RESELLER,
            ...PERIOD,
            notes: null,
          }),
        ),
      );

      const settled = outcomes.filter((outcome) => outcome.kind === "settled");
      expect(settled).toHaveLength(1);
      const settlements = await prismaAuth.resellerSettlement.findMany({
        where: { resellerId: RESELLER },
      });
      expect(settlements).toHaveLength(round + 1);
      const settledThisRound = settled[0];
      if (settledThisRound?.kind !== "settled") throw new Error("unreachable");
      expect(settledThisRound.settlement.commissionCount).toBe(
        COMMISSIONS_PER_ROUND,
      );
      const claimed = await prismaAuth.resellerCommission.count({
        where: { settlementId: settledThisRound.settlement.id },
      });
      expect(claimed).toBe(COMMISSIONS_PER_ROUND);
    }

    const stillAccrued = await prismaAuth.resellerCommission.count({
      where: { resellerId: RESELLER, status: "ACCRUED" },
    });
    expect(stillAccrued).toBe(0);
  });

  it("akru bersamaan tanpa tenant hanya mencatat satu komisi per invoice", async () => {
    const invoiceId = `${INVOICE_PREFIX}tanpa-tenant`;

    const results = await Promise.all(
      Array.from({ length: CONCURRENT_ACCRUALS }, () =>
        repo.createCommission(commissionData(invoiceId)),
      ),
    );

    expect(results.filter((result) => result !== null)).toHaveLength(1);
    const rows = await prismaAuth.resellerCommission.count({
      where: { invoiceId },
    });
    expect(rows).toBe(1);
  });
});
