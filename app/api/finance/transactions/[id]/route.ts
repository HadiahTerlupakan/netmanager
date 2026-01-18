import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { FinanceService } from '@/modules/finance/services/FinanceService'

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await verifyAuth(req as any)
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { id } = params
    if (!id) {
        return new NextResponse('Missing ID', { status: 400 })
    }

    const financeService = new FinanceService()
    await financeService.deleteTransaction(id, session.id)

    return NextResponse.json({ success: true, message: 'Transaksi berhasil dihapus' })
  } catch (error: any) {
    console.error('Delete Transaction Error:', error)
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat menghapus transaksi' },
      { status: 500 }
    )
  }
}
