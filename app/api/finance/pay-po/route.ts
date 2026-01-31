import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(req: NextRequest) {
  const session = await verifyAuth(req)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const json = await req.json()
    const result = payPoSchema.safeParse(json)

    if (!result.success) {
        return new NextResponse(result.error.issues[0]?.message || 'Validasi gagal', { status: 400 })
    }

    const { poId, categoryId, date, amount, notes, paidFromAccountId } = result.data

    const transaction = await financeService.payPurchaseOrder({
      poId,
      categoryId,
      date,
      amount,
      createdById: session.id,
      ...(notes ? { notes } : {}),
      ...(paidFromAccountId ? { paidFromAccountId } : {})
    })

    return NextResponse.json(transaction)

  } catch (error: unknown) {
    console.error('Error paying PO:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return new NextResponse(message, { status: 500 })
  }
}
