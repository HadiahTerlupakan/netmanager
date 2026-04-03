import { prisma } from '@/lib/prisma'
import type { PrismaClient, RabItem } from '@prisma/client'
import type { RabItemCategory, RabExpenseType } from '@prisma/client'

export class RabItemRepository {
  constructor(private client: PrismaClient = prisma) {}

  async create(data: {
    rabProjectId: string
    name: string
    description?: string | null
    quantity: number
    unitPrice: bigint
    category: RabItemCategory
    expenseType: RabExpenseType
    expenseCategoryId?: string | null
    totalPrice: bigint
    wbsId?: string
  }): Promise<RabItem> {
    return this.client.rabItem.create({ data })
  }

  async createInTx(tx: PrismaClient, data: {
    rabProjectId: string
    name: string
    description?: string | null
    quantity: number
    unitPrice: bigint
    category: RabItemCategory
    expenseType: RabExpenseType
    expenseCategoryId?: string | null
    totalPrice: bigint
    wbsId?: string
  }): Promise<RabItem> {
    return tx.rabItem.create({ data })
  }
}
