import { prisma } from '@/lib/prisma'
import type { PrismaClient } from '@prisma/client'

export class RabInvestorRepository {
  constructor(private client: PrismaClient = prisma) {}

  async createMany(data: Array<{
    rabProjectId: string
    investorId: string
    investmentAmount: number
    profitSharePercent: number
  }>) {
    return this.client.rabInvestor.createMany({ data })
  }

  async createManyInTx(tx: PrismaClient, data: Array<{
    rabProjectId: string
    investorId: string
    investmentAmount: number
    profitSharePercent: number
  }>) {
    return tx.rabInvestor.createMany({ data })
  }
}
