import { NextRequest, NextResponse } from 'next/server'
import { getTagihanRepository } from '@/lib/repositories'

/**
 * GET /api/finance/tagihan
 * List semua tagihan untuk finance (bisa diakses oleh FINANCE atau ADMIN)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-finance-token')

    if (!token) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 401 })
    }

    // Verify token (sederhana, bisa di-upgrade nanti)
    try {
      const tokenData = Buffer.from(token, 'base64').toString('utf8')
      const [userId] = tokenData.split(':')

      if (!userId) {
        return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
      }

      // Check token expiry (24 hours)
      const [, timestamp] = tokenData.split(':')
      const tokenTime = parseInt(timestamp)
      const now = Date.now()
      const tokenAge = now - tokenTime
      const maxAge = 24 * 60 * 60 * 1000

      if (tokenAge > maxAge) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 })
      }

      // Verify user exists and has FINANCE or ADMIN role
      const { prisma } = await import('@/lib/prisma')
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      const allowedRoles = ['FINANCE', 'ADMIN'] as const
      if (!user || !allowedRoles.includes(user.role as any)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    } catch (parseError) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
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

