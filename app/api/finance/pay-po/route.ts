import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { z } from 'zod'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

const financeService = new FinanceService()

const payPoSchema = z.object({
  poId: z.string().min(1, 'ID Purchase Order wajib diisi'),
  categoryId: z.string().min(1, 'Kategori transaksi wajib dipilih'),
  date: z.string().or(z.date()),
  amount: z.number().min(1, 'Jumlah pembayaran harus lebih dari 0'),
  notes: z.string().optional(),
  paidFromAccountId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized()

    const json = await req.json()
    const result = payPoSchema.safeParse(json)

    if (!result.success) {
        return ApiErrors.badRequest(result.error.issues[0]?.message || 'Validasi gagal')
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

    return apiSuccess(transaction, { message: 'Pembayaran PO berhasil dicatat' })

  } catch (error: unknown) {
    console.error('Error paying PO:', error)
    const message = error instanceof Error ? error.message : 'Gagal memproses pembayaran PO'
    if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('tidak ditemukan')) {
      return ApiErrors.notFound('Purchase Order')
    }
    return ApiErrors.internalError(message)
  }
}
