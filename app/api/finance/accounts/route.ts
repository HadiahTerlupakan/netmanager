import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { z } from 'zod'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

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
      return ApiErrors.unauthorized()
    }

    const body = await req.json()
    const validation = accountSchema.safeParse(body)

    if (!validation.success) {
      return ApiErrors.badRequest('Validasi gagal', { details: validation.error.format() as unknown as Record<string, unknown> })
    }

    const financeService = new FinanceService()
    const { accountNumber, description, ...rest } = validation.data
    const account = await financeService.createAccount({
        ...rest,
        ...(accountNumber ? { accountNumber } : {}),
        ...(description ? { description } : {})
    })

    return apiSuccess(account, { status: 201, message: 'Akun berhasil dibuat' })
  } catch (error: unknown) {
    console.error('Create Account Error:', error)
    const message = error instanceof Error ? error.message : 'Gagal membuat akun keuangan'
    return ApiErrors.internalError(message)
  }
}
