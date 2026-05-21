/**
 * Salary V2 Data Migration Script
 *
 * Migrates data from old salary tables (Salary, SalaryComponent, SalaryDetail, UserSalaryComponent)
 * to new V2 tables (PayrollRunV2, PayrollEntryV2, PayrollLineV2, PayrollComponentV2, etc.)
 *
 * Usage: npx tsx modules/salary-v2/migration/migrate-salary-data.ts
 *
 * This script is idempotent — running it multiple times won't create duplicates.
 */

import { prisma } from "@/lib/prisma";

interface MigrationStats {
  componentsCreated: number;
  profilesCreated: number;
  runsCreated: number;
  entriesCreated: number;
  linesCreated: number;
  errors: string[];
}

export async function migrateSalaryData(
  tenantId: string,
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    componentsCreated: 0,
    profilesCreated: 0,
    runsCreated: 0,
    entriesCreated: 0,
    linesCreated: 0,
    errors: [],
  };

  console.log(
    `[Migration] Starting salary data migration for tenant: ${tenantId}`,
  );

  try {
    await migrateComponents(tenantId, stats);
    await migrateProfiles(tenantId, stats);
    await migrateSalaryRecords(tenantId, stats);
  } catch (error) {
    stats.errors.push(
      `Fatal error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  console.log(`[Migration] Complete. Stats:`, stats);
  return stats;
}

async function migrateComponents(
  tenantId: string,
  stats: MigrationStats,
): Promise<void> {
  const oldComponents = await prisma.salaryComponent.findMany({
    where: { tenantId },
  });

  for (const comp of oldComponents) {
    const existing = await prisma.payrollComponentV2.findFirst({
      where: { tenantId, code: comp.name.toUpperCase().replace(/\s+/g, "_") },
    });

    if (existing) continue;

    try {
      await prisma.payrollComponentV2.create({
        data: {
          tenantId,
          name: comp.name,
          code: comp.name.toUpperCase().replace(/\s+/g, "_"),
          category: comp.type === "EARNING" ? "EARNING" : "DEDUCTION",
          calculationType:
            comp.rateType === "FIXED"
              ? "FIXED"
              : comp.rateType === "PERCENTAGE"
                ? "PERCENTAGE"
                : "FIXED",
          taxable: true,
          applicableTo: ["PKWTT", "PKWT"],
          isStatutory: false,
          formula: null,
          defaultAmount: comp.defaultAmount,
          sortOrder: comp.sortOrder ?? 0,
          isActive: comp.isActive,
          description: comp.description,
        },
      });
      stats.componentsCreated++;
    } catch (error) {
      stats.errors.push(
        `Component "${comp.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log(`[Migration] Components migrated: ${stats.componentsCreated}`);
}

async function migrateProfiles(
  tenantId: string,
  stats: MigrationStats,
): Promise<void> {
  const users = await prisma.user.findMany({
    where: { tenantId, isActive: true, basicSalary: { not: null } },
    select: { id: true, basicSalary: true, ptkpStatus: true, joinDate: true },
  });

  for (const user of users) {
    const existing = await prisma.employeePayrollProfileV2.findFirst({
      where: { userId: user.id, tenantId },
    });

    if (existing) continue;

    // Find or create default schedule
    let schedule = await prisma.payScheduleV2.findFirst({
      where: { tenantId, isDefault: true },
    });
    if (!schedule) {
      schedule = await prisma.payScheduleV2.create({
        data: {
          tenantId,
          name: "Bulanan Standar",
          frequency: "MONTHLY",
          cutOffDay: 25,
          payDay: 28,
          gracePeriodDays: 3,
          isDefault: true,
          isActive: true,
        },
      });
    }

    try {
      await prisma.employeePayrollProfileV2.create({
        data: {
          userId: user.id,
          tenantId,
          employeeType: "PKWTT",
          taxMethod: "NET",
          payScheduleId: schedule.id,
          basicSalary: user.basicSalary ?? 0,
          payPeriodDay: 25,
          ptkpStatus: user.ptkpStatus ?? "TK_0",
          npwp: null,
          bpjsKesehatan: true,
          bpjsJht: true,
          bpjsJp: true,
          bpjsJkk: true,
          bpjsJkm: true,
          regionCode: "ID-JK",
          contractStart: user.joinDate ?? new Date(),
          overtimeEligible: true,
          thrEligible: true,
          isActive: true,
        },
      });
      stats.profilesCreated++;
    } catch (error) {
      stats.errors.push(
        `Profile user "${user.id}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log(`[Migration] Profiles migrated: ${stats.profilesCreated}`);
}

async function migrateSalaryRecords(
  tenantId: string,
  stats: MigrationStats,
): Promise<void> {
  const oldSalaries = await prisma.salary.findMany({
    where: { tenantId, status: { in: ["APPROVED", "PAID"] } },
    include: { details: true },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  // Group by month/year to create PayrollRuns
  const grouped = new Map<string, typeof oldSalaries>();
  for (const salary of oldSalaries) {
    const key = `${salary.year}-${salary.month}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(salary);
  }

  // Find default schedule
  const schedule = await prisma.payScheduleV2.findFirst({
    where: { tenantId, isDefault: true },
  });
  if (!schedule) {
    stats.errors.push(
      "No default schedule found — cannot migrate salary records",
    );
    return;
  }

  for (const [key, salaries] of grouped) {
    const [year, month] = key.split("-").map(Number);
    const periodStart = new Date(year, month - 2, 26);
    const periodEnd = new Date(year, month - 1, 25);
    const payDate = new Date(year, month - 1, 28);

    // Check if run already exists
    const existingRun = await prisma.payrollRunV2.findFirst({
      where: { tenantId, scheduleId: schedule.id, periodStart, periodEnd },
    });
    if (existingRun) continue;

    try {
      const totalNet = salaries.reduce((sum, s) => sum + (s.netSalary ?? 0), 0);

      const run = await prisma.payrollRunV2.create({
        data: {
          tenantId,
          scheduleId: schedule.id,
          type: "REGULAR",
          status: "CLOSED",
          periodStart,
          periodEnd,
          payDate,
          totalEntries: salaries.length,
          totalNetSalary: totalNet,
          totalEmployerCost: 0,
          createdBy:
            salaries[0]?.approvedById ?? salaries[0]?.userId ?? "system",
        },
      });
      stats.runsCreated++;

      for (const salary of salaries) {
        const entry = await prisma.payrollEntryV2.create({
          data: {
            payrollRunId: run.id,
            tenantId,
            userId: salary.userId,
            employeeType: "PKWTT",
            taxMethod: "NET",
            basicSalary: salary.basicSalary ?? 0,
            effectiveSalary: salary.basicSalary ?? 0,
            totalEarnings: salary.totalEarnings ?? 0,
            totalDeductions: salary.totalDeductions ?? 0,
            totalTax: 0,
            netSalary: salary.netSalary ?? 0,
            employerCost: 0,
            status: "PAID",
            calculatedAt: salary.createdAt,
          },
        });
        stats.entriesCreated++;

        // Migrate salary details as lines
        for (const detail of salary.details) {
          await prisma.payrollLineV2.create({
            data: {
              entryId: entry.id,
              tenantId,
              componentCode: detail.componentId ? "CUSTOM" : "BASIC_SALARY",
              componentName: detail.componentId ? "Komponen" : "Gaji Pokok",
              category: (detail.amount ?? 0) >= 0 ? "EARNING" : "DEDUCTION",
              quantity: detail.quantity ?? 1,
              rate: detail.rate ?? 0,
              amount: Math.abs(detail.amount ?? 0),
              sortOrder: 0,
            },
          });
          stats.linesCreated++;
        }
      }
    } catch (error) {
      stats.errors.push(
        `Run ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log(
    `[Migration] Runs: ${stats.runsCreated}, Entries: ${stats.entriesCreated}, Lines: ${stats.linesCreated}`,
  );
}

// CLI entry point
if (require.main === module) {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error(
      "Usage: npx tsx modules/salary-v2/migration/migrate-salary-data.ts <tenantId>",
    );
    process.exit(1);
  }
  migrateSalaryData(tenantId)
    .then((stats) => {
      if (stats.errors.length > 0) {
        console.error(
          `[Migration] Completed with ${stats.errors.length} errors`,
        );
        process.exit(1);
      }
      console.log("[Migration] Success!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Migration] Fatal:", err);
      process.exit(1);
    });
}
