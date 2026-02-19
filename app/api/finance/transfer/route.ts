import { FinanceService } from '@/modules/finance/services/FinanceService'
import { z } from 'zod'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

const transferSchema = z.object({
  sourceAccountId: z.string().min(1, 'Akun asal wajib diisi'),
  destinationAccountId: z.string().min(1, 'Akun tujuan wajib diisi'),
  amount: z.number().min(1, 'Nominal harus lebih dari 0'),
  date: z.string().or(z.date()),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Kategori wajib diisi')
})

export const POST = createHandler({
    auth: true,
    schema: transferSchema
}, async (req, ctx) => {
    const { sourceAccountId, destinationAccountId, amount, date, description, categoryId } = ctx.validated

    if (sourceAccountId === destinationAccountId) {
         return ApiErrors.badRequest('Akun asal dan tujuan tidak boleh sama')
    }

    const financeService = new FinanceService()
    
    try {
        await financeService.transferFunds({
          sourceAccountId,
          destinationAccountId,
          amount,
          date,
          createdById: ctx.session!.user.id,
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
        throw error // Let createHandler handle unknown errors
    }
})
