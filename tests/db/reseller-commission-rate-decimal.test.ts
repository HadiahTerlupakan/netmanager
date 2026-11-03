import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prismaAuth } from "@/lib/prisma";
import { ResellerCommissionRepository } from "@/modules/reseller/repositories/ResellerCommissionRepository";
import { ResellerCommissionRuleRepository } from "@/modules/reseller/repositories/ResellerCommissionRuleRepository";

/**
 * Kolom `rate` Decimal(5,2) harus menyimpan persen desimal apa adanya dan
 * repository mengembalikannya sebagai `number` (bukan Prisma.Decimal), baik
 * untuk aturan maupun salinannya di komisi. Hanya bisa dibuktikan Postgres.
 *
 * Dilewati tanpa `TEST_DATABASE_URL`; lihat ./scripts/setup-test-db.sh.
 */

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const TENANT = "tenant-uji-rate-desimal";
const RESELLER = "reseller-uji-rate-desimal";
const INVOICE = "invoice-uji-rate-desimal";
const DECIMAL_RATE = 2.55;

const ruleRepo = new ResellerCommissionRuleRepository(
  prismaAuth as never,
  prismaAuth as never,
);
const commissionRepo = new ResellerCommissionRepository(prismaAuth as never);

async function bersihkan() {
  await prismaAuth.resellerCommission.deleteMany({
    where: { resellerId: RESELLER },
  });
  await prismaAuth.resellerCommissionRule.deleteMany({
    where: { resellerId: RESELLER },
  });
  await prismaAuth.reseller.deleteMany({ where: { id: RESELLER } });
  await prismaAuth.tenant.deleteMany({ where: { id: TENANT } });
}

describeDb("Reseller commission rate — Decimal(5,2)", () => {
  beforeEach(async () => {
    await bersihkan();
    await prismaAuth.tenant.create({
      data: { id: TENANT, name: "Tenant Uji Rate" },
    });
    await prismaAuth.reseller.create({
      data: {
        id: RESELLER,
        tenantId: TENANT,
        code: "RSL-UJI-RATE",
        name: "Reseller Uji Rate",
      },
    });
  });

  afterAll(async () => {
    await bersihkan();
  });

  it("menyimpan dan membaca persen desimal sebagai number", async () => {
    const created = await ruleRepo.create({
      tenantId: TENANT,
      resellerId: RESELLER,
      hargaPaketId: null,
      type: "PERCENTAGE",
      rate: DECIMAL_RATE,
      fixedAmount: null,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: null,
    });
    expect(created.rate).toBe(DECIMAL_RATE);

    const active = await commissionRepo.findActiveCommissionRule({
      tenantId: TENANT,
      resellerId: RESELLER,
      hargaPaketId: null,
      at: new Date("2026-07-01T00:00:00.000Z"),
    });
    expect(active?.rate).toBe(DECIMAL_RATE);

    const [listed] = await ruleRepo.listByReseller(TENANT, RESELLER);
    expect(listed?.rate).toBe(DECIMAL_RATE);

    const updated = await ruleRepo.update(created.id, { rate: 12.5 });
    expect(updated.rate).toBe(12.5);

    const commission = await commissionRepo.createCommission({
      tenantId: TENANT,
      resellerId: RESELLER,
      pelangganId: "pelanggan-uji-rate-desimal",
      invoiceId: INVOICE,
      paymentId: null,
      commissionRuleId: created.id,
      type: "PERCENTAGE",
      rate: DECIMAL_RATE,
      baseAmount: 100000,
      commissionAmount: 2550,
      period: "2026-07",
      accruedAt: new Date("2026-07-10T00:00:00.000Z"),
    });
    expect(commission?.rate).toBe(DECIMAL_RATE);

    const reread = await commissionRepo.findCommissionByInvoiceId(
      TENANT,
      INVOICE,
    );
    expect(reread?.rate).toBe(DECIMAL_RATE);
  });
});
