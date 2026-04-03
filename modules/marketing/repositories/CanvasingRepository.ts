import type { PrismaClient, CanvasingStatus, Canvasing } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { ICanvasingRepository, CreateCanvasingInput, UpdateCanvasingInput, CanvasingWithSalesSite, CanvasingWithSalesInfo } from './ICanvasingRepository'

export class CanvasingRepository implements ICanvasingRepository {
  constructor(private readonly db: PrismaClient) { }

  async create(data: CreateCanvasingInput): Promise<CanvasingWithSalesInfo> {
    return this.db.canvasing.create({
      data: {
        ...data,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            siteId: true
          }
        }
      }
    }) as unknown as Promise<CanvasingWithSalesInfo>
  }

  async findById(id: string): Promise<Canvasing | null> {
    return this.db.canvasing.findUnique({
      where: { id },
      include: {
        user: {
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
            workOrderNumber: true,
            status: true
          }
        },
        pointClaims: {
          select: {
            id: true,
            status: true,
            buktiUrls: true,
            keterangan: true,
            pointValue: true,
            reviewNotes: true,
            reviewedAt: true,
            reviewedBy: {
              select: {
                name: true
              }
            },
            createdAt: true
          }
        }
      }
    })
  }

  async findByIdWithSales(id: string): Promise<CanvasingWithSalesSite | null> {
    return this.db.canvasing.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            siteId: true,
            sites: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    }) as unknown as Promise<CanvasingWithSalesSite>
  }

  async findAll(
    filters?: { status?: CanvasingStatus; salesId?: string; mitraId?: string; siteId?: string },
    page?: number,
    limit?: number
  ): Promise<{ data: Canvasing[]; total: number }> {
    const whereClause: Prisma.CanvasingWhereInput = {
      AND: [
        filters?.status ? { status: filters.status } : {},
        filters?.salesId ? { salesId: filters.salesId } : {},
        filters?.mitraId ? { mitraId: filters.mitraId } : {},
        filters?.siteId ? {
          OR: [
            { user: { siteId: filters.siteId } }
          ]
        } as Prisma.CanvasingWhereInput : {},
      ],
    }

    const total = await this.db.canvasing.count({
      where: whereClause
    })

    const data = await this.db.canvasing.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        workOrder: {
          select: {
            status: true
          }
        },
        pointClaims: {
          select: {
            id: true,
            status: true,
            buktiUrls: true,
            keterangan: true,
            pointValue: true,
            reviewNotes: true,
            reviewedAt: true,
            reviewedBy: {
              select: {
                name: true
              }
            },
            createdAt: true
          },
        }
      },
      orderBy: { createdAt: 'desc' },
      ...(page && limit ? { skip: (page - 1) * limit, take: limit } : {})
    })

    return { data, total }
  }

  async update(id: string, data: UpdateCanvasingInput): Promise<Canvasing> {
    return this.db.canvasing.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      } as Prisma.CanvasingInclude
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.canvasing.delete({
      where: { id },
    })
  }

  /**
   * Find canvasing linked to a work order
   */
  async findByWorkOrderId(workOrderId: string): Promise<{ id: string; nama: string; salesId: string | null } | null> {
    return this.db.canvasing.findFirst({
      where: { workOrderId },
      select: { id: true, nama: true, salesId: true }
    })
  }
}
