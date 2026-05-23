import { prisma } from "@/modules/database";

interface PowerRecord {
  id: string;
  onuId: string;
  rxPower: number | null;
  txPower: number | null;
  recordedAt: Date;
}

export class OnuPowerHistoryRepository {
  async record(input: {
    tenantId: string;
    onuId: string;
    rxPower: number | null;
    txPower: number | null;
  }): Promise<void> {
    await prisma.onuPowerHistory.create({
      data: {
        tenantId: input.tenantId,
        onuId: input.onuId,
        rxPower: input.rxPower,
        txPower: input.txPower,
      },
    });
  }

  async getHistory(
    onuId: string,
    tenantId: string,
    hours: number = 24,
  ): Promise<PowerRecord[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const records = await prisma.onuPowerHistory.findMany({
      where: { onuId, tenantId, recordedAt: { gte: since } },
      orderBy: { recordedAt: "asc" },
    });
    return records as PowerRecord[];
  }

  async cleanup(olderThanDays: number = 7): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await prisma.onuPowerHistory.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });
    return result.count;
  }
}
