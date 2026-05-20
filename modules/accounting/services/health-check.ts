import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface HealthCheckResult {
  unbalancedEntries: { id: string; entryNumber: string }[];
  staleOutboxEvents: number;
  healthy: boolean;
}

export async function runAccountingHealthCheck(): Promise<HealthCheckResult> {
  const unbalancedEntries = await prisma.$queryRaw<
    { id: string; entryNumber: string }[]
  >`
    SELECT je.id, je."entryNumber"
    FROM journal_entries je
    WHERE je.status = 'POSTED'
    AND (
      SELECT COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)
      FROM journal_lines jl WHERE jl."entryId" = je.id
    ) <> (
      SELECT COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)
      FROM journal_lines jl WHERE jl."entryId" = je.id
    )
    LIMIT 10
  `;

  if (unbalancedEntries.length > 0) {
    logger.error(
      `[accounting-health] Found ${unbalancedEntries.length} unbalanced POSTED entries!`,
    );
  }

  const staleOutboxEvents = await prisma.outboxEvent.count({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
    },
  });
  if (staleOutboxEvents > 0) {
    logger.warn(
      `[accounting-health] ${staleOutboxEvents} outbox events pending > 30 min`,
    );
  }

  const healthy = unbalancedEntries.length === 0 && staleOutboxEvents === 0;
  logger.info(`[accounting-health] Check complete: healthy=${healthy}`);

  return { unbalancedEntries, staleOutboxEvents, healthy };
}
