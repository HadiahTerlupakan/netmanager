import { prisma } from "@/lib/prisma";
import type { PrismaClient, FinancialAccount } from "@prisma/client";

import {
  FinancialAccountNotFoundError,
  InsufficientBalanceError,
} from "../domain/errors";
import type { TreasuryMutationRecord } from "../dto/TreasuryMutationDTO";

export interface TransferInput {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  date: Date | string;
  description?: string;
  createdById?: string;
}

export interface IFinancialAccountRepository {
  findActive(): Promise<FinancialAccount[]>;
  create(data: {
    name: string;
    type: "BANK" | "CASH" | "EWALLET" | "OTHER";
    accountNumber?: string | null;
    description?: string | null;
    balance: number;
    isActive: boolean;
  }): Promise<FinancialAccount>;
  findById(id: string): Promise<FinancialAccount | null>;
  transferBetweenAccounts(data: TransferInput): Promise<{ success: true }>;
  findRecentMutations(limit: number): Promise<TreasuryMutationRecord[]>;
}

export class FinancialAccountRepository implements IFinancialAccountRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findActive(): Promise<FinancialAccount[]> {
    return this.client.financialAccount.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async create(data: {
    name: string;
    type: "BANK" | "CASH" | "EWALLET" | "OTHER";
    accountNumber?: string | null;
    description?: string | null;
    balance: number;
    isActive: boolean;
  }): Promise<FinancialAccount> {
    return this.client.financialAccount.create({ data });
  }

  async findById(id: string): Promise<FinancialAccount | null> {
    return this.client.financialAccount.findUnique({ where: { id } });
  }

  /** Riwayat mutasi terbaru, terbaru lebih dulu. */
  async findRecentMutations(limit: number): Promise<TreasuryMutationRecord[]> {
    return this.client.treasuryMutation.findMany({
      take: limit,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        amount: true,
        description: true,
        sourceAccount: { select: { id: true, name: true } },
        destinationAccount: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
    });
  }

  /**
   * Pindahkan dana antar akun dalam satu transaksi.
   *
   * Pendebetan memakai `updateMany` dengan syarat `balance >= amount` alih-alih
   * membaca saldo lalu mengurangi: satu pernyataan UPDATE bersyarat tidak bisa
   * disalip transfer lain yang berjalan bersamaan. Bila tidak ada baris yang
   * terpengaruh, barulah dibedakan apakah akunnya tidak ada atau saldonya kurang.
   *
   * Baris riwayat ditulis di transaksi yang sama, jadi saldo dan riwayatnya
   * tidak pernah berbeda: kalau salah satu gagal, keduanya batal.
   */
  async transferBetweenAccounts(data: TransferInput): Promise<{
    success: true;
  }> {
    return this.client.$transaction(async (tx) => {
      const debited = await tx.financialAccount.updateMany({
        where: { id: data.sourceAccountId, balance: { gte: data.amount } },
        data: { balance: { decrement: data.amount } },
      });

      if (debited.count === 0) {
        const source = await tx.financialAccount.findUnique({
          where: { id: data.sourceAccountId },
          select: { balance: true },
        });
        if (!source) {
          throw new FinancialAccountNotFoundError(data.sourceAccountId);
        }
        throw new InsufficientBalanceError(
          data.sourceAccountId,
          data.amount,
          source.balance,
        );
      }

      const credited = await tx.financialAccount.updateMany({
        where: { id: data.destinationAccountId },
        data: { balance: { increment: data.amount } },
      });

      if (credited.count === 0) {
        throw new FinancialAccountNotFoundError(data.destinationAccountId);
      }

      await tx.treasuryMutation.create({
        data: {
          date: new Date(data.date),
          amount: data.amount,
          description: data.description ?? null,
          sourceAccountId: data.sourceAccountId,
          destinationAccountId: data.destinationAccountId,
          createdById: data.createdById ?? null,
        },
      });

      return { success: true };
    });
  }
}
