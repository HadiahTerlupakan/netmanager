import { logger } from "@/lib/logger";
import type { TaxConfig, TaxType } from "../domain/entities/TaxConfig";
import type { TaxPeriodSummary } from "../domain/entities/TaxPeriod";
import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";
import type { ITaxPeriodRepository } from "../domain/ports/ITaxPeriodRepository";

/**
 * Handles tax payment deadline monitoring and penalty calculation.
 * Called by daily cron to check all tenants for overdue tax payments.
 */
export class TaxReminderService {
  constructor(
    private readonly taxConfigRepo: ITaxConfigRepository,
    private readonly periodRepo: ITaxPeriodRepository,
  ) {}

  /** Check all tenants for due reminders. Called by daily cron. */
  async checkAndSendReminders(): Promise<{ sent: number; penalties: number }> {
    const tenantIds = await this.taxConfigRepo.findAllTenantIds();
    let sent = 0;
    let penalties = 0;

    for (const tenantId of tenantIds) {
      const config = await this.taxConfigRepo.findByTenantId(tenantId);
      if (!config) continue;

      // Tax obligations are for the previous month
      const now = new Date();
      const targetMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // previous month (1-12)
      const targetYear =
        now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      const summary = await this.periodRepo.findByPeriod(
        tenantId,
        targetYear,
        targetMonth,
      );
      if (!summary) continue;

      const result = await this.processTenantReminders(
        tenantId,
        config,
        summary,
        targetYear,
        targetMonth,
        now,
      );
      sent += result.sent;
      penalties += result.penalties;
    }

    return { sent, penalties };
  }

  /** Calculate penalty for late payment */
  calculatePenalty(
    taxType: TaxType,
    amount: number,
    monthsLate: number,
  ): number {
    if (monthsLate <= 0 || amount <= 0) return 0;

    switch (taxType) {
      case "PPN_KELUARAN":
      case "PPN_MASUKAN":
        // PPN: 1% per month
        return amount * 0.01 * monthsLate;
      case "PPH_21":
      case "PPH_23":
      case "PPH_4_2":
        // PPh: 2% per month, max 24 months
        return amount * 0.02 * Math.min(monthsLate, 24);
      case "BHP":
      case "USO":
        // BHP/USO: 2% per month, max 24 months
        return amount * 0.02 * Math.min(monthsLate, 24);
      default:
        return 0;
    }
  }

  /** Process reminders for a single tenant */
  private async processTenantReminders(
    tenantId: string,
    config: TaxConfig,
    summary: TaxPeriodSummary,
    year: number,
    month: number,
    now: Date,
  ): Promise<{ sent: number; penalties: number }> {
    let sent = 0;
    let penalties = 0;

    const checks = this.buildTaxChecks(config, summary, year, month);

    for (const check of checks) {
      if (check.status !== "BELUM_SETOR") continue;

      const dueDate = check.dueDate;
      const warningDate = new Date(dueDate);
      warningDate.setDate(warningDate.getDate() - 7);

      if (now >= dueDate) {
        // Overdue — mark as TERLAMBAT and calculate penalty
        const monthsLate = this.calculateMonthsLate(dueDate, now);
        const penalty = this.calculatePenalty(
          check.taxType,
          check.amount,
          monthsLate,
        );

        await this.periodRepo.upsert(tenantId, year, month, {
          [check.statusField]: "TERLAMBAT",
          [check.penaltyField]: penalty,
        } as Partial<TaxPeriodSummary>);

        logger.warn("Tax payment overdue", {
          tenantId,
          taxType: check.taxType,
          year,
          month,
          monthsLate,
          penalty,
        });

        penalties++;
      } else if (now >= warningDate) {
        // Warning period — log reminder
        // TODO: Integrate with notification module when TAX notification type is added
        logger.info("Tax payment due soon", {
          tenantId,
          taxType: check.taxType,
          year,
          month,
          dueDate: dueDate.toISOString(),
        });

        sent++;
      }
    }

    return { sent, penalties };
  }

  /** Build list of tax type checks with their due dates and amounts */
  private buildTaxChecks(
    config: TaxConfig,
    summary: TaxPeriodSummary,
    year: number,
    month: number,
  ): TaxCheck[] {
    // Due dates are in the month AFTER the tax period
    const dueYear = month === 12 ? year + 1 : year;
    const dueMonth = month === 12 ? 1 : month + 1;

    return [
      {
        taxType: "PPN_KELUARAN" as TaxType,
        status: summary.ppnStatus,
        statusField: "ppnStatus",
        penaltyField: "ppnPenalty",
        amount: summary.ppnKurangBayar,
        dueDate: new Date(dueYear, dueMonth - 1, config.ppnDueDay),
      },
      {
        taxType: "PPH_21" as TaxType,
        status: summary.pph21Status,
        statusField: "pph21Status",
        penaltyField: "pph21Penalty",
        amount: summary.pph21Total,
        dueDate: new Date(dueYear, dueMonth - 1, config.pph21DueDay),
      },
      {
        taxType: "PPH_23" as TaxType,
        status: summary.pph23Status,
        statusField: "pph23Status",
        penaltyField: "pph23Penalty",
        amount: summary.pph23Total,
        dueDate: new Date(dueYear, dueMonth - 1, config.pph23DueDay),
      },
      {
        taxType: "PPH_4_2" as TaxType,
        status: summary.pph4Status,
        statusField: "pph4Status",
        penaltyField: "pph23Penalty", // PPh 4(2) shares penalty tracking with PPh 23 in schema
        amount: summary.pph4Total,
        dueDate: new Date(dueYear, dueMonth - 1, config.pph23DueDay),
      },
      {
        taxType: "BHP" as TaxType,
        status: summary.bhpStatus,
        statusField: "bhpStatus",
        penaltyField: "ppnPenalty", // BHP doesn't have dedicated penalty field; use ppnPenalty as placeholder
        amount: summary.bhpAccrual + summary.usoAccrual,
        dueDate: new Date(year, config.bhpDueMonth - 1, 15), // BHP annual, due in configured month
      },
    ];
  }

  /** Calculate how many months late a payment is */
  private calculateMonthsLate(dueDate: Date, now: Date): number {
    const diffMs = now.getTime() - dueDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.max(1, Math.ceil(diffDays / 30));
  }
}

interface TaxCheck {
  taxType: TaxType;
  status: string;
  statusField: string;
  penaltyField: string;
  amount: number;
  dueDate: Date;
}
