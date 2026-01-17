import { NextResponse } from 'next/server'
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

export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req as any)
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
      description,
      createdById: session.id,
      categoryId
    })

    return NextResponse.json({ success: true, message: 'Transfer berhasil' })
  } catch (error: any) {
    console.error('Transfer Error:', error)
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat memproses transfer' },
      { status: 500 }
    )
  }
}
