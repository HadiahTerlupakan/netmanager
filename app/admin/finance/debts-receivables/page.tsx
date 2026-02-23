import { prisma } from '@/lib/prisma'
import { prismaBilling } from '@/lib/prisma-billing';
import DebtsReceivablesClient from './DebtsReceivablesClient'

export const dynamic = 'force-dynamic'

export default async function DebtsReceivablesPage() {
  // 1. Fetch AP Data (Unpaid POs)
  const unpaidPos = await prisma.purchaseOrder.findMany({
    where: {
      status: { in: ['ORDERED', 'RECEIVED', 'PARTIAL'] },
      paymentStatus: { not: 'PAID' }
    },
    include: {
      supplier: true
    },
    orderBy: { createdAt: 'desc' }
  })

  // 2. Fetch AR Data (Sent/Overdue Invoices)
  const receivables = await prismaBilling.invoice.findMany({
    where: {
      status: {
        in: ['SENT', 'OVERDUE']
      }
    },
    orderBy: {
      dueDate: 'asc'
    }
  })

  // 3. Fetch Dependencies (Categories, Accounts) for AP Actions
  const expenseCategories = await prismaBilling.transactionCategory.findMany({
    where: { type: 'EXPENSE' }
  })

  const accounts = await prisma.financialAccount.findMany()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Hutang & Piutang</h1>
      {/* eslint-disable @typescript-eslint/no-explicit-any */}
      <DebtsReceivablesClient
        unpaidData={unpaidPos as any}
        receivablesData={receivables as any}
        categories={expenseCategories as any}
        accounts={accounts as any}
      />
    </div>
  )
}
