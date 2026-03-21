import { prisma } from '@/lib/prisma'
import { type PaymentStatus, RabItemCategory, RabExpenseType, RabGrowthType, RabPaymentType, Prisma } from '@prisma/client'
import { logActivitySafe } from '@/lib/logger'
import { randomUUID } from 'crypto'

export class FinanceService {
  constructor() {}

  /**
   * Get all active financial accounts
   */
  async getAccounts() {
    return prisma.financialAccount.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })
  }

  /**
   * Create a new financial account
   */
  async createAccount(data: {
    name: string
    type: 'BANK' | 'CASH' | 'EWALLET' | 'OTHER'
    accountNumber?: string
    description?: string
    initialBalance?: number
  }) {
    return prisma.financialAccount.create({
      data: {
        name: data.name,
        type: data.type,
        accountNumber: data.accountNumber ?? null,
        description: data.description ?? null,
        balance: data.initialBalance || 0,
        isActive: true
      }
    })
  }

  /**
   * Get expenses with filtering and BigInt serialization
   */
  async getExpenses(params: {
    startDate?: Date
    endDate?: Date
    siteId?: string | null
    mixRadiusGroupId?: string | null
    category?: string | null
    expenseCategoryId?: string | null
    scope?: string | null
    restrictedSiteId?: string | null
  }) {
    const where: Prisma.ExpenseWhereInput = {}
    
    if (params.startDate && params.endDate) {
      where.date = {
        gte: params.startDate,
        lte: params.endDate,
      }
    }

    if (params.category) {
      where.category = params.category
    }

    if (params.expenseCategoryId) {
      where.expenseCategoryId = params.expenseCategoryId
    }

    if (params.restrictedSiteId) {
      where.siteId = params.restrictedSiteId
    } else if (params.scope === 'general') {
      where.siteId = null
      where.mixRadiusGroupId = null
    } else if (params.mixRadiusGroupId) {
      where.mixRadiusGroupId = params.mixRadiusGroupId
    } else if (params.siteId) {
      where.siteId = params.siteId
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
      include: {
        user: { select: { name: true } },
        site: { select: { name: true } },
        expenseCategory: { select: { id: true, name: true, type: true } },
        rabProject: { select: { id: true, name: true } },
        rabItem: { select: { id: true, name: true } }
      }
    })

    return expenses.map(expense => ({
      ...expense,
      amount: expense.amount.toString(),
      depreciation: expense.depreciation ? expense.depreciation.toString() : '0',
      usefulLife: expense.usefulLife || 0,
    }))
  }

  /**
   * Create a new expense record
   */
  async createExpense(data: {
    amount: bigint
    depreciation?: bigint
    usefulLife?: number
    date: Date
    category: string
    expenseCategoryId?: string
    description?: string
    siteId?: string
    mixRadiusGroupId?: string
    rabProjectId?: string
    rabItemId?: string
    invoiceNumber?: string
    invoiceFile?: string
    accountId?: string
  }, userId: string) {
    const expense = await prisma.expense.create({
      data: {
        id: randomUUID(),
        amount: data.amount,
        depreciation: data.depreciation || 0,
        usefulLife: data.usefulLife || 0,
        date: data.date,
        category: data.category,
        ...(data.expenseCategoryId ? { expenseCategory: { connect: { id: data.expenseCategoryId } } } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        user: { connect: { id: userId } },
        updatedAt: new Date(),
        ...(data.siteId ? { site: { connect: { id: data.siteId } } } : {}),
        ...(data.mixRadiusGroupId ? { mixRadiusGroupId: data.mixRadiusGroupId } : {}),
        ...(data.rabProjectId ? { rabProject: { connect: { id: data.rabProjectId } } } : {}),
        ...(data.rabItemId ? { rabItem: { connect: { id: data.rabItemId } } } : {}),
        ...(data.invoiceNumber ? { invoiceNumber: data.invoiceNumber } : {}),
        ...(data.invoiceFile ? { invoiceFile: data.invoiceFile } : {}),
        ...(data.accountId ? { financialAccount: { connect: { id: data.accountId } } } : {}),
      },
    })

    return {
      ...expense,
      amount: expense.amount.toString(),
      depreciation: expense.depreciation ? expense.depreciation.toString() : '0',
      usefulLife: expense.usefulLife || 0,
    }
  }

  /**
   * Get expense categories with statistics
   */
  async getExpenseCategories(params?: {
    type?: string
    startDate?: Date
    endDate?: Date
  }) {
    const where: { type?: string } = {}
    if (params?.type) {
      where.type = params.type
    }

    const expenseWhere: { date?: { gte: Date; lte: Date } } = {}
    if (params?.startDate && params?.endDate) {
      expenseWhere.date = {
        gte: params.startDate,
        lte: params.endDate
      }
    }

    const categories = await prisma.expenseCategory.findMany({
      where,
      include: {
        parent: {
          select: { name: true }
        },
        _count: {
          select: { children: true }
        },
        expenses: {
          where: expenseWhere,
          select: { amount: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return categories.map(cat => {
      const { expenses, ...rest } = cat
      return {
        ...rest,
        totalDirect: expenses.reduce((sum, e) => sum + Number(e.amount), 0)
      }
    })
  }

  /**
   * Create a new expense category
   */
  async createExpenseCategory(data: {
    name: string
    type: string
    parentId?: string | null
  }) {
    const existing = await prisma.expenseCategory.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: 'insensitive'
        },
        type: data.type,
        parentId: data.parentId || null
      }
    })

    if (existing) {
      throw new Error(`Kategori "${data.name}" sudah ada di level ini.`)
    }

    return prisma.expenseCategory.create({
      data: {
        name: data.name,
        type: data.type,
        ...(data.parentId ? { parentId: data.parentId } : {})
      }
    })
  }

  /**
   * Get RAB projects with nested data and serialization
   */
  async getRabProjects(params: {
    siteId?: string | null
    mixRadiusGroupId?: string | null
    mixRadiusInvestorSiteId?: string | null
    status?: string | null
  }) {
    const where: Prisma.RabProjectWhereInput = {}
    if (params.siteId) where.siteId = params.siteId
    if (params.mixRadiusGroupId) where.mixRadiusGroupId = params.mixRadiusGroupId
    if (params.mixRadiusInvestorSiteId) where.mixRadiusInvestorSiteId = params.mixRadiusInvestorSiteId
    if (params.status) where.status = params.status as Prisma.RabProjectWhereInput['status']

    const projects = await prisma.rabProject.findMany({
      where,
      include: {
        items: {
          include: {
            disbursements: true,
            expenseCategory: {
              include: {
                parent: true
              }
            }
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
                role: {
                  select: { name: true }
                }
              }
            }
          }
        },
        revisions: {
          select: {
            id: true,
            revisionNumber: true,
            status: true
          },
          orderBy: { revisionNumber: 'desc' },
          take: 1
        },
        _count: {
          select: {
            revisions: true
          }
        }
      },
    })

    return projects.map(p => {
      const { revisions, _count, ...projectData } = p

      return {
        ...projectData,
        projectedRevenue: p.projectedRevenue.toString(),
        projectedOpex: p.projectedOpex.toString(),
        arpu: p.arpu?.toString() || null,
        contingencyAmount: p.contingencyAmount?.toString() || "0",
        revisionCount: _count?.revisions || 0,
        latestRevision: revisions?.[0] || null,
        investors: (p.investors || []).map((i: { investmentAmount: bigint }) => ({
          ...i,
          investmentAmount: i.investmentAmount?.toString() || "0"
        })),
        items: p.items.map(i => ({
          ...i,
          unitPrice: i.unitPrice.toString(),
          totalPrice: i.totalPrice.toString(),
          disbursements: (i.disbursements || []).map((d: { amount: bigint }) => ({
            ...d,
            amount: d.amount.toString()
          }))
        }))
      }
    })
  }

  /**
   * Create a new RAB project with nested items, WBS, and investors
   */
  async createRabProject(data: {
    name: string
    description?: string
    siteId?: string | null
    mixRadiusGroupId?: string | null
    mixRadiusInvestorSiteId?: string | null
    projectedRevenue: bigint
    projectedOpex: bigint
    targetSubscribers?: number
    arpu?: bigint
    growthType: RabGrowthType
    paymentType: RabPaymentType
    growthSettings?: unknown
    startDate?: Date
    investmentDurationMonths: number
    investmentRecoveryType: "PERCENTAGE" | "FIXED"
    investmentRecoveryValue: number
    investorProfitSharePercent: number
    contingencyPercent: number
    contingencyAmount: bigint
    nplTolerancePercent: number
    hasDisbursementPlan: boolean
    wbsGroups: Array<{ id?: string, name: string, order: number }>
    investorIds: string[]
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
        id?: string
        name: string
        percentage: number
        amount: bigint
        estimatedDate?: Date
        isPaid: boolean
      }>
    }>
  }, userId: string) {
    const {
      name, description, siteId, mixRadiusGroupId, mixRadiusInvestorSiteId,
      projectedRevenue, projectedOpex, items,
      targetSubscribers, arpu, growthType, paymentType, growthSettings, startDate,
      investmentDurationMonths, investmentRecoveryType, investmentRecoveryValue, investorProfitSharePercent,
      contingencyPercent, contingencyAmount, nplTolerancePercent, hasDisbursementPlan, wbsGroups, investorIds
    } = data

    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.rabProject.create({
        data: {
          name,
          description,
          siteId,
          mixRadiusGroupId,
          mixRadiusInvestorSiteId,
          projectedRevenue,
          projectedOpex,
          targetSubscribers,
          arpu,
          growthType,
          paymentType,
          growthSettings: (growthSettings || undefined) as Prisma.InputJsonValue,
          startDate,
          investmentDurationMonths,
          investmentRecoveryType,
          investmentRecoveryValue,
          investorProfitSharePercent,
          contingencyPercent,
          contingencyAmount,
          nplTolerancePercent,
          hasDisbursementPlan,
          createdBy: userId
        }
      })

      const wbsMap = new Map<string, string>()
      for (const wbs of wbsGroups) {
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

      if (items.length > 0) {
        for (const item of items) {
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

      if (investorIds && investorIds.length > 0) {
        const totalCapex = items
          .filter((i) => i.expenseType === 'CAPEX')
          .reduce((acc: number, i) => acc + (Number(i.quantity) * Number(i.unitPrice)), 0)

        const splitAmount = Math.floor(totalCapex / investorIds.length)

        await tx.rabInvestor.createMany({
          data: investorIds.map((id: string) => ({
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
    })

    if (!project) throw new Error("Gagal membuat proyek RAB")

    return {
      ...project,
      projectedRevenue: project.projectedRevenue.toString(),
      projectedOpex: project.projectedOpex.toString(),
      arpu: project.arpu?.toString() || null,
      items: (project.items || []).map((i) => ({
        ...i,
        unitPrice: i.unitPrice.toString(),
        totalPrice: i.totalPrice.toString(),
        disbursements: (i.disbursements || []).map((d) => ({
          ...d,
          amount: d.amount.toString()
        }))
      })),
      contingencyAmount: project.contingencyAmount?.toString()
    }
  }

  /**
   * Process payment for a Purchase Order
   */
  async payPurchaseOrder(input: {
    poId: string
    amount: number
    date: Date | string
    notes?: string
    createdById: string
    paidFromAccountId?: string
  }) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: input.poId }
    })

    if (!po) throw new Error('Purchase Order not found')
    if (po.paymentStatus === 'PAID') throw new Error('Tagihan PO ini sudah lunas')

    const result = await prisma.$transaction(async (tx) => {
      if (input.paidFromAccountId) {
        const account = await tx.financialAccount.findUnique({
          where: { id: input.paidFromAccountId }
        })

        if (!account) throw new Error('Akun keuangan tidak ditemukan')
        if (account.balance < input.amount) {
          throw new Error(`Saldo akun ${account.name} tidak mencukupi.`)
        }

        await tx.financialAccount.update({
          where: { id: input.paidFromAccountId },
          data: { balance: { decrement: input.amount } }
        })
      }

      const expense = await tx.expense.create({
        data: {
          category: 'Purchase Order Payment',
          amount: input.amount,
          date: new Date(input.date),
          description: input.notes || `Pembayaran PO #${po.poNumber}`,
          invoiceNumber: po.poNumber
        }
      })

      const existingExpenses = await tx.expense.findMany({
        where: { invoiceNumber: po.poNumber }
      })

      const totalPaid = existingExpenses.reduce((sum: number, e) => sum + Number(e.amount), 0)
      let newStatus: PaymentStatus = 'UNPAID'
      const targetAmount = po.grandTotal > 0 ? po.grandTotal : po.totalAmount

      if (totalPaid >= (targetAmount - 100)) {
        newStatus = 'PAID'
      } else if (totalPaid > 0) {
        newStatus = 'PARTIAL'
      }

      await tx.purchaseOrder.update({
        where: { id: input.poId },
        data: {
          paymentStatus: newStatus,
          ...(input.paidFromAccountId ? { paidFromAccountId: input.paidFromAccountId } : {})
        }
      })

      return { expense, newStatus }
    })

    logActivitySafe({
      action: 'PAYMENT',
      subject: 'Purchase Order',
      userId: input.createdById,
      details: {
        poId: po.id,
        poNumber: po.poNumber,
        amount: input.amount,
        status: result.newStatus,
        expenseId: result.expense.id
      }
    })

    return result.expense
  }

  /**
   * Get reports (CAPEX/OPEX or TAX)
   */
  async getReports(type: 'CAPEX_OPEX' | 'TAX') {
    if (type === 'TAX') {
      const startDate = new Date(new Date().getFullYear(), 0, 1)
      const pos = await prisma.purchaseOrder.findMany({
        where: {
          ppnAmount: { gt: 0 },
          createdAt: { gte: startDate }
        },
        select: {
          poNumber: true,
          ppnAmount: true,
          ppnRate: true,
          totalAmount: true,
          createdAt: true,
          supplier: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      })

      return {
        totalPPN: pos.reduce((sum: number, po) => sum + Number(po.ppnAmount), 0),
        details: pos
      }
    }
    return null
  }

  /**
   * Transfer funds between accounts
   */
  async transferFunds(data: {
    sourceAccountId: string
    destinationAccountId: string
    amount: number
    date: Date | string
    description?: string
    createdById: string
  }) {
    const result = await prisma.$transaction(async (tx) => {
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

    logActivitySafe({
      action: 'TRANSFER',
      subject: 'Finance Funds',
      userId: data.createdById,
      details: {
        from: data.sourceAccountId,
        to: data.destinationAccountId,
        amount: data.amount
      }
    })

    return result
  }
}
