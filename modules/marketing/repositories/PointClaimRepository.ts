import { PrismaClient, PointClaimStatus } from '@prisma/client'
import type { PointClaim } from '@prisma/client'
import type { 
  IPointClaimRepository, 
  CreatePointClaimInput, 
  UpdatePointClaimInput,
  PointClaimWithRelations,
  PointSummary
} from './IPointClaimRepository'

export class PointClaimRepository implements IPointClaimRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: CreatePointClaimInput): Promise<PointClaim> {
    return this.db.pointClaim.create({
      data: {
        canvasingId: data.canvasingId,
        salesId: data.salesId,
        buktiUrls: data.buktiUrls,
        buktiMetadata: data.buktiMetadata,
        keterangan: data.keterangan,
      },
    })
  }

  async findById(id: string): Promise<PointClaimWithRelations | null> {
    return this.db.pointClaim.findUnique({
      where: { id },
      include: {
        canvasing: {
          select: {
            id: true,
            nama: true,
            alamat: true,
            paket: true,
            workOrder: {
              select: {
                workOrderNumber: true,
                status: true,
              },
            },
          },
        },
        sales: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }) as Promise<PointClaimWithRelations | null>
  }

  async findByCanvasingId(canvasingId: string): Promise<PointClaim | null> {
    return this.db.pointClaim.findUnique({
      where: { canvasingId },
    })
  }

  async findAll(filters?: { 
    status?: PointClaimStatus
    salesId?: string 
  }): Promise<PointClaimWithRelations[]> {
    return this.db.pointClaim.findMany({
      where: {
        AND: [
          filters?.status ? { status: filters.status } : {},
          filters?.salesId ? { salesId: filters.salesId } : {},
        ],
      },
      include: {
        canvasing: {
          select: {
            id: true,
            nama: true,
            alamat: true,
            paket: true,
            workOrder: {
              select: {
                workOrderNumber: true,
                status: true,
              },
            },
          },
        },
        sales: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<PointClaimWithRelations[]>
  }

  async update(id: string, data: UpdatePointClaimInput): Promise<PointClaim> {
    return this.db.pointClaim.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.pointClaim.delete({
      where: { id },
    })
  }

  async getPointSummaryBySales(salesId: string): Promise<PointSummary> {
    // Get all canvasings for this sales with their work orders and claims
    const canvasings = await this.db.canvasing.findMany({
      where: { salesId },
      include: {
        workOrder: {
          select: {
            status: true,
          },
        },
        pointClaims: {
          select: {
            status: true,
            pointValue: true,
          },
        },
      },
    })

    let woInProgressPoints = 0
    let woCompletedPoints = 0
    let claimPoints = 0
    let approvedClaims = 0
    let pendingClaims = 0

    for (const canvasing of canvasings) {
      const woStatus = canvasing.workOrder?.status

      // Poin WO In Progress (5 poin)
      if (woStatus && ['IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED'].includes(woStatus)) {
        woInProgressPoints += 5
      }

      // Poin WO Completed (+3 poin)
      if (woStatus && ['COMPLETED', 'VERIFIED', 'CLOSED'].includes(woStatus)) {
        woCompletedPoints += 3
      }

      // Poin Claim (+2 poin jika approved)
      const claim = canvasing.pointClaims as any
      if (claim) {
        if (claim.status === 'APPROVED') {
          claimPoints += claim.pointValue
          approvedClaims++
        } else if (claim.status === 'PENDING') {
          pendingClaims++
        }
      }
    }

    return {
      totalPoints: woInProgressPoints + woCompletedPoints + claimPoints,
      approvedClaims,
      pendingClaims,
      woInProgressPoints,
      woCompletedPoints,
      claimPoints,
    }
  }
}
