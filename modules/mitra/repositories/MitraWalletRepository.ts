import { prismaMitra } from "@/lib/prisma-mitra";
import { MitraTransactionType, Prisma } from "@prisma/client-mitra";

export type EarningReferenceType = "WORK_ORDER" | "CANVASING";

type WalletTransactionPage = {
  transactions: Array<Record<string, unknown>>;
  total: number;
  page: number;
  totalPages: number;
};

type WalletSummary = {
  balance: Prisma.Decimal;
  totalEarnings: Prisma.Decimal;
  totalWithdrawn: Prisma.Decimal;
  earningsThisMonth: Prisma.Decimal | number;
  earningsCount: number;
};

export class MitraWalletRepository {
  /** Mengambil wallet mitra berdasarkan user dan tenant opsional. */
  async findWalletByUserId(mitraId: string, tenantId?: string) {
    return prismaMitra.mitraWallet.findFirst({
      where: {
        mitraId,
        ...(tenantId && { mitra: { tenantId } }),
      },
    });
  }

  /** Mengambil tipe mitra sederhana untuk validasi pembuatan wallet otomatis. */
  async findMitraTypeById(mitraId: string, tenantId?: string) {
    return prismaMitra.mitra.findFirst({
      where: {
        id: mitraId,
        ...(tenantId && { tenantId }),
      },
      select: { mitraType: true },
    });
  }

  /** Membuat wallet kosong untuk mitra. */
  async createWallet(mitraId: string) {
    return prismaMitra.mitraWallet.create({
      data: { mitraId },
    });
  }

  /** Menambahkan pendapatan dan memperbarui saldo wallet secara atomik. */
  async addEarning(params: {
    userId: string;
    amount: number;
    description: string;
    referenceId?: string;
    referenceType?: EarningReferenceType;
  }) {
    await prismaMitra.$transaction(async (tx) => {
      const wallet = await this.findOrCreateWalletTx(tx, params.userId);

      await this.assertNoDuplicateEarningTx(tx, {
        walletId: wallet.id,
        referenceId: params.referenceId,
      });

      await tx.mitraTransaction.create({
        data: {
          walletId: wallet.id,
          amount: params.amount,
          type: MitraTransactionType.EARNING,
          description: params.description,
          referenceId: params.referenceId,
          referenceType: params.referenceType,
        },
      });

      await tx.mitraWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: params.amount },
          totalEarnings: { increment: params.amount },
        },
      });
    });
  }

  /** Mencatat penalti dan mengurangi saldo wallet secara atomik. */
  async deductBalance(params: {
    userId: string;
    amount: number;
    description: string;
    referenceId?: string;
    referenceType?: EarningReferenceType;
  }) {
    await prismaMitra.$transaction(async (tx) => {
      const wallet = await this.findOrCreateWalletTx(tx, params.userId);

      await this.assertNoDuplicatePenaltyTx(tx, {
        walletId: wallet.id,
        referenceId: params.referenceId,
      });

      await tx.mitraTransaction.create({
        data: {
          walletId: wallet.id,
          amount: -params.amount,
          type: MitraTransactionType.ADJUSTMENT,
          description: `[PENALTY] ${params.description}`,
          referenceId: params.referenceId,
          referenceType: params.referenceType,
        },
      });

      await tx.mitraWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: params.amount },
        },
      });
    });
  }

  /** Menambahkan penyesuaian manual admin dan menvalidasi saldo negatif. */
  async addAdjustment(params: {
    userId: string;
    amount: number;
    description: string;
    tenantId?: string;
  }) {
    await prismaMitra.$transaction(async (tx) => {
      const wallet = await tx.mitraWallet.findFirst({
        where: {
          mitraId: params.userId,
          ...(params.tenantId && { mitra: { tenantId: params.tenantId } }),
        },
      });

      if (!wallet) {
        throw new Error("Wallet mitra tidak ditemukan");
      }

      if (params.amount < 0 && wallet.balance.toNumber() + params.amount < 0) {
        throw new Error("Saldo tidak cukup untuk penyesuaian ini");
      }

      await tx.mitraTransaction.create({
        data: {
          walletId: wallet.id,
          amount: params.amount,
          type: MitraTransactionType.ADJUSTMENT,
          description: `[Admin] ${params.description}`,
        },
      });

      await tx.mitraWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: params.amount },
          totalEarnings:
            params.amount > 0 ? { increment: params.amount } : undefined,
        },
      });
    });
  }

  /** Mengambil riwayat transaksi wallet dengan paginasi. */
  async getTransactionsByUserId(
    userId: string,
    tenantId: string | undefined,
    page: number,
    limit: number,
  ): Promise<WalletTransactionPage | null> {
    const wallet = await this.findWalletByUserId(userId, tenantId);
    if (!wallet) {
      return null;
    }

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prismaMitra.mitraTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prismaMitra.mitraTransaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    return {
      transactions: transactions as Array<Record<string, unknown>>,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Mengambil ringkasan pendapatan bulanan wallet mitra. */
  async getEarningsSummaryByUserId(params: {
    userId: string;
    tenantId?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<WalletSummary | null> {
    const wallet = await this.findWalletByUserId(
      params.userId,
      params.tenantId,
    );
    if (!wallet) {
      return null;
    }

    const [monthlyEarnings, monthlyCount] = await Promise.all([
      prismaMitra.mitraTransaction.aggregate({
        where: {
          walletId: wallet.id,
          type: "EARNING",
          createdAt: { gte: params.startDate, lte: params.endDate },
        },
        _sum: { amount: true },
      }),
      prismaMitra.mitraTransaction.count({
        where: {
          walletId: wallet.id,
          type: "EARNING",
          createdAt: { gte: params.startDate, lte: params.endDate },
        },
      }),
    ]);

    return {
      balance: wallet.balance,
      totalEarnings: wallet.totalEarnings,
      totalWithdrawn: wallet.totalWithdrawn,
      earningsThisMonth: monthlyEarnings._sum.amount || 0,
      earningsCount: monthlyCount,
    };
  }

  private async findOrCreateWalletTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const wallet = await tx.mitraWallet.findFirst({
      where: { mitraId: userId },
    });

    if (wallet) {
      return wallet;
    }

    return tx.mitraWallet.create({
      data: { mitraId: userId },
    });
  }

  private async assertNoDuplicateEarningTx(
    tx: Prisma.TransactionClient,
    params: { walletId: string; referenceId?: string },
  ) {
    if (!params.referenceId) {
      return;
    }

    const existing = await tx.mitraTransaction.findFirst({
      where: {
        walletId: params.walletId,
        referenceId: params.referenceId,
        type: "EARNING",
      },
    });

    if (existing) {
      throw new Error("Transaksi sudah ada untuk referensi ini");
    }
  }

  private async assertNoDuplicatePenaltyTx(
    tx: Prisma.TransactionClient,
    params: { walletId: string; referenceId?: string },
  ) {
    if (!params.referenceId) {
      return;
    }

    const existing = await tx.mitraTransaction.findFirst({
      where: {
        walletId: params.walletId,
        referenceId: params.referenceId,
        type: "ADJUSTMENT",
        description: { contains: "[PENALTY]" },
      },
    });

    if (existing) {
      throw new Error("Transaksi penalti sudah ada untuk referensi ini");
    }
  }
}

let instance: MitraWalletRepository | null = null;

export function getMitraWalletRepository() {
  if (!instance) {
    instance = new MitraWalletRepository();
  }

  return instance;
}
