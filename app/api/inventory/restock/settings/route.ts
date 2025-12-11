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
 * GET /api/inventory/restock/settings
 * Get all restock settings
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/restock/settings')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    try {
      const dbStart = Date.now()

      // Build where clause
      const where: any = {}
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
        userId: session.user.id,
        count: settings.length,
        page,
        limit,
        total,
        barangId,
        gudangId,
      })

      return NextResponse.json({
        settings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching restock settings', error, {
      path: '/api/inventory/restock/settings',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat pengaturan restock' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/restock/settings
 * Create or update restock settings
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/restock/settings')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { barangId, gudangId, minStok, maxStok, safetyStok, leadTimeDays } = body

    // Validation
    if (!barangId || !gudangId || !minStok || !maxStok) {
      return NextResponse.json(
        { error: 'Barang, gudang, minimal stok, dan maksimal stok harus diisi' },
        { status: 400 }
      )
    }

    if (minStok >= maxStok) {
      return NextResponse.json(
        { error: 'Minimal stok harus lebih kecil dari maksimal stok' },
        { status: 400 }
      )
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
            barangId,
            gudangId,
            minStok,
            maxStok,
            safetyStok: safetyStok || 0,
            leadTimeDays: leadTimeDays || 7,
            avgDailyUsage
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
            const urgency = currentStock.stok === 0 ? 'CRITICAL' :
                           currentStock.stok <= (minStok * 0.5) ? 'HIGH' : 'MEDIUM'

            await tx.restockAlerts.create({
              data: {
                barangId,
                gudangId,
                alertType: 'RESTOCK_NEEDED',
                currentStok: currentStock.stok,
                minStok,
                recommendedOrder,
                urgency: urgency as any,
                message: `Stok ${barang.nama} di ${gudang.nama} rendah. Sisa: ${currentStock.stok} ${barang.satuan}, Min: ${minStok} ${barang.satuan}`
              }
            })
          }
        }

        logger.dbOperation('transaction', 'RestockSettings+Alerts', Date.now() - dbStart)

        return settings
      })

      logger.apiRequest('POST', '/api/inventory/restock/settings', 201, Date.now() - startTime, {
        userId: session.user.id,
        barangId,
        gudangId,
        minStok,
        maxStok,
      })

      return NextResponse.json(
        {
          message: 'Pengaturan restock berhasil disimpan',
          settings: result
        },
        { status: 201 }
      )
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error saving restock settings', error, {
      path: '/api/inventory/restock/settings',
      method: 'POST',
    })

    if (error.message === 'Barang tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'Gudang tidak ditemukan atau tidak aktif') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error.message === 'Minimal stok harus lebih kecil dari maksimal stok') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Gagal menyimpan pengaturan restock' },
      { status: 500 }
    )
  }
}