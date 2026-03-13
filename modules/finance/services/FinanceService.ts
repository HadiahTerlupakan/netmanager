import { prisma } from '@/lib/prisma'
import { type PaymentStatus } from '@prisma/client'
import { logActivitySafe } from '@/lib/logger'

export class FinanceService {
  constructor() {}

// Function createTransaction dihapus karena tidak relevan  

  /**
   * Process payment for a Purchase Order
   * Wraps transaction creation and PO status update in a database transaction
   */
  async payPurchaseOrder(input: {
    poId: string
    amount: number
    date: Date | string
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

      // Create Expense record
      const expense = await tx.expense.create({
        data: {
          category: 'Purchase Order Payment',
          amount: input.amount,
          date: new Date(input.date),
          description: input.notes || `Pembayaran PO #${po.poNumber}` + (input.paidFromAccountId ? ` (dari Akun: ${input.paidFromAccountId})` : ''),
          invoiceNumber: po.poNumber
        }
      })

      // Calculate new Payment Status
      // Fetch all expenses for this PO (including the one just created)
      const existingExpenses = await tx.expense.findMany({
        where: { invoiceNumber: po.poNumber } // Menggunakan invoiceNumber sbg reference ke poNumber
      })

      const totalPaid = existingExpenses.reduce((sum: number, e) => sum + Number(e.amount), 0)

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

      return { expense, newStatus }
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
        expenseId: result.expense.id
      }
    })

    return result.expense
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
        totalPPN: pos.reduce((sum: number, po) => sum + Number(po.ppnAmount), 0),
        details: pos
      }

      return summary
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

      // Catatan: Pembuatan riwayat dihilangkan karena Transaction dihapus

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

// Function deleteTransaction dihapus karena transaction telah dihapus dari DB
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

