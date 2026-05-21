import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { JournalPostingService } from "../journal/JournalPostingService";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { PeriodService } from "../period/PeriodService";
import { resolveCouponUsedCoa } from "./coa-resolver";
import { CoaNotFoundError } from "../../errors";

const SOURCE = "CouponUsedAccountingHandler";

export async function handleCouponUsedAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const couponId = requirePayloadString(payload.couponId, "couponId", SOURCE);
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const discountAmount = payload.discountAmount;
  const appliedAt = payload.appliedAt ?? new Date().toISOString();

  if (!discountAmount || Number(discountAmount) <= 0) {
    logger.warn(`[${SOURCE}] Discount amount is zero or invalid, skipping`);
    return;
  }

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
    const entryDate = new Date(appliedAt);
    await periodService.ensureCurrentPeriod(tenantId, entryDate);

    const { debitCoaId, creditCoaId } = await resolveCouponUsedCoa(tenantId);

    await postingService.postAuto(tenantId, {
      source: "AUTO_COUPON_USED",
      sourceRefType: "Coupon",
      sourceRefId: couponId,
      entryDate,
      description: `Jurnal otomatis: Potongan penjualan kupon ${couponId}`,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount: String(discountAmount) },
        { coaId: creditCoaId, side: "CREDIT", amount: String(discountAmount) },
      ],
    });

    logger.info(`[${SOURCE}] Journal posted for coupon used ${couponId}`);
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
