import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { Prisma } from '@prisma/client'

interface PredictionResult {
  barangId: string
  gudangId: string
  barangKode: string
  barangNama: string
  satuan: string
  gudangKode: string
  gudangNama: string
  currentStok: number
  minStok: number
  maxStok: number
  avgDailyUsage: number
  leadTimeDays: number
  safetyStok: number
  daysUntilStockout: number
  reorderPoint: number
  recommendedOrderQty: number
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  lastRestockDate?: string
  usageTrend: 'INCREASING' | 'DECREASING' | 'STABLE'
  monthlyUsage: number[]
  nextRestockDate: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

/**
 * GET /api/inventory/restock/prediction
 * Generate restock predictions
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/restock/prediction')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("restock:read"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat prediksi restock')
    }

    const searchParams = req.nextUrl.searchParams
    const gudangId = searchParams.get('gudangId')
    const days = parseInt(searchParams.get('days') || '90') // Analysis period in days

    try {
      const dbStart = Date.now()

      // Get all restock settings
      const whereClause: Prisma.RestockSettingsWhereInput = { isActive: true }
      if (gudangId) whereClause.gudangId = gudangId

      const settings = await prisma.restockSettings.findMany({
        where: whereClause,
        include: {
          barang: {
            select: {
              id: true,
              kode: true,
              nama: true,
              satuan: true
            }
          },
          gudang: {
            select: {
              id: true,
              kode: true,
              nama: true
            }
          }
        }
      })

      const predictions: PredictionResult[] = []

      for (const setting of settings) {
        // Get current stock
        const currentStock = await prisma.barangGudang.findUnique({
          where: {
            barangId_gudangId: {
              barangId: setting.barangId,
              gudangId: setting.gudangId
            }
          }
        })

        const currentStok = currentStock?.stok || 0

        // Get monthly usage data for trend analysis
        const monthlyUsage = await getMonthlyUsage(setting.barangId, setting.gudangId, 6) // Last 6 months

        // Get last restock date
        const lastRestock = await prisma.barangMasuk.findFirst({
          where: {
            barangId: setting.barangId,
            gudangId: setting.gudangId,
            transferId: null // Exclude transfers, only actual restocks
          },
          orderBy: { tanggal: 'desc' }
        })

        // Calculate daily usage trend
        const analysisStartDate = new Date()
        analysisStartDate.setDate(analysisStartDate.getDate() - days)

        const recentUsage = await prisma.barangKeluar.aggregate({
          where: {
            barangId: setting.barangId,
            gudangId: setting.gudangId,
            tanggal: {
              gte: analysisStartDate
            }
          },
          _sum: {
            jumlah: true
          },
          _count: {
            id: true
          }
        })

        // Update average daily usage
        const calculatedAvgDailyUsage = recentUsage._sum.jumlah ? recentUsage._sum.jumlah / days : 0

        // Update setting with new calculation
        if (calculatedAvgDailyUsage !== setting.avgDailyUsage) {
          await prisma.restockSettings.update({
            where: { id: setting.id },
            data: {
              avgDailyUsage: calculatedAvgDailyUsage,
              lastUsageCalculation: new Date()
            }
          })
        }

        const avgDailyUsage = calculatedAvgDailyUsage

        // Calculate days until stockout
        const daysUntilStockout = avgDailyUsage > 0 ? Math.floor(currentStok / avgDailyUsage) : 999

        // Calculate reorder point (min stock + safety stock + usage during lead time)
        const usageDuringLeadTime = Math.ceil(avgDailyUsage * setting.leadTimeDays)
        const reorderPoint = setting.minStok + setting.safetyStok + usageDuringLeadTime

        // Calculate recommended order quantity
        const recommendedOrderQty = Math.max(0, setting.maxStok - currentStok)

        // Determine urgency
        let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
        if (currentStok === 0) {
          urgency = 'CRITICAL'
        } else if (currentStok <= setting.minStok) {
          urgency = 'HIGH'
        } else if (daysUntilStockout <= setting.leadTimeDays) {
          urgency = 'HIGH'
        } else if (daysUntilStockout <= (setting.leadTimeDays * 2)) {
          urgency = 'MEDIUM'
        } else {
          urgency = 'LOW'
        }

        // Determine usage trend
        const usageTrend = calculateUsageTrend(monthlyUsage)

        // Calculate next restock date
        const nextRestockDate = new Date()
        if (avgDailyUsage > 0 && currentStok > 0) {
          nextRestockDate.setDate(nextRestockDate.getDate() + Math.max(0, daysUntilStockout - setting.leadTimeDays))
        } else {
          nextRestockDate.setDate(nextRestockDate.getDate() + setting.leadTimeDays)
        }

        // Calculate risk level
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
        if (daysUntilStockout <= setting.leadTimeDays) {
          riskLevel = 'HIGH'
        } else if (daysUntilStockout <= (setting.leadTimeDays * 2)) {
          riskLevel = 'MEDIUM'
        } else {
          riskLevel = 'LOW'
        }

        predictions.push({
          barangId: setting.barangId,
          gudangId: setting.gudangId,
          barangKode: setting.barang.kode,
          barangNama: setting.barang.nama,
          satuan: setting.barang.satuan,
          gudangKode: setting.gudang.kode,
          gudangNama: setting.gudang.nama,
          currentStok,
          minStok: setting.minStok,
          maxStok: setting.maxStok,
          avgDailyUsage,
          leadTimeDays: setting.leadTimeDays,
          safetyStok: setting.safetyStok,
          daysUntilStockout,
          reorderPoint,
          recommendedOrderQty,
          urgency,
          ...(lastRestock?.tanggal && { lastRestockDate: lastRestock.tanggal.toISOString() }),
          usageTrend,
          monthlyUsage,
          nextRestockDate: nextRestockDate.toISOString(),
          riskLevel
        })
      }

      // Sort by urgency and days until stockout
      predictions.sort((a, b) => {
        const urgencyOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
        const urgencyDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency]
        if (urgencyDiff !== 0) return urgencyDiff
        return a.daysUntilStockout - b.daysUntilStockout
      })

      logger.dbOperation('complex', 'RestockPrediction+Analytics', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/restock/prediction', 200, Date.now() - startTime, {
        userId: session.user.id,
        predictionsCount: predictions.length,
        days,
        gudangId,
      })

      return apiSuccess({
        predictions,
        summary: {
          totalItems: predictions.length,
          criticalItems: predictions.filter(p => p.urgency === 'CRITICAL').length,
          highPriorityItems: predictions.filter(p => p.urgency === 'HIGH').length,
          mediumPriorityItems: predictions.filter(p => p.urgency === 'MEDIUM').length,
          lowPriorityItems: predictions.filter(p => p.urgency === 'LOW').length,
          stockoutRiskItems: predictions.filter(p => p.daysUntilStockout <= 7).length
        }
      })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error')
    logger.error('Error generating restock predictions', err, {
      path: '/api/inventory/restock/prediction',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal membuat prediksi restock')
  }
}

async function getMonthlyUsage(barangId: string, gudangId: string, months: number): Promise<number[]> {
  const monthlyUsage: number[] = []

  for (let i = months - 1; i >= 0; i--) {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - i, 1)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)
    endDate.setDate(0)
    endDate.setHours(23, 59, 59, 999)

    const usage = await prisma.barangKeluar.aggregate({
      where: {
        barangId,
        gudangId,
        tanggal: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: {
        jumlah: true
      }
    })

    monthlyUsage.push(usage._sum.jumlah || 0)
  }

  return monthlyUsage
}

function calculateUsageTrend(monthlyUsage: number[]): 'INCREASING' | 'DECREASING' | 'STABLE' {
  if (monthlyUsage.length < 3) return 'STABLE'

  // Calculate trend using simple linear regression
  const n = monthlyUsage.length
  const x = Array.from({ length: n }, (_, i) => i)
  const y = monthlyUsage

  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((acc, xi, i) => acc + xi * (y[i] || 0), 0)
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

  const avgUsage = sumY / n
  const changeThreshold = avgUsage * 0.1 // 10% of average

  if (slope > changeThreshold) return 'INCREASING'
  if (slope < -changeThreshold) return 'DECREASING'
  return 'STABLE'
}