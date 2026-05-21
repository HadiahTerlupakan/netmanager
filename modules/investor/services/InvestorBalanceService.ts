import { InvestorDepositRepository } from "../repositories/InvestorDepositRepository";
import { prisma } from "@/lib/prisma";

export interface InvestorBalance {
  investorId: string;
  totalDeposit: number;
  totalPayout: number;
  activeBalance: number;
  ownershipPercent: number;
}

export class InvestorBalanceService {
  constructor(
    private readonly depositRepo: InvestorDepositRepository = new InvestorDepositRepository(),
  ) {}

  /** Menghitung saldo dan kepemilikan investor. */
  async getBalance(investorId: string): Promise<InvestorBalance> {
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      select: { tenantId: true },
    });
    if (!investor) throw new Error("Investor tidak ditemukan");

    const [totalDeposit, totalPayout, allDeposits] = await Promise.all([
      this.depositRepo.sumCompletedByInvestor(investorId),
      this.sumCompletedPayouts(investorId),
      investor.tenantId
        ? this.depositRepo.sumCompletedAll(investor.tenantId)
        : this.depositRepo.sumCompletedByInvestor(investorId),
    ]);

    const activeBalance = totalDeposit - totalPayout;
    const ownershipPercent =
      allDeposits > 0 ? (totalDeposit / allDeposits) * 100 : 0;

    return {
      investorId,
      totalDeposit,
      totalPayout,
      activeBalance,
      ownershipPercent: Math.round(ownershipPercent * 100) / 100,
    };
  }

  /** Menghitung saldo semua investor dalam tenant. */
  async getAllBalances(tenantId: string): Promise<InvestorBalance[]> {
    const investors = await prisma.investor.findMany({
      where: { tenantId },
      select: { id: true },
    });

    const allDeposits = await this.depositRepo.sumCompletedAll(tenantId);

    const balances = await Promise.all(
      investors.map(async (inv) => {
        const totalDeposit = await this.depositRepo.sumCompletedByInvestor(
          inv.id,
        );
        const totalPayout = await this.sumCompletedPayouts(inv.id);
        const activeBalance = totalDeposit - totalPayout;
        const ownershipPercent =
          allDeposits > 0 ? (totalDeposit / allDeposits) * 100 : 0;

        return {
          investorId: inv.id,
          totalDeposit,
          totalPayout,
          activeBalance,
          ownershipPercent: Math.round(ownershipPercent * 100) / 100,
        };
      }),
    );

    return balances;
  }

  /** Menghitung total payout COMPLETED untuk investor. */
  private async sumCompletedPayouts(investorId: string): Promise<number> {
    const result = await prisma.investorPayout.aggregate({
      where: { investorId, status: "COMPLETED" },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }
}
