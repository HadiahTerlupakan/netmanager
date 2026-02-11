import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await verifyAuth(req)
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const { id } = params
    if (!id) {
        return ApiErrors.badRequest('ID transaksi tidak tersedia')
    }

    const financeService = new FinanceService()
    await financeService.deleteTransaction(id, session.id)

    return apiSuccess(null, { message: 'Transaksi berhasil dihapus' })
  } catch (error: unknown) {
    console.error('Delete Transaction Error:', error)
    const message = error instanceof Error ? error.message : 'Gagal menghapus transaksi'
    if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('tidak ditemukan')) {
      return ApiErrors.notFound('Transaksi')
    }
    return ApiErrors.internalError(message)
  }
}
