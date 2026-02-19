import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logger, logActivitySafe } from '@/lib/logger'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { Prisma } from '@prisma/client'
import crypto from 'crypto'

/**
 * GET /api/inventory/restock/alerts
 * Get all restock alerts
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user

  if (!(await hasPermission("restock:read"))) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat restock alerts')
  }

  const { searchParams } = req.nextUrl
  const barangId = searchParams.get('barangId') || undefined
  const gudangId = searchParams.get('gudangId') || undefined
  const isRead = searchParams.get('isRead')
  const isResolved = searchParams.get('isResolved')
  const urgency = searchParams.get('urgency')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  try {
    const dbStart = Date.now()

    // Build where clause
    const where: Prisma.RestockAlertsWhereInput = {}
    if (barangId) where.barangId = barangId
    if (gudangId) where.gudangId = gudangId
    if (isRead !== null) where.isRead = isRead === 'true'
    if (isResolved !== null) where.isResolved = isResolved === 'true'
    if (urgency) where.urgency = urgency as Prisma.EnumUrgencyLevelFilter

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
      userId: user.id,
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

    return apiSuccess({
      alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      unreadCount
    })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan')
    logger.error('Error fetching restock alerts', err, {
      path: '/api/inventory/restock/alerts',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat notifikasi restock')
  }
})

/**
 * POST /api/inventory/restock/alerts
 * Create restock alert or check for alerts automatically
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user

  if (!(await hasPermission("restock:create"))) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat restock alerts')
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
          let alertType: 'RESTOCK_NEEDED' | 'LOW_STOCK' | 'STOCK_OUT' | 'OVERSTOCK' = 'RESTOCK_NEEDED'
          let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
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
                alertType: alertType as Prisma.EnumAlertTypeFilter,
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
                  alertType,
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
      userId: user.id,
      type
    })

    // System Log
    logActivitySafe({
      action: 'CREATE',
      subject: 'Restock Check',
      userId: user.id,
      details: { type, newAlertsCount: result?.newAlerts?.length || 0 }
    })

    return apiSuccess(result, { status: 201 })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan')
    logger.error('Error processing restock alerts', err, {
      path: '/api/inventory/restock/alerts',
      method: 'POST',
    })

    return ApiErrors.internalError('Gagal memproses notifikasi restock')
  }
})
