import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { getPphService } from "../../index";
import { getInvestorConfigService } from "@/modules/investor";

const SOURCE = "InvestorPayoutTaxHandler";

export async function handleInvestorPayoutTax(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const payoutId = requirePayloadString(payload.payoutId, "payoutId", SOURCE);
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const investorId = requirePayloadString(
    payload.investorId,
    "investorId",
    SOURCE,
  );
  const amount = requirePayloadString(payload.amount, "amount", SOURCE);
  const completedAt = requirePayloadString(
    payload.completedAt,
    "completedAt",
    SOURCE,
  );

  try {
    const configService = getInvestorConfigService();
    const config = await configService.getConfig(investorId);

    if (!config || !config.isTaxable || !config.taxType) {
      logger.info(
        `[${SOURCE}] Investor ${investorId} tidak kena pajak, skipping`,
      );
      return;
    }

    const taxRate = config.taxRate ? Number(config.taxRate) : undefined;
    const payoutDate = new Date(completedAt);
    const pphService = getPphService();

    if (config.taxType === "PPH_23") {
      await pphService.recordPph23({
        tenantId,
        expenseId: payoutId,
        amount: Number(amount),
        category: "jasa",
        expenseDate: payoutDate,
        customRate: taxRate,
        sourceRefType: "InvestorPayout",
      });
    } else if (config.taxType === "PPH_4_2") {
      await pphService.recordPph4({
        tenantId,
        expenseId: payoutId,
        amount: Number(amount),
        expenseDate: payoutDate,
        customRate: taxRate,
        sourceRefType: "InvestorPayout",
      });
    }

    logger.info(
      `[${SOURCE}] Tax ${config.taxType} recorded for investor payout ${payoutId}`,
    );
  } catch (error) {
    logger.warn(
      `[${SOURCE}] Gagal catat pajak investor payout ${payoutId}: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}
