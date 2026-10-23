import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

/** Data pembuatan payout investor. */
export interface InvestorPayoutCreateData {
  investorId: string;
  amount: bigint;
  date: Date;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  reference?: string;
  notes?: string;
  status: string;
}

/** Akses data payout (pembayaran) ke investor. */
export class InvestorPayoutRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /** Payout investor terbaru lebih dulu, terpaging. */
  async findManyByInvestor(options: { investorId: string; skip: number; take: number }) {
    return this.client.investorPayout.findMany({
      where: { investorId: options.investorId },
      orderBy: { date: "desc" },
      skip: options.skip,
      take: options.take,
    });
  }

  /** Jumlah seluruh payout investor. */
  async countByInvestor(investorId: string) {
    return this.client.investorPayout.count({ where: { investorId } });
  }

  /** Membuat payout investor baru. */
  async create(data: InvestorPayoutCreateData) {
    return this.client.investorPayout.create({
      data,
    });
  }
}
