import { prisma } from "@/lib/prisma";
import { AssetService } from "./AssetService";

/** Service untuk kebutuhan cron penyusutan aset. */
export class DepreciationCronService {
  constructor(
    private readonly assetService: AssetService = new AssetService(),
  ) {}

  /** Jalankan siklus penyusutan bulanan dan kembalikan jumlah aset terproses. */
  async runMonthlyCycle(): Promise<{ processed: number }> {
    const systemUserId = await this.getSystemUserId();
    const results =
      await this.assetService.runMonthlyDepreciationCycle(systemUserId);
    return { processed: results.length };
  }

  private async getSystemUserId(): Promise<string> {
    const systemUser = await this.findSystemUser();
    if (systemUser?.id) {
      return systemUser.id;
    }

    throw new Error(
      "No user found to execute cron job (System requires at least one user)",
    );
  }

  private async findSystemUser() {
    const superAdmin = await prisma.user.findFirst({
      where: { role: { name: "SUPER_ADMIN" } },
      select: { id: true },
    });

    if (superAdmin) {
      return superAdmin;
    }

    return prisma.user.findFirst({ select: { id: true } });
  }
}
