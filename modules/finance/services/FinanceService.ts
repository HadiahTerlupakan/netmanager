import { prisma } from '@/lib/prisma'
import { TransactionRepository } from '../repositories/TransactionRepository'
import type { ITransactionRepository } from '../repositories/ITransactionRepository'
import { TransactionCategoryRepository } from '../repositories/TransactionCategoryRepository'
import type { ITransactionCategoryRepository } from '../repositories/ITransactionCategoryRepository'
import { type Prisma, type PaymentStatus } from '@prisma/client'
import { logActivitySafe } from '@/lib/logger'

export class FinanceService {
  private transactionRepo: ITransactionRepository
  private categoryRepo: ITransactionCategoryRepository

  constructor() {
    this.transactionRepo = new TransactionRepository()
    this.categoryRepo = new TransactionCategoryRepository()
  }

  async getAllCategories() {
    return this.categoryRepo.findAll()
  }

  async createCategory(data: Prisma.TransactionCategoryCreateInput) {
    return this.categoryRepo.create(data)
  }

  async updateCategory(id: string, data: Prisma.TransactionCategoryUpdateInput) {
    const category = await this.categoryRepo.findById(id)
    if (!category) throw new Error('Kategori tidak ditemukan')
    return this.categoryRepo.update(id, data)
  }

  async getTransactions(filters?: { startDate?: string, endDate?: string, categoryId?: string, accountId?: string, siteId?: string }) {
    return this.transactionRepo.findAll({
      ...(filters?.startDate ? { startDate: new Date(filters.startDate) } : {}),
      ...(filters?.endDate ? { endDate: new Date(filters.endDate) } : {}),
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters?.accountId ? { accountId: filters.accountId } : {}),
      ...(filters?.siteId ? { siteId: filters.siteId } : {})
    })
  }

  async createTransaction(data: {
    type: 'INCOME' | 'EXPENSE'
    amount: number
    date: Date | string
    description?: string
    categoryId: string
    createdById: string
    referenceId?: string
    accountId?: string
    attachments?: string[]
  }) {
    // 1. Update Account Balance if provided
    const result = await prisma.$transaction(async (tx) => {
        if (data.accountId) {
            const modification = data.type === 'INCOME' ? data.amount : -data.amount
            await tx.financialAccount.update({
                where: { id: data.accountId },
                data: { balance: { increment: modification } }
            })
        }

        // 2. Create Transaction
        return tx.transaction.create({
            data: {
                type: data.type,
                amount: data.amount,
                date: new Date(data.date),
                description: data.description ?? null,
                categoryId: data.categoryId,
                createdById: data.createdById,
                referenceId: data.referenceId ?? null,
                accountId: data.accountId ?? null,
                attachments: data.attachments || []
            },
            include: { category: true }
        })
    })

    // Log Activity
    logActivitySafe({
        action: 'CREATE',
        subject: 'Finance Transaction',
        userId: data.createdById,
        details: { 
            id: result.id, 
            type: result.type, 
            amount: result.amount,
            desc: result.description,
            ref: result.referenceId
        }
    })

    return result
  }

  /**
   * Process payment for a Purchase Order
   * Wraps transaction creation and PO status update in a database transaction
   */
  async payPurchaseOrder(input: {
    poId: string
    amount: number
    date: Date | string
    categoryId: string
    notes?: string
    createdById: string
    paidFromAccountId?: string
  }) {
    // 1. Verify PO existence
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: input.poId }
    })

    if (!po) throw new Error('Purchase Order not found')
    if (po.paymentStatus === 'PAID') throw new Error('Tagihan PO ini sudah lunas')

    // 2. Wrap in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 2a. Validate and Update Account Balance if provided (Decrease for payment)
      if (input.paidFromAccountId) {
          // Validasi saldo mencukupi
          const account = await tx.financialAccount.findUnique({
            where: { id: input.paidFromAccountId }
          })
          
          if (!account) {
            throw new Error('Akun keuangan tidak ditemukan')
          }
          
          if (account.balance < input.amount) {
            throw new Error(`Saldo akun ${account.name} tidak mencukupi. Saldo: Rp ${account.balance.toLocaleString('id-ID')}, Dibutuhkan: Rp ${input.amount.toLocaleString('id-ID')}`)
          }
          
          await tx.financialAccount.update({
              where: { id: input.paidFromAccountId },
              data: { balance: { decrement: input.amount } }
          })
      }

      // Create Financial Transaction record
      const transaction = await tx.transaction.create({
        data: {
          type: 'EXPENSE',
          amount: input.amount,
          date: new Date(input.date),
          description: input.notes || `Pembayaran PO #${po.poNumber}`,
          categoryId: input.categoryId,
          referenceId: po.poNumber,
          purchaseOrderId: po.id,
          createdById: input.createdById,
          accountId: input.paidFromAccountId ?? null
        }
      })

      // Calculate new Payment Status
      // Fetch all transactions for this PO (including the one just created)
      const existingTx = await tx.transaction.findMany({
        where: { purchaseOrderId: input.poId }
      })

      const totalPaid = existingTx.reduce((sum, t) => sum + t.amount, 0)

      // Determine status: UNPAID (no payments), PARTIAL (some payments), PAID (fully paid)
      let newStatus: PaymentStatus = 'UNPAID'

      // Check full payment with small tolerance (against Grand Total)
      // If grandTotal is 0 (legacy data), use totalAmount
      const targetAmount = po.grandTotal > 0 ? po.grandTotal : po.totalAmount

      if (totalPaid >= (targetAmount - 100)) {
        newStatus = 'PAID'
      } else if (totalPaid > 0) {
        newStatus = 'PARTIAL'
      }

      // Update PO Status & Last Paid Account
      await tx.purchaseOrder.update({
        where: { id: input.poId },
        data: {
            paymentStatus: newStatus,
            ...(input.paidFromAccountId ? { paidFromAccountId: input.paidFromAccountId } : {})
        }
      })

      return { transaction, newStatus }
    })

    // Log Activity
    logActivitySafe({
        action: 'PAYMENT',
        subject: 'Purchase Order',
        userId: input.createdById,
        details: { 
            poId: po.id, 
            poNumber: po.poNumber,
            amount: input.amount,
            status: result.newStatus,
            transactionId: result.transaction.id
        }
    })

    return result.transaction
  }


  async getReports(type: 'CAPEX_OPEX' | 'TAX') {
     if (type === 'TAX') {
       // Input VAT from Purchase Orders
       // Start of year default
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
           totalAmount: true, // DPP
           createdAt: true,
           supplier: { select: { name: true } }
         },
         orderBy: { createdAt: 'desc' }
       })
       
       const summary = {
         totalPPN: pos.reduce((sum, po) => sum + po.ppnAmount, 0),
         details: pos
       }
       
       return summary
     }
     
     if (type === 'CAPEX_OPEX') {
       const startDate = new Date(new Date().getFullYear(), 0, 1) // This year default
       const endDate = new Date()

       return this.transactionRepo.getExpenseSummary(startDate, endDate)
    }
    return null
  }

  async transferFunds(data: {
    sourceAccountId: string
    destinationAccountId: string
    amount: number
    date: Date | string
    description?: string
    createdById: string
    categoryId: string
  }) {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Decrement Source Account
      await tx.financialAccount.update({
        where: { id: data.sourceAccountId },
        data: { balance: { decrement: data.amount } }
      })

      // 2. Increment Destination Account
      await tx.financialAccount.update({
        where: { id: data.destinationAccountId },
        data: { balance: { increment: data.amount } }
      })

      // 3. Create Outgoing Transaction (Source)
      await tx.transaction.create({
        data: {
          type: 'EXPENSE',
          amount: data.amount,
          date: new Date(data.date),
          description: data.description || 'Transfer Keluar',
          categoryId: data.categoryId,
          createdById: data.createdById,
          accountId: data.sourceAccountId,
          referenceId: 'TRANSFER'
        }
      })

      // 4. Create Incoming Transaction (Destination)
      await tx.transaction.create({
        data: {
          type: 'INCOME',
          amount: data.amount,
          date: new Date(data.date),
          description: data.description || 'Transfer Masuk',
          categoryId: data.categoryId,
          createdById: data.createdById,
          accountId: data.destinationAccountId,
          referenceId: 'TRANSFER'
        }
      })
      
      return { success: true }
    })

    // Log Activity
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

  async deleteTransaction(id: string, userId?: string) {
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({ where: { id } })
      if (!transaction) throw new Error('Transaksi tidak ditemukan')

      // Revert account balance if associated with an account
      if (transaction.accountId) {
        if (transaction.type === 'INCOME') {
          // Revert Income: Decrement
          await tx.financialAccount.update({
            where: { id: transaction.accountId },
            data: { balance: { decrement: transaction.amount } }
          })
        } else {
          // Revert Expense: Increment
          await tx.financialAccount.update({
            where: { id: transaction.accountId },
            data: { balance: { increment: transaction.amount } }
          })
        }
      }

      await tx.transaction.delete({ where: { id } })
      return transaction
    })

    // Log Activity
    if (userId) { // userId is optional because previous signature didn't have it, but we should supply it
        logActivitySafe({
            action: 'DELETE',
            subject: 'Finance Transaction',
            userId: userId,
            details: { 
                id: result.id, 
                amount: result.amount, 
                desc: result.description 
            }
        })
    }

    return result
  }
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

  async getAccounts() {
    return prisma.financialAccount.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })
  }
}

