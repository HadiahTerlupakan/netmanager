import { PrismaClient, CanvasingStatus } from '@prisma/client'
import type { Canvasing } from '@prisma/client'
import type { ICanvasingRepository, CreateCanvasingInput, UpdateCanvasingInput } from './ICanvasingRepository'

export class CanvasingRepository implements ICanvasingRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: CreateCanvasingInput): Promise<Canvasing> {
    return this.db.canvasing.create({
      data: {
        ...data,
      },
      include: {
          sales: {
              select: {
                  name: true,
                  email: true
              }
          }
      }
    })
  }

  async findById(id: string): Promise<Canvasing | null> {
    return this.db.canvasing.findUnique({
      where: { id },
      include: {
          sales: {
              select: {
                  name: true,
                  email: true
              }
          },
          approver: {
              select: {
                  name: true
              }
          },
          workOrder: {
              select: {
                  workOrderNumber: true
              }
          }
      }
    })
  }

  async findAll(filters?: { status?: CanvasingStatus; salesId?: string }): Promise<Canvasing[]> {
    return this.db.canvasing.findMany({
      where: {
        AND: [
          filters?.status ? { status: filters.status } : {},
          filters?.salesId ? { salesId: filters.salesId } : {},
        ],
      },
      include: {
          sales: {
              select: {
                  name: true,
                  email: true
              }
          }
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async update(id: string, data: UpdateCanvasingInput): Promise<Canvasing> {
    return this.db.canvasing.update({
      where: { id },
      data,
      include: {
          sales: {
              select: {
                  name: true,
                  email: true
              }
          }
      }
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.canvasing.delete({
      where: { id },
    })
  }
}
