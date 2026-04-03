import { prisma } from '@/lib/prisma'
import type { PrismaClient, RabProject, RabWbs, RabItem, RabDisbursement, RabInvestor } from '@prisma/client'
import type { Prisma, RabItemCategory, RabExpenseType, RabGrowthType, RabPaymentType, RabRecoveryType } from '@prisma/client'

export interface RabProjectWithDetails extends RabProject {
  items?: (RabItem & { disbursements?: RabDisbursement[] })[]
  wbsGroups?: RabWbs[]
  site?: { name: string } | null
  investors?: RabInvestor[]
  creator?: { name: string } | null
  approvals?: unknown[]
  revisions?: { id: string; revisionNumber: number; status: string }[]
  _count?: { revisions: number }
}

export class RabProjectRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findManyWithDetails(where: Prisma.RabProjectWhereInput): Promise<RabProjectWithDetails[]> {
    return this.client.rabProject.findMany({
      where,
      include: {
        items: {
          include: {
            disbursements: true,
            expenseCategory: { include: { parent: true } }
          }
        },
        wbsGroups: true,
        site: { select: { name: true } },
        investors: true,
        creator: { select: { name: true } },
        approvals: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: { select: { name: true } }
              }
            }
          }
        },
        revisions: {
          select: { id: true, revisionNumber: true, status: true },
          orderBy: { revisionNumber: 'desc' },
          take: 1
        },
        _count: { select: { revisions: true } }
      }
    }) as Promise<RabProjectWithDetails[]>
  }

  async createProject(data: Prisma.RabProjectCreateInput): Promise<RabProject> {
    return this.client.rabProject.create({ data })
  }

  async findByIdWithItems(id: string): Promise<(RabProject & { items?: (RabItem & { disbursements?: RabDisbursement[] })[]; wbsGroups?: RabWbs[] }) | null> {
    return this.client.rabProject.findUnique({
      where: { id },
      include: {
        items: { include: { disbursements: true } },
        wbsGroups: true
      }
    })
  }

  async createFullProject(data: {
    project: {
      name: string
      description?: string
      siteId?: string | null
      mixRadiusGroupId?: string | null
      mixRadiusInvestorSiteId?: string | null
      projectedRevenue: bigint
      projectedOpex: bigint
      targetSubscribers?: number
      arpu?: bigint
      growthType: string
      paymentType: string
      growthSettings?: unknown
      startDate?: Date
      investmentDurationMonths: number
      investmentRecoveryType: string
      investmentRecoveryValue: number
      investorProfitSharePercent: number
      contingencyPercent: number
      contingencyAmount: bigint
      nplTolerancePercent: number
      hasDisbursementPlan: boolean
      createdBy: string
    }
    wbsGroups: Array<{ id?: string, name: string, order: number }>
    items: Array<{
      name: string
      description?: string
      quantity: number
      unitPrice: bigint
      category: RabItemCategory
      expenseType: RabExpenseType
      expenseCategoryId?: string
      wbsGroupId?: string
      disbursements: Array<{
        name: string
        percentage: number
        amount: bigint
        estimatedDate?: Date
        isPaid: boolean
      }>
    }>
    investorIds: string[]
    investorProfitSharePercent: number
  }): Promise<RabProjectWithDetails | null> {
    return this.client.$transaction(async (tx) => {
      const p = await tx.rabProject.create({
        data: {
          name: data.project.name,
          description: data.project.description,
          siteId: data.project.siteId,
          mixRadiusGroupId: data.project.mixRadiusGroupId,
          mixRadiusInvestorSiteId: data.project.mixRadiusInvestorSiteId,
          projectedRevenue: data.project.projectedRevenue,
          projectedOpex: data.project.projectedOpex,
          targetSubscribers: data.project.targetSubscribers,
          arpu: data.project.arpu,
          growthType: data.project.growthType as RabGrowthType,
          paymentType: data.project.paymentType as RabPaymentType,
          growthSettings: (data.project.growthSettings || undefined) as Prisma.InputJsonValue,
          startDate: data.project.startDate,
          investmentDurationMonths: data.project.investmentDurationMonths,
          investmentRecoveryType: data.project.investmentRecoveryType as RabRecoveryType,
          investmentRecoveryValue: data.project.investmentRecoveryValue,
          investorProfitSharePercent: data.project.investorProfitSharePercent,
          contingencyPercent: data.project.contingencyPercent,
          contingencyAmount: data.project.contingencyAmount,
          nplTolerancePercent: data.project.nplTolerancePercent,
          hasDisbursementPlan: data.project.hasDisbursementPlan,
          createdBy: data.project.createdBy,
        }
      })

      const wbsMap = new Map<string, string>()
      for (const wbs of data.wbsGroups) {
        const createdWbs = await tx.rabWbs.create({
          data: {
            rabProjectId: p.id,
            name: wbs.name,
            order: wbs.order,
          }
        })
        if (wbs.id) {
          wbsMap.set(wbs.id, createdWbs.id)
        }
      }

      if (data.items.length > 0) {
        for (const item of data.items) {
          const createdItem = await tx.rabItem.create({
            data: {
              rabProjectId: p.id,
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              category: item.category,
              expenseType: item.expenseType,
              expenseCategoryId: item.expenseCategoryId,
              totalPrice: BigInt(item.quantity) * item.unitPrice,
              wbsId: item.wbsGroupId ? wbsMap.get(item.wbsGroupId) : undefined,
            }
          })

          if (item.disbursements && item.disbursements.length > 0) {
            const disbData = item.disbursements.map((d) => ({
              rabItemId: createdItem.id,
              name: d.name,
              percentage: d.percentage,
              amount: d.amount,
              estimatedDate: d.estimatedDate,
              isPaid: d.isPaid,
            }))
            await tx.rabDisbursement.createMany({ data: disbData })
          }
        }
      }

      if (data.investorIds && data.investorIds.length > 0) {
        const totalCapex = data.items
          .filter((i) => i.expenseType === 'CAPEX')
          .reduce((acc: number, i) => acc + (Number(i.quantity) * Number(i.unitPrice)), 0)

        const splitAmount = Math.floor(totalCapex / data.investorIds.length)

        await tx.rabInvestor.createMany({
          data: data.investorIds.map((id: string) => ({
            rabProjectId: p.id,
            investorId: id,
            investmentAmount: splitAmount,
            profitSharePercent: p.investorProfitSharePercent
          }))
        })
      }

      return tx.rabProject.findUnique({
        where: { id: p.id },
        include: {
          items: { include: { disbursements: true } },
          wbsGroups: true
        }
      })
    }) as Promise<RabProjectWithDetails | null>
  }
}
