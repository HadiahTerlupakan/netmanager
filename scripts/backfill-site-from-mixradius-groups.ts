import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { PrismaClient as BillingPrismaClient } from "@prisma/client-billing";
import { Pool } from "pg";

import { logger } from "../lib/logger";
import {
  isApplyMode,
  planSiteBackfill,
  type SiteBackfillPlan,
} from "./backfill-site-from-mixradius-groups-plan";

/**
 * Isi `siteId` Expense dan RAB lama dari tautan site grup owner MixRadius.
 *
 * Form lama menyimpan grup MixRadius dan menurunkan `siteId` dari tautan grup
 * saat disimpan. Row yang dibuat sebelum grupnya ditautkan tetap tanpa site,
 * dan sejak kode berhenti membaca `mixRadiusGroupId` row itu tampil sebagai
 * "Umum" serta lolos dari filter site. Tabel grup ada di DB billing, jadi
 * backfill tidak bisa lewat migration SQL DB app.
 *
 * Wajib dijalankan SEBELUM tabel `mix_radius_*` dan kolom `mixRadius*` di-drop,
 * karena setelah itu tautan grup hilang permanen. Row yang tidak bisa
 * dipetakan dilaporkan untuk dipilihkan site manual di /admin/pengeluaran.
 *
 * Pemakaian:
 *   node node_modules/.bin/tsx scripts/backfill-site-from-mixradius-groups.ts
 *   node node_modules/.bin/tsx scripts/backfill-site-from-mixradius-groups.ts --apply
 *
 * Default dry-run. Idempoten: hanya menyentuh row yang `siteId`-nya masih null.
 */

const LOG_PREFIX = "[BackfillSiteFromMixRadiusGroups]";

function createPool(envName: "DATABASE_URL" | "DATABASE_URL_BILLING") {
  const connectionString = process.env[envName];
  if (!connectionString) {
    throw new Error(`${envName} wajib diisi`);
  }

  return new Pool({ connectionString });
}

const appPool = createPool("DATABASE_URL");
const billingPool = createPool("DATABASE_URL_BILLING");
const app = new PrismaClient({ adapter: new PrismaPg(appPool) });
const billing = new BillingPrismaClient({ adapter: new PrismaPg(billingPool) });

async function loadBackfillPlans() {
  const [groups, sites, expenses, rabProjects] = await Promise.all([
    billing.mixRadiusOwnerGroup.findMany({
      select: { id: true, name: true, siteId: true },
    }),
    app.sites.findMany({ select: { id: true, tenantId: true } }),
    app.expense.findMany({
      where: { siteId: null, mixRadiusGroupId: { not: null } },
      select: {
        id: true,
        date: true,
        amount: true,
        tenantId: true,
        mixRadiusGroupId: true,
      },
      orderBy: { date: "asc" },
    }),
    app.rabProject.findMany({
      where: {
        siteId: null,
        OR: [
          { mixRadiusGroupId: { not: null } },
          { mixRadiusInvestorSiteId: { not: null } },
        ],
      },
      select: { id: true, name: true, tenantId: true, mixRadiusGroupId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const expensePlan = planSiteBackfill({
    groups,
    sites,
    records: expenses.map((expense) => ({
      id: expense.id,
      label: `${expense.date.toISOString().slice(0, 10)} Rp${expense.amount}`,
      tenantId: expense.tenantId,
      mixRadiusGroupId: expense.mixRadiusGroupId,
    })),
  });
  const rabPlan = planSiteBackfill({
    groups,
    sites,
    records: rabProjects.map((project) => ({
      id: project.id,
      label: project.name,
      tenantId: project.tenantId,
      mixRadiusGroupId: project.mixRadiusGroupId,
    })),
  });

  return { expensePlan, rabPlan };
}

function countRecords(plan: SiteBackfillPlan) {
  return plan.assignments.reduce(
    (total, assignment) => total + assignment.recordIds.length,
    0,
  );
}

function reportPlan(entity: string, plan: SiteBackfillPlan) {
  logger.info(
    `${LOG_PREFIX} ${entity}: ${countRecords(plan)} bisa diisi site, ${plan.unmapped.length} perlu dipilih manual`,
  );

  for (const record of plan.unmapped) {
    logger.warn(
      `${LOG_PREFIX} ${entity} ${record.id} (${record.label}) dilewati: ${record.reason}`,
    );
  }
}

async function applyPlans(plans: {
  expensePlan: SiteBackfillPlan;
  rabPlan: SiteBackfillPlan;
}) {
  const expenseUpdates = plans.expensePlan.assignments.map(
    ({ siteId, recordIds }) =>
      app.expense.updateMany({
        where: { id: { in: recordIds }, siteId: null },
        data: { siteId },
      }),
  );
  const rabUpdates = plans.rabPlan.assignments.map(({ siteId, recordIds }) =>
    app.rabProject.updateMany({
      where: { id: { in: recordIds }, siteId: null },
      data: { siteId },
    }),
  );

  const results = await app.$transaction([...expenseUpdates, ...rabUpdates]);
  const sumCounts = (items: typeof results) =>
    items.reduce((total, result) => total + result.count, 0);

  logger.info(
    `${LOG_PREFIX} selesai: ${sumCounts(results.slice(0, expenseUpdates.length))} Expense dan ${sumCounts(results.slice(expenseUpdates.length))} RAB diisi site`,
  );
}

async function backfillSiteFromMixRadiusGroups(apply: boolean) {
  const plans = await loadBackfillPlans();
  reportPlan("Expense", plans.expensePlan);
  reportPlan("RAB", plans.rabPlan);

  if (!apply) {
    logger.info(
      `${LOG_PREFIX} dry-run: tidak ada yang ditulis. Jalankan ulang dengan --apply untuk menyimpan.`,
    );
    return;
  }

  await applyPlans(plans);
}

backfillSiteFromMixRadiusGroups(isApplyMode(process.argv.slice(2)))
  .catch((error) => {
    logger.error(`${LOG_PREFIX} gagal:`, error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([app.$disconnect(), billing.$disconnect()]);
    await Promise.all([appPool.end(), billingPool.end()]);
  });
