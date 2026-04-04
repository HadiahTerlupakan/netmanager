import { prisma } from '@/lib/prisma'
import type { PrismaClient, PurchaseOrder, FinancialAccount } from '@prisma/client'
import type { Prisma, PaymentStatus } from '@prisma/client'

export class PurchaseOrderRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findById(id: string) {
    return this.client.purchaseOrder.findUnique({ where: { id } })
  }

  async update(id: string, data: {
    paymentStatus?: PaymentStatus
    paidFromAccountId?: string
  }) {
    return this.client.purchaseOrder.update({ where: { id }, data })
  }

  async findManyWithTax(where: Prisma.PurchaseOrderWhereInput) {
    return this.client.purchaseOrder.findMany({
      where,
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
  }

  async updateBalanceInTx(tx: PrismaClient, accountId: string, amount: number): Promise<FinancialAccount> {
    return tx.financialAccount.update({
      where: { id: accountId },
      data: { balance: { decrement: amount } }
    })
  }

  async findUniqueFinancialAccountInTx(tx: PrismaClient, id: string): Promise<FinancialAccount | null> {
    return tx.financialAccount.findUnique({ where: { id } })
  }

  async processPaymentTransaction(input: {
    poId: string
    po: PurchaseOrder
    amount: number
    date: Date
    notes?: string
    paidFromAccountId?: string
  }) {
    return this.client.$transaction(async (tx) => {
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
          date: input.date,
          description: input.notes || `Pembayaran PO #${input.po.poNumber}`,
          invoiceNumber: input.po.poNumber
        }
      })

      const existingExpenses = await tx.expense.findMany({
        where: { invoiceNumber: input.po.poNumber }
      })

      const totalPaid = existingExpenses.reduce((sum: number, e) => sum + Number(e.amount), 0)
      let newStatus: PaymentStatus = 'UNPAID'
      const targetAmount = input.po.grandTotal > 0 ? input.po.grandTotal : input.po.totalAmount

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
  }
}
