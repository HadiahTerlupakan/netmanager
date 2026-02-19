import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logger, logActivitySafe } from '@/lib/logger'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { Prisma } from '@prisma/client'

/**
 * GET /api/inventory/restock/settings
 * Get all restock settings
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user

  if (!(await hasPermission("restock:read"))) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat pengaturan restock')
  }

  const { searchParams } = req.nextUrl
  const barangId = searchParams.get('barangId') || undefined
  const gudangId = searchParams.get('gudangId') || undefined
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  try {
    const dbStart = Date.now()

    // Build where clause
    const where: Prisma.RestockSettingsWhereInput = {}
    if (barangId) where.barangId = barangId
    if (gudangId) where.gudangId = gudangId

    const [settings, total] = await Promise.all([
      prisma.restockSettings.findMany({
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
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.restockSettings.count({ where })
    ])

    logger.dbOperation('findMany', 'RestockSettings+Relations', Date.now() - dbStart)

    logger.apiRequest('GET', '/api/inventory/restock/settings', 200, Date.now() - startTime, {
      userId: user.id,
      count: settings.length,
      page,
      limit,
      total,
      barangId,
      gudangId,
    })

    return apiSuccess({
      settings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan')
    logger.error('Error fetching restock settings', err, {
      path: '/api/inventory/restock/settings',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat pengaturan restock')
  }
})

/**
 * POST /api/inventory/restock/settings
 * Create or update restock settings
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user

  if (!(await hasPermission("restock:update"))) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah pengaturan restock')
  }

  const body = await req.json()
  const { barangId, gudangId, minStok, maxStok, safetyStok, leadTimeDays } = body

  // Validation
  if (!barangId || !gudangId || !minStok || !maxStok) {
    return ApiErrors.badRequest('Barang, gudang, minimal stok, dan maksimal stok harus diisi')
  }

  if (minStok >= maxStok) {
    return ApiErrors.badRequest('Minimal stok harus lebih kecil dari maksimal stok')
  }

  try {
    const dbStart = Date.now()

    const result = await prisma.$transaction(async (tx) => {
      // Check if barang exists
      const barang = await tx.barang.findUnique({
        where: { id: barangId }
      })

      if (!barang) {
        throw new Error('Barang tidak ditemukan')
      }

      // Check if gudang exists
      const gudang = await tx.gudang.findUnique({
        where: { id: gudangId, isActive: true }
      })

      if (!gudang) {
        throw new Error('Gudang tidak ditemukan atau tidak aktif')
      }

      // Calculate average daily usage based on historical data (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const usageData = await tx.barangKeluar.aggregate({
        where: {
          barangId,
          gudangId,
          tanggal: {
            gte: thirtyDaysAgo
          }
        },
        _sum: {
          jumlah: true
        },
        _count: {
          id: true
        }
      })

      const avgDailyUsage = usageData._sum.jumlah ? usageData._sum.jumlah / 30 : 0

      // Upsert restock settings
      const settings = await tx.restockSettings.upsert({
        where: {
          barangId_gudangId: {
            barangId,
            gudangId
          }
        },
        update: {
          minStok,
          maxStok,
          safetyStok: safetyStok || 0,
          leadTimeDays: leadTimeDays || 7,
          avgDailyUsage,
          lastUsageCalculation: new Date(),
          isActive: true
        },
        create: {
          id: crypto.randomUUID(),
          barangId,
          gudangId,
          minStok,
          maxStok,
          safetyStok: safetyStok || 0,
          leadTimeDays: leadTimeDays || 7,
          avgDailyUsage,
          updatedAt: new Date()
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

      // Check if we need to create restock alert
      const currentStock = await tx.barangGudang.findUnique({
        where: { barangId_gudangId: { barangId, gudangId } }
      })

      if (currentStock && currentStock.stok <= minStok) {
        // Check if there's already an unresolved alert
        const existingAlert = await tx.restockAlerts.findFirst({
          where: {
            barangId,
            gudangId,
            isResolved: false,
            alertType: 'RESTOCK_NEEDED'
          }
        })

        if (!existingAlert) {
          const recommendedOrder = maxStok - currentStock.stok
          const urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' = currentStock.stok === 0 ? 'CRITICAL' :
            currentStock.stok <= (minStok * 0.5) ? 'HIGH' : 'MEDIUM'

          await tx.restockAlerts.create({
            data: {
              id: crypto.randomUUID(),
              barangId,
              gudangId,
              alertType: 'RESTOCK_NEEDED',
              currentStok: currentStock.stok,
              minStok,
              recommendedOrder,
              urgency,
              message: `Stok ${barang.nama} di ${gudang.nama} rendah. Sisa: ${currentStock.stok} ${barang.satuan}, Min: ${minStok} ${barang.satuan}`
            }
          })
        }
      }

      logger.dbOperation('transaction', 'RestockSettings+Alerts', Date.now() - dbStart)

      return settings
    })

    logger.apiRequest('POST', '/api/inventory/restock/settings', 201, Date.now() - startTime, {
      userId: user.id,
      barangId,
      gudangId,
      minStok,
      maxStok,
    })

    // System Log
    logActivitySafe({
      action: 'UPDATE',
      subject: 'Restock Settings',
      userId: user.id,
      details: { barangId, gudangId, minStok, maxStok }
    })

    return apiSuccess({
      message: 'Pengaturan restock berhasil disimpan',
      settings: result
    }, { status: 201 })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan')
    logger.error('Error saving restock settings', err, {
      path: '/api/inventory/restock/settings',
      method: 'POST',
    })

    if (err.message === 'Barang tidak ditemukan') {
      return ApiErrors.notFound('Barang')
    }
    if (err.message === 'Gudang tidak ditemukan atau tidak aktif') {
      return ApiErrors.badRequest('Gudang tidak ditemukan atau tidak aktif')
    }

    return ApiErrors.internalError('Gagal menyimpan pengaturan restock')
  }
})
