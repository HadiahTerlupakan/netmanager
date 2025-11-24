import { NextRequest, NextResponse } from 'next/server'
import { generateTagihan } from '@/lib/services/tagihan-service'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

/**
 * POST /api/tagihan/generate
 * Generate tagihan untuk pelanggan tertentu (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { pelangganId, periodeBulan, periodeTahun } = body

    if (!pelangganId || !periodeBulan || !periodeTahun) {
      return NextResponse.json(
        { error: 'pelangganId, periodeBulan, dan periodeTahun harus diisi' },
        { status: 400 },
      )
    }

    const result = await generateTagihan(pelangganId, periodeBulan, periodeTahun)

    return NextResponse.json({
      message: 'Tagihan berhasil digenerate',
      id: result.id,
    })
  } catch (error: any) {
    console.error('Error generating tagihan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

