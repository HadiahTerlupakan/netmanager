import { prisma } from '@/lib/prisma'
import { prismaBilling } from '@/lib/prisma-billing';
import ReceivablesClient from './ReceivablesClient'

export const dynamic = 'force-dynamic'

export default async function ReceivablesPage() {
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

  // Basic serialization if needed (BigInt handling)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedData = receivables.map((inv: any) => ({
    ...inv,
    totalAmount: Number(inv.totalAmount),
    paidAmount: Number(inv.paidAmount),
    subtotal: Number(inv.subtotal),
    taxAmount: Number(inv.taxAmount),
    discountAmount: Number(inv.discountAmount)
  }))

  return <ReceivablesClient initialData={formattedData} />
}
