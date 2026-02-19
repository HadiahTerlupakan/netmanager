import { FinanceService } from '@/modules/finance/services/FinanceService'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params
    if (!id) {
        return ApiErrors.badRequest('ID transaksi tidak tersedia')
    }

    const financeService = new FinanceService()
    try {
        await financeService.deleteTransaction(id, ctx.session!.user.id)
        return apiSuccess(null, { message: 'Transaksi berhasil dihapus' })
    } catch (error: unknown) {
        console.error('Delete Transaction Error:', error)
        const message = error instanceof Error ? error.message : 'Gagal menghapus transaksi'
        if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('tidak ditemukan')) {
          return ApiErrors.notFound('Transaksi')
        }
        throw error
    }
})
