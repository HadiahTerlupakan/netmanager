import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { z } from 'zod'

const accountSchema = z.object({
  name: z.string().min(1, 'Nama akun wajib diisi'),
  type: z.enum(['BANK', 'CASH', 'EWALLET', 'OTHER']),
  accountNumber: z.string().optional(),
  description: z.string().optional(),
  initialBalance: z.number().optional().default(0)
})

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const validation = accountSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: validation.error.format() },
        { status: 400 }
      )
    }

    const financeService = new FinanceService()
    const { accountNumber, description, ...rest } = validation.data
    const account = await financeService.createAccount({
        ...rest,
        ...(accountNumber ? { accountNumber } : {}),
        ...(description ? { description } : {})
    })

    return NextResponse.json({ success: true, data: account })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error')
    console.error('Create Account Error:', err)
    return NextResponse.json(
      { error: err.message || 'Terjadi kesalahan saat membuat akun' },
      { status: 500 }
    )
  }
}
