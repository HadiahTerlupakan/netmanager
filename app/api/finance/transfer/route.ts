import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { z } from 'zod'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

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
      return ApiErrors.unauthorized()
    }

    const body = await req.json()
    const validation = transferSchema.safeParse(body)

    if (!validation.success) {
      return ApiErrors.badRequest(validation.error.issues[0]?.message || 'Validasi gagal')
    }

    const { sourceAccountId, destinationAccountId, amount, date, description, categoryId } = validation.data

    if (sourceAccountId === destinationAccountId) {
         return ApiErrors.badRequest('Akun asal dan tujuan tidak boleh sama')
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

    return apiSuccess(null, { message: 'Transfer berhasil' })
  } catch (error: unknown) {
    console.error('Transfer Error:', error)
    const message = error instanceof Error ? error.message : 'Gagal memproses transfer'
    if (message.toLowerCase().includes('insufficient') || message.toLowerCase().includes('saldo tidak cukup')) {
      return ApiErrors.badRequest('Saldo tidak cukup untuk melakukan transfer')
    }
    return ApiErrors.internalError(message)
  }
}
