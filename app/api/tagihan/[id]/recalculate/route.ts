import { NextRequest, NextResponse } from 'next/server'
import { recalculateTagihan } from '@/lib/services/tagihan-service'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

/**
 * POST /api/tagihan/[id]/recalculate
 * Recalculate tagihan dengan perhitungan terbaru (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await recalculateTagihan(id)

    return NextResponse.json({ message: 'Tagihan berhasil di-recalculate' })
  } catch (error: any) {
    console.error('Error recalculating tagihan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}










