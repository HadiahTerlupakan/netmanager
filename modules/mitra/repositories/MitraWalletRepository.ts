import { prismaMitra } from "@/lib/prisma-mitra";
import { MitraTransactionType, Prisma } from "@prisma/client-mitra";
import type {
  EarningReferenceType,
  IMitraWalletRepository,
  WalletAdjustmentInput,
  WalletMutationInput,
  WalletSummaryQuery,
} from "../domain/ports/IMitraWalletRepository";
import {
  toMitraTransactionEntity,
  toMitraTypeEntity,
  toMitraWalletEntity,
  toWalletSummaryEntity,
} from "../mappers/MitraDomainMapper";

const PENALTY_PREFIX = "[PENALTY]";

export class MitraWalletRepository implements IMitraWalletRepository {
  /** Mengambil wallet mitra berdasarkan user dan tenant opsional. */
  async findWalletByUserId(mitraId: string, tenantId?: string) {
    const wallet = await prismaMitra.mitraWallet.findFirst({
      where: { mitraId, ...(tenantId && { mitra: { tenantId } }) },
    });

    return wallet ? toMitraWalletEntity(wallet) : null;
  }

  /** Mengambil tipe mitra untuk validasi wallet otomatis. */
  async findMitraTypeById(mitraId: string, tenantId?: string) {
    const mitra = await prismaMitra.mitra.findFirst({
      where: { id: mitraId, ...(tenantId && { tenantId }) },
      select: { mitraType: true },
    });

    return mitra ? toMitraTypeEntity(mitra) : null;
  }

  /** Membuat wallet kosong untuk mitra. */
  async createWallet(mitraId: string) {
    const wallet = await prismaMitra.mitraWallet.create({ data: { mitraId } });
    return toMitraWalletEntity(wallet);
  }

  /** Menambahkan pendapatan wallet secara atomik. */
  async addEarning(params: WalletMutationInput) {
    await prismaMitra.$transaction(async (tx) => {
      const wallet = await this.findOrCreateWalletTx(tx, params.userId);
      await this.assertNoDuplicateEarningTx(tx, wallet.id, params.referenceId);
      await tx.mitraTransaction.create({
        data: this.buildEarningTransactionData(wallet.id, params),
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

  /** Mengurangi saldo wallet untuk penalti secara atomik. */
  async deductBalance(params: WalletMutationInput) {
    await prismaMitra.$transaction(async (tx) => {
      const wallet = await this.findOrCreateWalletTx(tx, params.userId);
      await this.assertNoDuplicatePenaltyTx(tx, wallet.id, params.referenceId);
      await tx.mitraTransaction.create({
        data: this.buildPenaltyTransactionData(wallet.id, params),
      });
      await tx.mitraWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: params.amount } },
      });
    });
  }

  /** Menambahkan penyesuaian manual admin ke wallet. */
  async addAdjustment(params: WalletAdjustmentInput) {
    await prismaMitra.$transaction(async (tx) => {
      const wallet = await tx.mitraWallet.findFirst({
        where: {
          mitraId: params.userId,
          ...(params.tenantId && { mitra: { tenantId: params.tenantId } }),
        },
      });
      if (!wallet) throw new Error("Wallet mitra tidak ditemukan");
      this.assertAdjustmentBalance(wallet.balance.toNumber(), params.amount);
      await tx.mitraTransaction.create({
        data: this.buildAdjustmentTransactionData(wallet.id, params),
      });
      await tx.mitraWallet.update({
        where: { id: wallet.id },
        data: this.buildAdjustmentWalletData(params.amount),
      });
    });
  }

  /** Mengambil riwayat transaksi wallet dengan paginasi. */
  async getTransactionsByUserId(
    userId: string,
    tenantId: string | undefined,
    page: number,
    limit: number,
  ) {
    const wallet = await this.findWalletByUserId(userId, tenantId);
    if (!wallet) return null;
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prismaMitra.mitraTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prismaMitra.mitraTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      transactions: transactions.map(toMitraTransactionEntity),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Mengambil ringkasan pendapatan wallet pada periode tertentu. */
  async getEarningsSummaryByUserId(params: WalletSummaryQuery) {
    const wallet = await this.findWalletByUserId(
      params.userId,
      params.tenantId,
    );
    if (!wallet) return null;
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

    return toWalletSummaryEntity({
      balance: new Prisma.Decimal(wallet.balance),
      totalEarnings: new Prisma.Decimal(wallet.totalEarnings),
      totalWithdrawn: new Prisma.Decimal(wallet.totalWithdrawn),
      earningsThisMonth: monthlyEarnings._sum.amount || 0,
      earningsCount: monthlyCount,
    });
  }

  /** Mengecek transaksi komisi duplikat berdasarkan referensi. */
  async findTransactionByReferenceId(referenceId: string) {
    const transaction = await prismaMitra.mitraTransaction.findFirst({
      where: { referenceId },
    });

    return transaction ? toMitraTransactionEntity(transaction) : null;
  }

  /** Menghitung transaksi earning bulanan berdasarkan keyword deskripsi. */
  async countMonthlyEarningsByDescription(params: {
    mitraId: string;
    keyword: string;
    startDate: Date;
  }) {
    return prismaMitra.mitraTransaction.count({
      where: {
        wallet: { mitraId: params.mitraId },
        type: "EARNING",
        description: { contains: params.keyword },
        createdAt: { gte: params.startDate },
      },
    });
  }

  private buildEarningTransactionData(
    walletId: string,
    params: WalletMutationInput,
  ) {
    return {
      walletId,
      amount: params.amount,
      type: MitraTransactionType.EARNING,
      description: params.description,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
    };
  }

  private buildPenaltyTransactionData(
    walletId: string,
    params: WalletMutationInput,
  ) {
    return {
      walletId,
      amount: -params.amount,
      type: MitraTransactionType.ADJUSTMENT,
      description: `${PENALTY_PREFIX} ${params.description}`,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
    };
  }

  private buildAdjustmentTransactionData(
    walletId: string,
    params: WalletAdjustmentInput,
  ) {
    return {
      walletId,
      amount: params.amount,
      type: MitraTransactionType.ADJUSTMENT,
      description: `[Admin] ${params.description}`,
    };
  }

  private buildAdjustmentWalletData(amount: number) {
    return {
      balance: { increment: amount },
      totalEarnings: amount > 0 ? { increment: amount } : undefined,
    };
  }

  private assertAdjustmentBalance(currentBalance: number, amount: number) {
    if (amount < 0 && currentBalance + amount < 0) {
      throw new Error("Saldo tidak cukup untuk penyesuaian ini");
    }
  }

  private async findOrCreateWalletTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const wallet = await tx.mitraWallet.findFirst({
      where: { mitraId: userId },
    });
    if (wallet) return wallet;
    return tx.mitraWallet.create({ data: { mitraId: userId } });
  }

  private async assertNoDuplicateEarningTx(
    tx: Prisma.TransactionClient,
    walletId: string,
    referenceId?: string,
  ) {
    if (!referenceId) return;
    const existing = await tx.mitraTransaction.findFirst({
      where: { walletId, referenceId, type: "EARNING" },
    });
    if (existing) throw new Error("Transaksi sudah ada untuk referensi ini");
  }

  private async assertNoDuplicatePenaltyTx(
    tx: Prisma.TransactionClient,
    walletId: string,
    referenceId?: string,
  ) {
    if (!referenceId) return;
    const existing = await tx.mitraTransaction.findFirst({
      where: {
        walletId,
        referenceId,
        type: "ADJUSTMENT",
        description: { contains: PENALTY_PREFIX },
      },
    });
    if (existing)
      throw new Error("Transaksi penalti sudah ada untuk referensi ini");
  }
}

let instance: IMitraWalletRepository | null = null;

export function getMitraWalletRepository(): IMitraWalletRepository {
  if (!instance) {
    instance = new MitraWalletRepository();
  }

  return instance;
}

export type { EarningReferenceType };
