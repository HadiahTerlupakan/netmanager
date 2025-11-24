import { NextRequest, NextResponse } from 'next/server'
import { getTagihanRepository } from '@/lib/repositories'
import { generateTagihanBulanan } from '@/lib/services/tagihan-service'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

/**
 * GET /api/tagihan
 * List semua tagihan (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const periodeBulan = searchParams.get('periodeBulan')
    const periodeTahun = searchParams.get('periodeTahun')

    const tagihanRepo = getTagihanRepository()

    let tagihans
    if (status) {
      tagihans = await tagihanRepo.findByStatus(status as any)
    } else if (periodeBulan && periodeTahun) {
      tagihans = await tagihanRepo.findByPeriode(
        parseInt(periodeBulan),
        parseInt(periodeTahun),
      )
    } else {
      tagihans = await tagihanRepo.findAll()
    }

    return NextResponse.json(tagihans)
  } catch (error: any) {
    console.error('Error fetching tagihan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/tagihan
 * Generate tagihan bulanan untuk semua pelanggan aktif (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { periodeBulan, periodeTahun } = body

    if (!periodeBulan || !periodeTahun) {
      return NextResponse.json(
        { error: 'periodeBulan dan periodeTahun harus diisi' },
        { status: 400 },
      )
    }

    const result = await generateTagihanBulanan(periodeBulan, periodeTahun)

    return NextResponse.json({
      message: 'Tagihan berhasil digenerate',
      ...result,
    })
  } catch (error: any) {
    console.error('Error generating tagihan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

