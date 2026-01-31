import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { FinanceService } from '@/modules/finance/services/FinanceService'

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await verifyAuth(req)
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
  } catch (error: unknown) {
    console.error('Delete Transaction Error:', error)
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus transaksi'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
