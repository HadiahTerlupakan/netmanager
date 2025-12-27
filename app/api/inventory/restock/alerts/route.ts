import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * GET /api/inventory/restock/alerts
 * Get all restock alerts
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/restock/alerts')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const isRead = searchParams.get('isRead')
    const isResolved = searchParams.get('isResolved')
    const urgency = searchParams.get('urgency')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    try {
      const dbStart = Date.now()

      // Build where clause
      const where: any = {}
      if (barangId) where.barangId = barangId
      if (gudangId) where.gudangId = gudangId
      if (isRead !== null) where.isRead = isRead === 'true'
      if (isResolved !== null) where.isResolved = isResolved === 'true'
      if (urgency) where.urgency = urgency

      const [alerts, total, unreadCount] = await Promise.all([
        prisma.restockAlerts.findMany({
          where,
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
          },
          orderBy: [
            { urgency: 'desc' },
            { createdAt: 'desc' }
          ],
          skip: offset,
          take: limit
        }),
        prisma.restockAlerts.count({ where }),
        prisma.restockAlerts.count({
          where: {
            ...where,
            isRead: false,
            isResolved: false
          }
        })
      ])

      logger.dbOperation('findMany', 'RestockAlerts+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/restock/alerts', 200, Date.now() - startTime, {
        userId: session.user.id,
        count: alerts.length,
        page,
        limit,
        total,
        unreadCount,
        barangId,
        gudangId,
        isRead,
        isResolved,
        urgency,
      })

      return NextResponse.json({
        alerts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        unreadCount
      })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching restock alerts', error, {
      path: '/api/inventory/restock/alerts',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat notifikasi restock' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/restock/alerts
 * Create restock alert or check for alerts automatically
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/restock/alerts')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type = 'AUTO_CHECK' } = body

    try {
      const dbStart = Date.now()

      let result

      if (type === 'AUTO_CHECK') {
        // Auto check for restock alerts based on current stock and settings
        const settings = await prisma.restockSettings.findMany({
          where: { isActive: true },
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

        const newAlerts = []

        for (const setting of settings) {
          const currentStock = await prisma.barangGudang.findUnique({
            where: {
              barangId_gudangId: {
                barangId: setting.barangId,
                gudangId: setting.gudangId
              }
            }
          })

          if (currentStock) {
            let shouldAlert = false
            let alertType = 'RESTOCK_NEEDED'
            let urgency: any = 'MEDIUM'
            let message = ''

            if (currentStock.stok === 0) {
              shouldAlert = true
              alertType = 'STOCK_OUT'
              urgency = 'CRITICAL'
              message = `STOK HABIS! ${setting.barang.nama} di ${setting.gudang.nama} kosong`
            } else if (currentStock.stok <= setting.minStok) {
              shouldAlert = true
              alertType = 'LOW_STOCK'
              urgency = currentStock.stok <= (setting.minStok * 0.5) ? 'HIGH' : 'MEDIUM'
              message = `Stok rendah! ${setting.barang.nama} di ${setting.gudang.nama} tersisa ${currentStock.stok} ${setting.barang.satuan} (min: ${setting.minStok})`
            } else if (currentStock.stok > setting.maxStok) {
              shouldAlert = true
              alertType = 'OVERSTOCK'
              urgency = 'LOW'
              message = `Stok berlebih! ${setting.barang.nama} di ${setting.gudang.nama} sebanyak ${currentStock.stok} ${setting.barang.satuan} (max: ${setting.maxStok})`
            }

            if (shouldAlert) {
              // Check if there's already an unresolved alert of the same type
              const existingAlert = await prisma.restockAlerts.findFirst({
                where: {
                  barangId: setting.barangId,
                  gudangId: setting.gudangId,
                  alertType: alertType as any,
                  isResolved: false
                }
              })

              if (!existingAlert) {
                const recommendedOrder = Math.max(0, setting.maxStok - currentStock.stok)

                const newAlert = await prisma.restockAlerts.create({
                  data: {
                    id: crypto.randomUUID(),
                    barangId: setting.barangId,
                    gudangId: setting.gudangId,
                    alertType: alertType as any,
                    currentStok: currentStock.stok,
                    minStok: setting.minStok,
                    recommendedOrder,
                    urgency,
                    message
                  },
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

                newAlerts.push(newAlert)
              }
            }
          }
        }

        result = {
          message: `Auto check completed. Found ${newAlerts.length} new alerts.`,
          newAlerts
        }
      }

      logger.dbOperation('transaction', 'RestockAlerts+AutoCheck', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/restock/alerts', 201, Date.now() - startTime, {
        userId: session.user.id,
        type
      })

      // System Log
      try {
        const { logger } = await import('@/lib/logger')
        await logger.logActivity({
          action: 'CREATE',
          subject: 'Restock Check',
          userId: session.user.id,
          details: { type, newAlertsCount: result?.newAlerts?.length || 0 }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      return NextResponse.json(result, { status: 201 })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error processing restock alerts', error, {
      path: '/api/inventory/restock/alerts',
      method: 'POST',
    })

    return NextResponse.json(
      { error: 'Gagal memproses notifikasi restock' },
      { status: 500 }
    )
  }
}