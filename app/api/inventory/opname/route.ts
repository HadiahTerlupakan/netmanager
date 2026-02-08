import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import { hasPermission } from '@/lib/rbac'
import { randomUUID } from 'crypto'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authConfig)
    if (!session || !session.user) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/opname')
      return ApiErrors.unauthorized()
    }

    if (!(await hasPermission("opname:read"))) {
      return ApiErrors.forbidden()
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
      const where: Prisma.StockOpnameWhereInput = {}
      if (barangId) where.barangId = barangId
      if (gudangId) where.gudangId = gudangId

      // NEW: Enforce Site Restriction Logic
      // const permissions = session.user.permissions || []
      const permissions = await getUserPermissions(session.user.id);
      const isSuper = isSuperAdmin(session.user as { role?: string | null; isSuperAdmin?: boolean })
      const userSiteId = session.user.siteId

      if (!isSuper && permissions.includes('opname:site_only')) {
        if (!userSiteId) {
          return NextResponse.json({
            opnameList: [],
            pagination: { page, limit, total: 0, totalPages: 0 }
          })
        }
        // Filter by gudang that belongs to user's site
        where.gudang = {
          sites: {
            some: {
              id: userSiteId
            }
          }
        }
      }

      const [opnameList, total] = await Promise.all([
        prisma.stockOpname.findMany({
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
            tanggal: 'desc'
          },
          skip: offset,
          take: limit
        }),
        prisma.stockOpname.count({ where })
      ])

      logger.dbOperation('findMany', 'StockOpname+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/opname', 200, Date.now() - startTime, {
        userId: session.user.id,
        count: opnameList.length,
        page,
        limit,
        total,
        barangId,
        gudangId,
      })

      return apiSuccess({
        opnameList,
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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error fetching stock opname', err, {
      path: '/api/inventory/opname',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat data stock opname')
  }
}

/**
 * POST /api/inventory/opname
 * Record new stock opname
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authConfig)
    if (!session || !session.user) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/opname')
      return ApiErrors.unauthorized()
    }

    if (!(await hasPermission("opname:create"))) {
      return ApiErrors.forbidden()
    }

    const body = await req.json()
    const {
      barangId,
      gudangId,
      stokFisik,
      keterangan,
      kondisiBaik = 0,
      kondisiRusak = 0,
      kondisiExpire = 0,
      lokasiPenyimpanan,
      nomorRak,
      nomorBox,
      pic: _pic,
      suhuPenyimpanan,
      kelembaban,
      tanggalExpire,
      nomorBatch,
      catatanDetail
    } = body

    // Validation
    if (!barangId || !gudangId || stokFisik === undefined || stokFisik < 0) {
      return ApiErrors.badRequest('Barang, gudang, dan stok fisik harus diisi dengan benar')
    }

    // NEW: Validate Gudang Access
    const { validateGudangAccess } = await import('@/lib/inventory-validation');
    const access = await validateGudangAccess(session, gudangId);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error || 'Forbidden');
    }

    // Validate condition breakdown
    const totalKondisi = kondisiBaik + kondisiRusak + kondisiExpire
    if (totalKondisi > stokFisik) {
      return ApiErrors.badRequest('Total jumlah kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik')
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

        // Get current system stock
        const currentStock = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId, gudangId } }
        })

        const stokSistem = currentStock?.stok || 0
        const selisih = stokFisik - stokSistem

        // Create stock opname record with enhanced fields (PIC is current user)
        const opnameRecord = await tx.stockOpname.create({
          data: {
            id: randomUUID(),
            barangId,
            gudangId,
            stokFisik,
            stokSistem,
            selisih,
            keterangan,
            kondisiBaik,
            kondisiRusak,
            kondisiExpire,
            lokasiPenyimpanan,
            nomorRak,
            nomorBox,
            pic: session.user.name || session.user.email || 'Admin', // Auto-assign current user as PIC
            suhuPenyimpanan,
            kelembaban,
            tanggalExpire: tanggalExpire ? new Date(tanggalExpire) : null,
            nomorBatch,
            catatanDetail
          }
        })

        // Create adjustment transaction to maintain transaction history integrity
        // This ensures SUM(masuk) - SUM(keluar) always equals BarangGudang.stok
        if (selisih !== 0) {
          if (selisih > 0) {
            // Stock gain - record as barang masuk (goods found during opname)
            await tx.barangMasuk.create({
              data: {
                id: randomUUID(),
                barangId,
                gudangId,
                jumlah: selisih,
                kondisi: 'BARU',
                keterangan: `Penyesuaian stok opname (+${selisih}). Ref: ${opnameRecord.id}`
              }
            })
          } else {
            // Stock loss - record as barang keluar with isHilang flag
            // Use kondisi BARU with isHilang: true (assuming lost items were good condition)
            await tx.barangKeluar.create({
              data: {
                id: randomUUID(),
                barangId,
                gudangId,
                jumlah: Math.abs(selisih),
                kondisi: 'BARU', // Default to BARU, actual condition unknown for stock discrepancy
                isHilang: true, // Mark as lost/missing
                keterangan: `Penyesuaian stok opname (${selisih}) - Barang hilang. Ref: ${opnameRecord.id}`
              }
            })
          }
        }

        // Update stock to match physical count
        if (currentStock) {
          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId, gudangId } },
            data: {
              stok: stokFisik
            }
          })
        } else if (stokFisik > 0) {
          // Create stock record if it doesn't exist and stokFisik > 0
          await tx.barangGudang.create({
            data: {
              id: randomUUID(),
              barangId,
              gudangId,
              stok: stokFisik,
              updatedAt: new Date()
            }
          })
        }

        logger.dbOperation('transaction', 'StockOpname+BarangGudang', Date.now() - dbStart)

        logger.apiRequest('POST', '/api/inventory/opname', 201, Date.now() - startTime, {
          userId: session.user.id,
          barangId,
          gudangId,
          stokFisik,
          stokSistem,
          selisih,
          opnameId: opnameRecord.id,
        })

        // System Log
        try {
          await logger.logActivity({
            action: 'CREATE',
            subject: 'Stock Opname',
            userId: session.user.id,
            details: { id: opnameRecord.id, barangId: barangId, gudangId: gudangId, diff: stokFisik - stokSistem }
          })
        } catch (e) {
          console.error('Logging failed', e)
        }

        return {
          opnameRecord,
          previousStock: stokSistem,
          newStock: stokFisik,
          selisih
        }
      })

      const { opnameRecord, previousStock, newStock, selisih } = result

      return apiSuccess({
        message: 'Stock opname berhasil dicatat',
        opname: {
          ...opnameRecord,
          previousStock,
          newStock,
          selisih
        }
      }, { status: 201 })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error creating stock opname', err, {
      path: '/api/inventory/opname',
      method: 'POST',
    })

    if (err.message === 'Barang tidak ditemukan') {
      return ApiErrors.notFound('Barang tidak ditemukan')
    }
    if (err.message === 'Gudang tidak ditemukan atau tidak aktif') {
      return ApiErrors.badRequest(err.message)
    }

    return ApiErrors.internalError('Gagal mencatat stock opname')
  }
}

