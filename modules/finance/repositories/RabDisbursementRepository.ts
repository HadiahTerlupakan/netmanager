import { prisma } from '@/lib/prisma'
import type { PrismaClient, RabDisbursement } from '@prisma/client'

export class RabDisbursementRepository {
  constructor(private client: PrismaClient = prisma) {}

  async createMany(data: Array<{
    rabItemId: string
    name: string
    percentage: number
    amount: bigint
    estimatedDate?: Date | null
    isPaid: boolean
  }>) {
    return this.client.rabDisbursement.createMany({ data })
  }

  async createManyInTx(tx: PrismaClient, data: Array<{
    rabItemId: string
    name: string
    percentage: number
    amount: bigint
    estimatedDate?: Date | null
    isPaid: boolean
  }>) {
    return tx.rabDisbursement.createMany({ data })
  }
}
