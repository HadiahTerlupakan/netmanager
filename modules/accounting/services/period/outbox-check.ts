import { prisma } from "@/lib/prisma";

export async function hasPendingOutboxForPeriod(
  _tenantId: string,
  startDate: Date,
  endDate: Date,
): Promise<boolean> {
  const count = await prisma.outboxEvent.count({
    where: {
      status: "PENDING",
      createdAt: { gte: startDate, lte: endDate },
    },
  });
  return count > 0;
}
