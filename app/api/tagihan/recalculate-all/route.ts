import { NextRequest, NextResponse } from 'next/server'
import { recalculateAllUnpaidTagihan } from '@/lib/services/tagihan-service'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

/**
 * POST /api/tagihan/recalculate-all
 * Recalculate semua tagihan yang belum lunas dengan perhitungan terbaru (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await recalculateAllUnpaidTagihan()

    return NextResponse.json({
      message: `Recalculate selesai. Berhasil: ${result.success}, Gagal: ${result.failed}`,
      ...result,
    })
  } catch (error: any) {
    console.error('Error recalculating all tagihan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}










