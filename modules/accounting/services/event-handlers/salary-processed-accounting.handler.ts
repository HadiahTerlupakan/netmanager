import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { Money } from "../../Money";
import { JournalPostingService } from "../journal/JournalPostingService";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { PeriodService } from "../period/PeriodService";
import { resolveSalaryProcessedCoa } from "./coa-resolver";
import { CoaNotFoundError } from "../../errors";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";

const SOURCE = "SalaryProcessedAccountingHandler";

function parseMoneyOrZero(value: string | undefined, label: string): Money {
  if (!value) return Money.zero();
  try {
    const m = Money.fromString(value);
    if (m.isNegative()) {
      logger.warn(`[${SOURCE}] ${label} negatif (${value}), dianggap 0`);
      return Money.zero();
    }
    return m;
  } catch {
    logger.warn(`[${SOURCE}] ${label} tidak valid: ${value}, dianggap 0`);
    return Money.zero();
  }
}

/**
 * Handles SALARY_PROCESSED event to create payroll journal.
 *
 * Konsep bisnis (jurnal lengkap):
 *   DR Beban Gaji (5-100)        = grossSalary (komponen earning untuk karyawan)
 *   DR Beban BPJS (5-110)        = bpjsEmployer (kontribusi perusahaan)
 *   CR Utang BPJS (2-360)        = bpjsEmployee + bpjsEmployer
 *   CR Utang PPh 21 (2-400)      = pph21Amount
 *   CR Piutang Karyawan (1-150)  = advanceDeducted (kasbon yang dipotong)
 *   CR Utang Gaji (2-350)        = netSalary (gaji bersih yang dibayar)
 *
 * Total DR = grossSalary + bpjsEmployer
 * Total CR = bpjsTotal + pph21 + advanceDeducted + netSalary
 *
 * Identitas: netSalary = grossSalary - bpjsEmployee - advanceDeducted - pph21 - otherDeductions
 *           ⇒ DR seimbang dengan CR
 *
 * Tax module hanya membuat TaxTransaction record (tanpa journal)
 * agar tidak terjadi double-posting ke Beban Gaji.
 */
export async function handleSalaryProcessedAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const salaryId = requirePayloadString(payload.salaryId, "salaryId", SOURCE);
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const grossSalaryStr = requirePayloadString(
    payload.grossSalary,
    "grossSalary",
    SOURCE,
  );
  const pph21AmountStr = requirePayloadString(
    payload.pph21Amount,
    "pph21Amount",
    SOURCE,
  );
  const processedAt = requirePayloadString(
    payload.processedAt,
    "processedAt",
    SOURCE,
  );

  const grossSalary = parseMoneyOrZero(grossSalaryStr, "grossSalary");
  if (grossSalary.isZero()) {
    logger.warn(
      `[${SOURCE}] grossSalary nol untuk entry ${salaryId}, skipping`,
    );
    return;
  }

  const pph21 = parseMoneyOrZero(pph21AmountStr, "pph21Amount");
  const bpjsEmployee = parseMoneyOrZero(
    payload.bpjsEmployee as string | undefined,
    "bpjsEmployee",
  );
  const bpjsEmployer = parseMoneyOrZero(
    payload.bpjsEmployer as string | undefined,
    "bpjsEmployer",
  );
  const advanceDeducted = parseMoneyOrZero(
    payload.advanceDeducted as string | undefined,
    "advanceDeducted",
  );

  // netSalary lebih akurat dari payload jika ada; fallback hitung dari komponen
  let netSalary: Money;
  const netFromPayload = payload.netSalary as string | undefined;
  if (netFromPayload) {
    netSalary = parseMoneyOrZero(netFromPayload, "netSalary");
  } else {
    netSalary = grossSalary
      .subtract(bpjsEmployee)
      .subtract(advanceDeducted)
      .subtract(pph21);
  }

  if (netSalary.isNegative()) {
    logger.warn(
      `[${SOURCE}] netSalary negatif untuk entry ${salaryId} (gross=${grossSalary.toString()}, deductions+pph melebihi); skipping journal`,
    );
    return;
  }

  if (pph21.isNegative()) {
    logger.warn(`[${SOURCE}] pph21 negatif untuk entry ${salaryId}, skipping`);
    return;
  }

  const bpjsTotal = bpjsEmployee.add(bpjsEmployer);

  try {
    const journalRepo = new JournalRepository();
    const coaRepo = new ChartOfAccountRepository();
    const periodRepo = new PeriodRepository();
    const numberGen = new JournalNumberGenerator(journalRepo);
    const postingService = new JournalPostingService(
      journalRepo,
      coaRepo,
      periodRepo,
      numberGen,
    );

    const periodService = new PeriodService(periodRepo);
    const entryDate = new Date(processedAt);
    await periodService.ensureCurrentPeriod(tenantId, entryDate);

    const {
      bebanGajiCoaId,
      bebanBpjsCoaId,
      utangGajiCoaId,
      utangPph21CoaId,
      utangBpjsCoaId,
      piutangKaryawanCoaId,
    } = await resolveSalaryProcessedCoa(tenantId);

    const lines: JournalLineDraft[] = [
      {
        coaId: bebanGajiCoaId,
        side: "DEBIT",
        amount: grossSalary.toString(),
      },
    ];

    if (!bpjsEmployer.isZero()) {
      lines.push({
        coaId: bebanBpjsCoaId,
        side: "DEBIT",
        amount: bpjsEmployer.toString(),
      });
    }

    if (!bpjsTotal.isZero()) {
      lines.push({
        coaId: utangBpjsCoaId,
        side: "CREDIT",
        amount: bpjsTotal.toString(),
      });
    }

    if (!pph21.isZero()) {
      lines.push({
        coaId: utangPph21CoaId,
        side: "CREDIT",
        amount: pph21.toString(),
      });
    }

    if (!advanceDeducted.isZero()) {
      lines.push({
        coaId: piutangKaryawanCoaId,
        side: "CREDIT",
        amount: advanceDeducted.toString(),
      });
    }

    if (!netSalary.isZero()) {
      lines.push({
        coaId: utangGajiCoaId,
        side: "CREDIT",
        amount: netSalary.toString(),
      });
    }

    await postingService.postAuto(tenantId, {
      source: "AUTO_SALARY",
      sourceRefType: "PayrollEntry",
      sourceRefId: salaryId,
      entryDate,
      description: `Jurnal otomatis: Beban gaji karyawan (entry ${salaryId})`,
      postedBy: payload.triggeredBy as string | undefined,
      lines,
    });

    // Mark advance lifecycle: SalaryAdvance.remainingAmount sudah di-update
    // oleh AdvancePostPayrollService di salary module saat run PAID.
    // Di sini journal saja yang dibuat (CR Piutang Karyawan).
    if (!advanceDeducted.isZero()) {
      logger.info(
        `[${SOURCE}] Recorded advance deduction Rp ${advanceDeducted.toString()} for entry ${salaryId}`,
      );
    }

    logger.info(
      `[${SOURCE}] Journal posted for salary entry ${salaryId} (gross=${grossSalary.toString()}, net=${netSalary.toString()}, bpjs=${bpjsTotal.toString()}, pph21=${pph21.toString()}, advance=${advanceDeducted.toString()})`,
    );
  } catch (error) {
    if (error instanceof CoaNotFoundError) {
      logger.warn(
        `[${SOURCE}] COA belum di-seed untuk tenant ${tenantId}, skipping: ${error.message}`,
      );
      return;
    }
    throw error;
  }
}
