import { prisma } from "@/lib/prisma";
import {
  InMemoryTaxHistoryProvider,
  type MonthlyTaxRecord,
} from "./TaxHistoryProvider";

/**
 * Loader yang membaca histori PPh21 YTD dari `PayrollEntry` & `PayrollLine`
 * untuk membangun `InMemoryTaxHistoryProvider` yang dikonsumsi engine.
 *
 * Konsumsi:
 *   - Hanya entries dengan PayrollRun.status APPROVED/PAID/CLOSED yang dianggap final.
 *   - grossIncome = totalEarnings (bruto sebelum deduction).
 *   - taxPaid = totalTax (PPh21 yang sudah ditahan).
 *   - biayaJabatan & bpjsEmployee diturunkan dari PayrollLine berdasarkan componentCode.
 *
 * NOTE: Pemisahan ini penting agar koreksi PPh21 Desember dan kalkulasi resign
 * mid-year benar — tanpa loader ini, calculate akan menganggap YTD = 0.
 */
const BIAYA_JABATAN_CODES = ["BIAYA_JABATAN", "TAX_DEDUCTION_BIAYA_JABATAN"];

const BPJS_EMPLOYEE_CODES = ["BPJS_KES_EE", "BPJS_JHT_EE", "BPJS_JP_EE"];

export class PrismaTaxHistoryLoader {
  /**
   * Load semua MonthlyTaxRecord untuk satu user dalam satu tahun pajak.
   * Dipakai sebelum kalkulasi payroll untuk menghasilkan history yang akurat.
   */
  async loadByUser(
    tenantId: string,
    userId: string,
    year: number,
  ): Promise<MonthlyTaxRecord[]> {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const entries = await prisma.payrollEntry.findMany({
      where: {
        tenantId,
        userId,
        payrollRun: {
          status: { in: ["APPROVED", "PAID", "CLOSED"] },
          periodStart: { gte: yearStart, lte: yearEnd },
        },
      },
      select: {
        totalEarnings: true,
        totalTax: true,
        payrollRun: {
          select: { periodStart: true },
        },
        lines: {
          select: { componentCode: true, amount: true },
        },
      },
    });

    return entries.map((entry) => {
      const periodStart = entry.payrollRun.periodStart;
      let biayaJabatan = 0;
      let bpjsEmployee = 0;

      for (const line of entry.lines) {
        if (BIAYA_JABATAN_CODES.includes(line.componentCode)) {
          biayaJabatan += line.amount;
        } else if (BPJS_EMPLOYEE_CODES.includes(line.componentCode)) {
          bpjsEmployee += line.amount;
        }
      }

      return {
        userId,
        year: periodStart.getUTCFullYear(),
        month: periodStart.getUTCMonth() + 1,
        grossIncome: entry.totalEarnings,
        taxPaid: entry.totalTax,
        biayaJabatan,
        bpjsEmployee,
      };
    });
  }

  /**
   * Bangun InMemoryTaxHistoryProvider yang sudah berisi data YTD untuk user-user terkait.
   * Pakai ini sebelum kalkulasi run agar engine bisa konsumsi data history secara sync.
   */
  async buildProvider(
    tenantId: string,
    userIds: string[],
    year: number,
  ): Promise<InMemoryTaxHistoryProvider> {
    if (userIds.length === 0) {
      return new InMemoryTaxHistoryProvider([]);
    }

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const entries = await prisma.payrollEntry.findMany({
      where: {
        tenantId,
        userId: { in: userIds },
        payrollRun: {
          status: { in: ["APPROVED", "PAID", "CLOSED"] },
          periodStart: { gte: yearStart, lte: yearEnd },
        },
      },
      select: {
        userId: true,
        totalEarnings: true,
        totalTax: true,
        payrollRun: { select: { periodStart: true } },
        lines: { select: { componentCode: true, amount: true } },
      },
    });

    const records: MonthlyTaxRecord[] = entries.map((entry) => {
      const periodStart = entry.payrollRun.periodStart;
      let biayaJabatan = 0;
      let bpjsEmployee = 0;
      for (const line of entry.lines) {
        if (BIAYA_JABATAN_CODES.includes(line.componentCode)) {
          biayaJabatan += line.amount;
        } else if (BPJS_EMPLOYEE_CODES.includes(line.componentCode)) {
          bpjsEmployee += line.amount;
        }
      }
      return {
        userId: entry.userId,
        year: periodStart.getUTCFullYear(),
        month: periodStart.getUTCMonth() + 1,
        grossIncome: entry.totalEarnings,
        taxPaid: entry.totalTax,
        biayaJabatan,
        bpjsEmployee,
      };
    });

    return new InMemoryTaxHistoryProvider(records);
  }
}
