import { prisma } from "@/lib/prisma";
import { seedDefaultCoa } from "@/modules/accounting/services/coa/seedDefaultCoa";
import { PeriodService } from "@/modules/accounting/services/period/PeriodService";
import { PeriodRepository } from "@/modules/accounting/repositories/PeriodRepository";

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const periodSvc = new PeriodService(new PeriodRepository());
  const now = new Date();

  for (const t of tenants) {
    console.log(`[seed-accounting] tenant=${t.id}`);
    await seedDefaultCoa(t.id);
    await periodSvc.ensureCurrentPeriod(t.id, now);
  }
  console.log("[seed-accounting] done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
