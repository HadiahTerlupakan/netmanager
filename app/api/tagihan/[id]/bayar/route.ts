import { NextRequest, NextResponse } from 'next/server'
import { updateStatusPembayaran } from '@/lib/services/tagihan-service'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

/**
 * PUT /api/tagihan/[id]/bayar
 * Update status pembayaran tagihan (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { metodePembayaran, catatan } = body

    await updateStatusPembayaran(id, metodePembayaran, catatan)

    return NextResponse.json({ message: 'Status pembayaran berhasil diupdate' })
  } catch (error: any) {
    console.error('Error updating payment status:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

