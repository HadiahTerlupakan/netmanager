import { NextResponse } from 'next/server'
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

export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req as any)
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
    const account = await financeService.createAccount(validation.data)

    return NextResponse.json({ success: true, data: account })
  } catch (error: any) {
    console.error('Create Account Error:', error)
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat membuat akun' },
      { status: 500 }
    )
  }
}
