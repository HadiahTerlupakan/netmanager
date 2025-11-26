import { NextRequest, NextResponse } from 'next/server'
import { getTagihanRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/finance/stats
 * Get finance statistics (total tagihan, belum lunas, terlambat, dll)
 * Bisa diakses oleh FINANCE atau ADMIN
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-finance-token')

    if (!token) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 401 })
    }

    // Verify token
    try {
      const tokenData = Buffer.from(token, 'base64').toString('utf8')
      const [userId] = tokenData.split(':')

      if (!userId) {
        return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
      }

      // Check token expiry
      const [, timestamp] = tokenData.split(':')
      const tokenTime = parseInt(timestamp)
      const now = Date.now()
      const tokenAge = now - tokenTime
      const maxAge = 24 * 60 * 60 * 1000

      if (tokenAge > maxAge) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 })
      }

      // Verify user exists and has FINANCE or ADMIN role
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

