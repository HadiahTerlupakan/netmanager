import { prisma } from "@/lib/prisma";
import type { ProductionRelease } from "../services/mobile-version-policy";

/** Rilis produksi Play Store yang pernah terlihat; global, tanpa tenant. */
export class PlayStoreReleaseRepository {
  async findAll(): Promise<ProductionRelease[]> {
    return prisma.playStoreRelease.findMany({
      select: {
        versionCode: true,
        versionName: true,
        firstSeenAt: true,
        cancelledAt: true,
      },
      orderBy: { versionCode: "desc" },
    });
  }

  /** Catat rilis yang baru terlihat; rilis yang sudah ada tidak diubah. */
  async recordSeen(input: {
    versionCode: number;
    versionName: string | null;
  }): Promise<boolean> {
    const result = await prisma.playStoreRelease.createMany({
      data: [input],
      skipDuplicates: true,
    });
    return result.count > 0;
  }

  async setCancelled(input: {
    versionCode: number;
    cancelledAt: Date | null;
    cancelledById: string | null;
  }): Promise<boolean> {
    const result = await prisma.playStoreRelease.updateMany({
      where: { versionCode: input.versionCode },
      data: {
        cancelledAt: input.cancelledAt,
        cancelledById: input.cancelledById,
      },
    });
    return result.count > 0;
  }
}
