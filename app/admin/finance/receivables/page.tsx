import { prisma } from '@/lib/prisma'
import ReceivablesClient from './ReceivablesClient'

export const dynamic = 'force-dynamic'

export default async function ReceivablesPage() {
  // Fetch Invoices that are SENT or OVERDUE (Unpaid/Partial)
  // We can also include PARTIAL if available, but schema current shows SENT/OVERDUE/PAID/DRAFT/CANCELLED
  // Assuming SENT and OVERDUE are the ones representing Receivables.
  
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
      dueDate: 'asc' // Show urgent (due soonest) first
    }
  })

  // Basic serialization if needed (BigInt handling)
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
