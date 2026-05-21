import { InvestorProfitShareRepository } from "../repositories/InvestorProfitShareRepository";
import { InvestorConfigRepository } from "../repositories/InvestorConfigRepository";
import { InvestorDepositRepository } from "../repositories/InvestorDepositRepository";

export class InvestorProfitShareService {
  constructor(
    private readonly profitShareRepo: InvestorProfitShareRepository = new InvestorProfitShareRepository(),
    private readonly configRepo: InvestorConfigRepository = new InvestorConfigRepository(),
    private readonly depositRepo: InvestorDepositRepository = new InvestorDepositRepository(),
  ) {}

  /**
   * Menghitung bagi hasil untuk semua investor aktif dalam periode tertentu.
   * Mode FIXED: gunakan fixedSharePercent dari config.
   * Mode PROPORTIONAL: hitung berdasarkan proporsi deposit terhadap total.
   */
  async calculateForPeriod(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    netProfit: number,
  ) {
    const configs = await this.configRepo.listActive(tenantId);
    if (configs.length === 0) return [];

    const totalDeposits = await this.depositRepo.sumCompletedAll(tenantId);

    const results = await Promise.all(
      configs.map(async (config) => {
        let sharePercent: number;

        if (config.shareMode === "FIXED") {
          sharePercent = config.fixedSharePercent ?? 0;
        } else {
          // PROPORTIONAL: berdasarkan proporsi deposit investor
          const investorDeposit = await this.depositRepo.sumCompletedByInvestor(
            config.investorId,
          );
          sharePercent =
            totalDeposits > 0 ? (investorDeposit / totalDeposits) * 100 : 0;
        }

        const shareAmount = (netProfit * sharePercent) / 100;

        return this.profitShareRepo.create({
          investorId: config.investorId,
          configId: config.id,
          periodStart,
          periodEnd,
          netProfit,
          sharePercent: Math.round(sharePercent * 100) / 100,
          shareAmount: Math.round(shareAmount * 100) / 100,
          tenantId,
        });
      }),
    );

    return results;
  }

  /** Approve profit share: CALCULATED → APPROVED. */
  async approve(id: string, approvedById: string) {
    const record = await this.profitShareRepo.findById(id);
    if (!record) throw new Error("Profit share tidak ditemukan");
    if (record.status !== "CALCULATED") {
      throw new Error(
        `Profit share tidak bisa di-approve, status: ${record.status}`,
      );
    }

    return this.profitShareRepo.updateStatus(id, {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById,
    });
  }

  /** Tandai profit share sebagai dibayar: APPROVED → PAID. */
  async markPaid(id: string, paidById: string, payoutId?: string) {
    const record = await this.profitShareRepo.findById(id);
    if (!record) throw new Error("Profit share tidak ditemukan");
    if (record.status !== "APPROVED") {
      throw new Error(
        `Profit share tidak bisa dibayar, status: ${record.status}`,
      );
    }

    return this.profitShareRepo.updateStatus(id, {
      status: "PAID",
      paidAt: new Date(),
      paidById,
      payoutId,
    });
  }

  /** Mengambil daftar profit share berdasarkan investor. */
  async listByInvestor(investorId: string) {
    return this.profitShareRepo.listByInvestor(investorId);
  }

  /** Mengambil daftar profit share berdasarkan periode. */
  async listByPeriod(tenantId: string, periodStart: Date, periodEnd: Date) {
    return this.profitShareRepo.listByPeriod(tenantId, periodStart, periodEnd);
  }
}
