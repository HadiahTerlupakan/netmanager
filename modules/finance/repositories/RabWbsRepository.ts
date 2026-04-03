import { prisma } from '@/lib/prisma'
import type { PrismaClient, RabWbs } from '@prisma/client'

export class RabWbsRepository {
  constructor(private client: PrismaClient = prisma) {}

  async create(data: { rabProjectId: string; name: string; order: number }): Promise<RabWbs> {
    return this.client.rabWbs.create({ data })
  }

  async createInTx(tx: PrismaClient, data: { rabProjectId: string; name: string; order: number }): Promise<RabWbs> {
    return tx.rabWbs.create({ data })
  }
}
