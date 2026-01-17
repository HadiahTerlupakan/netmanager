import { prisma } from '@/lib/prisma'
import UnpaidBillsClient from './UnpaidBillsClient'

export const dynamic = 'force-dynamic'

export default async function UnpaidBillsPage() {
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

  const categories = await prisma.transactionCategory.findMany({
    where: { type: 'EXPENSE' },
    orderBy: { name: 'asc' }
  })

  const accounts = await prisma.financialAccount.findMany({
    where: { isActive: true },
    orderBy: { type: 'asc' }
  })

  // Serialize BigInt if any (none here mostly, but good practice if Amount was BigInt)
  // FinancialAccount balance is Float. Transaction amount is Float. PO amounts are Float.

  return <UnpaidBillsClient initialData={unpaidPos} categories={categories} accounts={accounts} />
}
