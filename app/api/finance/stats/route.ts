import { NextRequest, NextResponse } from 'next/server'
import { getTagihanRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { FinanceAuthService } from '@/lib/services/FinanceAuthService'

/**
 * GET /api/finance/stats
 * Get finance statistics (total tagihan, belum lunas, terlambat, dll)
 * Bisa diakses oleh FINANCE atau ADMIN
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

    // Verify user has FINANCE or ADMIN permissions
    const hasFinanceAccess = authResult.user?.permissions?.includes('FINANCE') ||
                            authResult.user?.permissions?.includes('ADMIN') ||
                            false
    if (!hasFinanceAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const tagihanRepo = getTagihanRepository()
    const allTagihans = await tagihanRepo.findAll()

    // Calculate statistics
    const totalTagihan = allTagihans.length
    const belumLunas = allTagihans.filter(t => t.status === 'BELUM_LUNAS').length
    const terlambat = allTagihans.filter(t => t.status === 'TERLAMBAT').length
    const lunas = allTagihans.filter(t => t.status === 'LUNAS').length

    const totalBelumLunas = allTagihans
      .filter(t => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT')
      .reduce((sum, t) => sum + t.total, 0)

    const totalLunas = allTagihans
      .filter(t => t.status === 'LUNAS')
      .reduce((sum, t) => sum + t.total, 0)

    // Get current month/year stats
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const tagihanBulanIni = allTagihans.filter(
      t => t.periodeBulan === currentMonth && t.periodeTahun === currentYear
    )

    const totalBulanIni = tagihanBulanIni.reduce((sum, t) => sum + t.total, 0)
    const lunasBulanIni = tagihanBulanIni.filter(t => t.status === 'LUNAS').length
    const belumLunasBulanIni = tagihanBulanIni.filter(t => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT').length

    // Get total pelanggan
    const totalPelanggan = await prisma.pelanggan.count()
    const pelangganAktif = await prisma.pelanggan.count({
      where: { status: 'AKTIF' },
    })

    return NextResponse.json({
      overview: {
        totalTagihan,
        belumLunas,
        terlambat,
        lunas,
      },
      financial: {
        totalBelumLunas,
        totalLunas,
        totalBulanIni,
        lunasBulanIni,
        belumLunasBulanIni,
      },
      pelanggan: {
        total: totalPelanggan,
        aktif: pelangganAktif,
      },
    })
  } catch (error: any) {
    console.error('Error fetching finance stats:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

