import { prismaBilling } from '@/lib/prisma-billing'
import type { Prisma, UnmatchedMutation } from '@prisma/client-billing'

export class UnmatchedMutationRepository {
  constructor(private readonly client = prismaBilling) {}

  async count(where: Prisma.UnmatchedMutationWhereInput = {}): Promise<number> {
    return this.client.unmatchedMutation.count({ where })
  }

  async findMany(
    where: Prisma.UnmatchedMutationWhereInput = {},
    options?: {
      skip?: number
      take?: number
      orderBy?: Prisma.UnmatchedMutationOrderByWithRelationInput
    }
  ): Promise<UnmatchedMutation[]> {
    return this.client.unmatchedMutation.findMany({
      where,
      orderBy: options?.orderBy,
      skip: options?.skip,
      take: options?.take,
    })
  }

  async findById(id: string): Promise<UnmatchedMutation | null> {
    return this.client.unmatchedMutation.findUnique({ where: { id } })
  }

  async update(
    id: string,
    data: Prisma.UnmatchedMutationUpdateInput
  ): Promise<UnmatchedMutation> {
    return this.client.unmatchedMutation.update({ where: { id }, data })
  }
}
