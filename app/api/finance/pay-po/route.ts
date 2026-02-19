import { z } from 'zod'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

const financeService = new FinanceService()

const payPoSchema = z.object({
  poId: z.string().min(1, 'ID Purchase Order wajib diisi'),
  categoryId: z.string().min(1, 'Kategori transaksi wajib dipilih'),
  date: z.string().or(z.date()),
  amount: z.number().min(1, 'Jumlah pembayaran harus lebih dari 0'),
  notes: z.string().optional(),
  paidFromAccountId: z.string().optional(),
})

export const POST = createHandler({
    auth: true,
    schema: payPoSchema
}, async (req, ctx) => {
    const { poId, categoryId, date, amount, notes, paidFromAccountId } = ctx.validated

    try {
        const transaction = await financeService.payPurchaseOrder({
          poId,
          categoryId,
          date,
          amount,
          createdById: ctx.session!.user.id,
          ...(notes ? { notes } : {}),
          ...(paidFromAccountId ? { paidFromAccountId } : {})
        })

        return apiSuccess(transaction, { message: 'Pembayaran PO berhasil dicatat' })
    } catch (error: unknown) {
        console.error('Error paying PO:', error)
        const message = error instanceof Error ? error.message : 'Gagal memproses pembayaran PO'
        if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('tidak ditemukan')) {
          return ApiErrors.notFound('Purchase Order')
        }
        throw error
    }
})
