import { prisma } from '@/modules/database'
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

  const accounts = await prisma.financialAccount.findMany({
    where: { isActive: true },
    orderBy: { type: 'asc' }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <UnpaidBillsClient initialData={unpaidPos as any} accounts={accounts} />
}
