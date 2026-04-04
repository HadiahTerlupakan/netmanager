import { RabItemCategory, RabExpenseType, RabGrowthType, RabPaymentType, Prisma } from '@prisma/client'
import { logActivitySafe } from '@/lib/logger'
import { randomUUID } from 'crypto'
import {
  FinancialAccountRepository,
  ExpenseRepository,
  ExpenseCategoryRepository,
  RabProjectRepository,
  RabWbsRepository,
  RabItemRepository,
  RabDisbursementRepository,
  RabInvestorRepository,
  PurchaseOrderRepository
} from '../repositories'

export class FinanceService {
  private financialAccountRepo: FinancialAccountRepository
  private expenseRepo: ExpenseRepository
  private expenseCategoryRepo: ExpenseCategoryRepository
  private rabProjectRepo: RabProjectRepository
  private rabWbsRepo: RabWbsRepository
  private rabItemRepo: RabItemRepository
  private rabDisbursementRepo: RabDisbursementRepository
  private rabInvestorRepo: RabInvestorRepository
  private purchaseOrderRepo: PurchaseOrderRepository

  constructor() {
    this.financialAccountRepo = new FinancialAccountRepository()
    this.expenseRepo = new ExpenseRepository()
    this.expenseCategoryRepo = new ExpenseCategoryRepository()
    this.rabProjectRepo = new RabProjectRepository()
    this.rabWbsRepo = new RabWbsRepository()
    this.rabItemRepo = new RabItemRepository()
    this.rabDisbursementRepo = new RabDisbursementRepository()
    this.rabInvestorRepo = new RabInvestorRepository()
    this.purchaseOrderRepo = new PurchaseOrderRepository()
  }

  /**
   * Get all active financial accounts
   */
  async getAccounts() {
    return this.financialAccountRepo.findActive()
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
    return this.financialAccountRepo.create({
      name: data.name,
      type: data.type,
      accountNumber: data.accountNumber ?? null,
      description: data.description ?? null,
      balance: data.initialBalance || 0,
      isActive: true
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

    const expenses = await this.expenseRepo.findManyWithRelations(where)

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
    const expense = await this.expenseRepo.createExpense({
      id: randomUUID(),
      amount: data.amount,
      depreciation: data.depreciation || BigInt(0),
      usefulLife: data.usefulLife || 0,
      date: data.date,
      category: data.category,
      expenseCategoryId: data.expenseCategoryId,
      description: data.description,
      userId,
      siteId: data.siteId,
      mixRadiusGroupId: data.mixRadiusGroupId,
      rabProjectId: data.rabProjectId,
      rabItemId: data.rabItemId,
      invoiceNumber: data.invoiceNumber,
      invoiceFile: data.invoiceFile,
      accountId: data.accountId,
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

    return this.expenseCategoryRepo.findManyWithStats(where, expenseWhere)
  }

  /**
   * Create a new expense category
   */
  async createExpenseCategory(data: {
    name: string
    type: string
    parentId?: string | null
  }) {
    const existing = await this.expenseCategoryRepo.findFirstDuplicate(
      data.name,
      data.type,
      data.parentId || null
    )

    if (existing) {
      throw new Error(`Kategori "${data.name}" sudah ada di level ini.`)
    }

    return this.expenseCategoryRepo.createCategory({
      name: data.name,
      type: data.type,
      parentId: data.parentId ?? undefined
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

    const projects = await this.rabProjectRepo.findManyWithDetails(where)

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

    const project = await this.rabProjectRepo.createFullProject({
      project: {
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
      },
      wbsGroups,
      items: items.map(item => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        category: item.category,
        expenseType: item.expenseType,
        expenseCategoryId: item.expenseCategoryId,
        wbsGroupId: item.wbsGroupId,
        disbursements: item.disbursements.map(d => ({
          name: d.name,
          percentage: d.percentage,
          amount: d.amount,
          estimatedDate: d.estimatedDate,
          isPaid: d.isPaid,
        }))
      })),
      investorIds,
      investorProfitSharePercent
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
    const po = await this.purchaseOrderRepo.findById(input.poId)

    if (!po) throw new Error('Purchase Order not found')
    if (po.paymentStatus === 'PAID') throw new Error('Tagihan PO ini sudah lunas')

    const result = await this.purchaseOrderRepo.processPaymentTransaction({
      poId: input.poId,
      po,
      amount: input.amount,
      date: new Date(input.date),
      notes: input.notes,
      paidFromAccountId: input.paidFromAccountId
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
      const pos = await this.purchaseOrderRepo.findManyWithTax({
        ppnAmount: { gt: 0 },
        createdAt: { gte: startDate }
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
    const result = await this.financialAccountRepo.transferBetweenAccounts({
      sourceAccountId: data.sourceAccountId,
      destinationAccountId: data.destinationAccountId,
      amount: data.amount
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
