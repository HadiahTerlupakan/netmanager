import { prisma } from '@/lib/prisma'
import { prismaBilling } from '@/lib/prisma-billing';
import UnpaidBillsClient from './UnpaidBillsClient'

export const dynamic = 'force-dynamic'

export default async function UnpaidBillsPage() {
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

  const categories = await prismaBilling.transactionCategory.findMany({
    where: { type: 'EXPENSE' },
    orderBy: { name: 'asc' }
  })

  const accounts = await prisma.financialAccount.findMany({
    where: { isActive: true },
    orderBy: { type: 'asc' }
  })

  return <UnpaidBillsClient initialData={unpaidPos as any} categories={categories} accounts={accounts} />
}
