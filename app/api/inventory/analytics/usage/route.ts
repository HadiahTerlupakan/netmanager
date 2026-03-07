import { NextRequest } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/datetime'


async function requireAdmin() {
  const session = await getServerSession(authConfig) as Session | null
  if (!session) {
    return null
  }
  return session
}

/**
 * GET /api/inventory/analytics/usage
 * Get usage analytics for a specific barang and gudang
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/analytics/usage')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const days = parseInt(searchParams.get('days') || '30')

    if (!barangId || !gudangId) {
      return apiError('Barang ID dan Gudang ID harus diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    try {
      const dbStart = Date.now()

      // Calculate start date
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      // Get usage data from barang keluar
      const usageData = await prisma.barangKeluar.aggregate({
        where: {
          barangId,
          gudangId,
          tanggal: {
            gte: startDate
          }
        },
        _sum: {
          jumlah: true
        },
        _count: {
          id: true
        }
      })

      // Get monthly usage trend (last 6 months)
      const monthlyUsage = []
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date()
        monthStart.setMonth(monthStart.getMonth() - i, 1)
        monthStart.setTime(toStartOfDay(monthStart).getTime())

        const monthEnd = new Date(monthStart)
        monthEnd.setMonth(monthEnd.getMonth() + 1)
        monthEnd.setDate(0)
        monthEnd.setTime(toEndOfDay(monthEnd).getTime())

        const monthData = await prisma.barangKeluar.aggregate({
          where: {
            barangId,
            gudangId,
            tanggal: {
              gte: monthStart,
              lte: monthEnd
            }
          },
          _sum: {
            jumlah: true
          }
        })

        monthlyUsage.push({
          month: monthStart.toLocaleString('id-ID', { month: 'short', year: 'numeric' }),
          usage: monthData._sum.jumlah || 0
        })
      }

      // Get current stock
      const currentStock = await prisma.barangGudang.findUnique({
        where: {
          barangId_gudangId: { barangId, gudangId }
        }
      })

      // Calculate metrics
      const totalUsage = usageData._sum.jumlah || 0
      const avgDailyUsage = totalUsage / days
      const avgPerTransaction = usageData._count.id > 0 ? totalUsage / usageData._count.id : 0

      // Calculate usage trend
      let usageTrend: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE'
      if (monthlyUsage.length >= 3) {
        const recentAvg = monthlyUsage.slice(-2).reduce((sum, m) => sum + m.usage, 0) / 2
        const olderAvg = monthlyUsage.slice(0, 2).reduce((sum, m) => sum + m.usage, 0) / 2

        if (recentAvg > olderAvg * 1.1) usageTrend = 'INCREASING'
        else if (recentAvg < olderAvg * 0.9) usageTrend = 'DECREASING'
      }

      logger.dbOperation('aggregate', 'BarangKeluar+MonthlyAnalytics', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/analytics/usage', 200, Date.now() - startTime, {
        userId: session.user.id,
        barangId,
        gudangId,
        days,
        totalUsage,
        avgDailyUsage,
      })

      return apiSuccess({
        barangId,
        gudangId,
        days,
        totalUsage,
        avgDailyUsage,
        avgPerTransaction,
        transactionCount: usageData._count.id,
        currentStock: currentStock?.stok || 0,
        usageTrend,
        monthlyUsage,
        lastCalculated: new Date().toISOString()
      })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error
    logger.error('Error fetching usage analytics', err, {
      path: '/api/inventory/analytics/usage',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat analisis penggunaan')
  }
}