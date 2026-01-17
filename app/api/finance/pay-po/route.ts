import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { z } from 'zod'
import { FinanceService } from '@/modules/finance/services/FinanceService'

const financeService = new FinanceService()

const payPoSchema = z.object({
  poId: z.string().min(1),
  categoryId: z.string().min(1, 'Kategori transaksi wajib dipilih'),
  date: z.string().or(z.date()), // Payment date
  amount: z.number().min(1),
  notes: z.string().optional(),
  paidFromAccountId: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await verifyAuth(req as any)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const json = await req.json()
    const result = payPoSchema.safeParse(json)
    
    if (!result.success) {
        return new NextResponse(result.error.issues[0].message, { status: 400 })
    }

    const { poId, categoryId, date, amount, notes, paidFromAccountId } = result.data

    const transaction = await financeService.payPurchaseOrder({
      poId,
      categoryId,
      date,
      amount,
      notes,
      createdById: session.id,
      paidFromAccountId
    })

    return NextResponse.json(transaction)

  } catch (error: any) {
    console.error('Error paying PO:', error)
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 })
  }
}
