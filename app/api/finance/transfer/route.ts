import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { z } from 'zod'

const transferSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun asal wajib diisi'),
  destinationAccountId: z.string().min(1, 'Akun tujuan wajib diisi'),
  amount: z.number().min(1, 'Nominal harus lebih dari 0'),
  date: z.string().or(z.date()),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Kategori wajib diisi')
})

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const validation = transferSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { sourceAccountId, destinationAccountId, amount, date, description, categoryId } = validation.data

    if (sourceAccountId === destinationAccountId) {
         return NextResponse.json(
            { error: 'Akun asal dan tujuan tidak boleh sama' },
            { status: 400 }
          )
    }

    const financeService = new FinanceService()
    await financeService.transferFunds({
      sourceAccountId,
      destinationAccountId,
      amount,
      date,
      createdById: session.id,
      categoryId,
      ...(description ? { description } : {})
    })

    return NextResponse.json({ success: true, message: 'Transfer berhasil' })
  } catch (error: unknown) {
    console.error('Transfer Error:', error)
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses transfer'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
