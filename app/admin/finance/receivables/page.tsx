import { prismaBilling } from '@/lib/prisma-billing';
import ReceivablesClient from './ReceivablesClient'

export const dynamic = 'force-dynamic'

export default async function ReceivablesPage() {
  const receivables = await prismaBilling.invoice.findMany({
    orderBy: {
      dueDate: 'desc'
    },
    include: {
      payment: true
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
    discountAmount: Number(inv.discountAmount),
    payment: inv.payment?.map((p: any) => ({
      ...p,
      amount: Number(p.amount)
    })) || []
  }))

  return <ReceivablesClient initialData={formattedData} />
}
