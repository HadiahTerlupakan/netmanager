import { NextRequest, NextResponse } from 'next/server'
import { getTagihanRepository } from '@/lib/repositories'
import { FinanceAuthService } from '@/lib/services/FinanceAuthService'

/**
 * GET /api/finance/tagihan
 * List semua tagihan untuk finance (bisa diakses oleh FINANCE atau ADMIN)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify JWT token using FinanceAuthService
    const authResult = await FinanceAuthService.authenticate(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        error: authResult.error || 'Unauthorized'
      }, { status: 401 })
    }

    // Verify user has FINANCE or ADMIN role
    const allowedRoles = ['FINANCE', 'ADMIN'] as const
    if (!allowedRoles.includes(authResult.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
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

