import { prisma } from '@/lib/prisma'
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
      supplier: true,
      transactions: {
        where: { type: 'EXPENSE' }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // 2. Fetch AR Data (Sent/Overdue Invoices)
  const receivables = await prisma.invoice.findMany({
    where: {
      status: {
        in: ['SENT', 'OVERDUE']
      }
    },
    include: {
      pelanggan: {
        select: {
          id: true,
          nama: true,
          idPelanggan: true
        }
      }
    },
    orderBy: {
      dueDate: 'asc'
    }
  })

  // 3. Fetch Dependencies (Categories, Accounts) for AP Actions
  const categories = await prisma.transactionCategory.findMany({
    where: { type: 'EXPENSE' },
    orderBy: { name: 'asc' }
  })

  const accounts = await prisma.financialAccount.findMany({
    where: { isActive: true },
    orderBy: { type: 'asc' }
  })

  // Serialization
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedReceivables = receivables.map((inv: any) => ({
    ...inv,
    totalAmount: Number(inv.totalAmount),
    paidAmount: Number(inv.paidAmount),
    subtotal: Number(inv.subtotal),
    taxAmount: Number(inv.taxAmount),
    discountAmount: Number(inv.discountAmount)
  }))

  return (
    <DebtsReceivablesClient 
        unpaidData={unpaidPos}
        receivablesData={formattedReceivables}
        categories={categories}
        accounts={accounts}
    />
  )
}
