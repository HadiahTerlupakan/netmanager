import { NextRequest, NextResponse } from 'next/server'
import { getTagihanRepository } from '@/lib/repositories'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

/**
 * GET /api/tagihan
 * List semua tagihan (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
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

    return NextResponse.json(tagihans, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error fetching tagihan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

