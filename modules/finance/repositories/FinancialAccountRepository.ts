import { prisma } from '@/lib/prisma'
import type { PrismaClient, FinancialAccount } from '@prisma/client'
import { Prisma } from '@prisma/client'

export interface IFinancialAccountRepository {
  findActive(): Promise<FinancialAccount[]>
  create(data: {
    name: string
    type: 'BANK' | 'CASH' | 'EWALLET' | 'OTHER'
    accountNumber?: string | null
    description?: string | null
    balance: number
    isActive: boolean
  }): Promise<FinancialAccount>
  findById(id: string): Promise<FinancialAccount | null>
  updateBalance(id: string, data: { increment?: number } | { decrement?: number }): Promise<FinancialAccount>
  transferBetweenAccounts(data: {
    sourceAccountId: string
    destinationAccountId: string
    amount: number
  }): Promise<{ success: true }>
}

export class FinancialAccountRepository implements IFinancialAccountRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findActive(): Promise<FinancialAccount[]> {
    return this.client.financialAccount.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })
  }

  async create(data: {
    name: string
    type: 'BANK' | 'CASH' | 'EWALLET' | 'OTHER'
    accountNumber?: string | null
    description?: string | null
    balance: number
    isActive: boolean
  }): Promise<FinancialAccount> {
    return this.client.financialAccount.create({ data })
  }

  async findById(id: string): Promise<FinancialAccount | null> {
    return this.client.financialAccount.findUnique({ where: { id } })
  }

  async updateBalance(id: string, data: { increment?: number } | { decrement?: number }): Promise<FinancialAccount> {
    return this.client.financialAccount.update({
      where: { id },
      data: { balance: data as Prisma.InputJsonObject }
    })
  }

  async transferBetweenAccounts(data: {
    sourceAccountId: string
    destinationAccountId: string
    amount: number
  }): Promise<{ success: true }> {
    return this.client.$transaction(async (tx) => {
      await tx.financialAccount.update({
        where: { id: data.sourceAccountId },
        data: { balance: { decrement: data.amount } }
      })

      await tx.financialAccount.update({
        where: { id: data.destinationAccountId },
        data: { balance: { increment: data.amount } }
      })

      return { success: true }
    })
  }
}
