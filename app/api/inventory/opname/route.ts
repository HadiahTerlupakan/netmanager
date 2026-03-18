import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logger, logActivitySafe } from '@/lib/logger'
import { hasPermission } from '@/lib/rbac'
import { randomUUID } from 'crypto'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import type { Session } from 'next-auth'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user

  if (!(await hasPermission("opname:read"))) {
    return ApiErrors.forbidden()
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
    const where: Prisma.StockOpnameWhereInput = {}
    if (barangId) where.barangId = barangId
    if (gudangId) where.gudangId = gudangId

    // NEW: Enforce Site Restriction Logic
    const permissions = await getUserPermissions(user.id);
    const isSuper = isSuperAdmin(user)
    
    // Need to fetch siteId
    const { prisma: db } = await import('@/lib/prisma');
    const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
    const userSiteId = dbUser?.siteId

    if (!isSuper && permissions.includes('opname:site_only')) {
      if (!userSiteId) {
        return apiSuccess({
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
      userId: user.id,
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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan');
    logger.error('Error fetching stock opname', err, {
      path: '/api/inventory/opname',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat data stock opname')
  }
})

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user

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
    catatanDetail,
    alasanSelisih
  } = body

  // Validation
  if (!barangId || !gudangId || stokFisik === undefined || stokFisik < 0) {
    return ApiErrors.badRequest('Barang, gudang, dan stok fisik harus diisi dengan benar')
  }

  // NEW: Validate Gudang Access
  const { validateGudangAccess } = await import('@/modules/inventory/validation');
  
  // Mock session for validation
  const { prisma: db } = await import('@/lib/prisma');
  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true, role: true } });
  
  const mockSession = {
      user: {
          ...user,
          siteId: dbUser?.siteId,
          role: dbUser?.role || user.role
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  const access = await validateGudangAccess(mockSession as Session, gudangId);
  if (!access.allowed) {
    return ApiErrors.forbidden(access.error || 'Akses ditolak');
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
          pic: user.name || user.email || 'Admin', // Auto-assign current user as PIC
          suhuPenyimpanan,
          kelembaban,
          tanggalExpire: tanggalExpire ? new Date(tanggalExpire) : null,
          nomorBatch,
          catatanDetail,
          alasanSelisih
        }
      })

      // Create adjustment transaction to maintain transaction history integrity
      // This ensures SUM(masuk) - SUM(keluar) always equals BarangGudang.stok
      if (selisih !== 0) {
        // Map alasan to readable text for keterangan
        const alasanLabels: Record<string, string> = {
          'hilang': 'Barang hilang',
          'rusak': 'Barang rusak/tidak layak',
          'revisi': 'Revisi stok/koreksi data',
          'salah_input': 'Kesalahan input sebelumnya',
          'terpakai': 'Terpakai tidak tercatat',
          'expired': 'Barang kadaluarsa',
          'lebih': 'Stok lebih/ditemukan',
          'lainnya': 'Lainnya'
        }
        const alasanText = alasanSelisih ? alasanLabels[alasanSelisih] || alasanSelisih : 'Penyesuaian stok'

        if (selisih > 0) {
          // Stock gain - record as barang masuk (goods found during opname)
          await tx.barangMasuk.create({
            data: {
              id: randomUUID(),
              barangId,
              gudangId,
              jumlah: selisih,
              kondisi: 'BARU',
              keterangan: `Opname: ${alasanText} (+${selisih}). Ref: ${opnameRecord.id}`
            }
          })
        } else {
          // Stock loss - record as barang keluar
          // Only set isHilang: true if alasanSelisih is explicitly 'hilang'
          const isActuallyLost = alasanSelisih === 'hilang'

          await tx.barangKeluar.create({
            data: {
              id: randomUUID(),
              barangId,
              gudangId,
              jumlah: Math.abs(selisih),
              kondisi: alasanSelisih === 'rusak' ? 'RUSAK' : 'BARU',
              isHilang: isActuallyLost,
              keterangan: `Opname: ${alasanText} (${selisih}). Ref: ${opnameRecord.id}`
            }
          })
        }
      }

      // Update stock to match physical count
      if (currentStock) {
        // Calculate the stock breakdown update based on reason
        // Default: adjust stokBaru (new stock) since it's most common
        const updateData: { stok: number; stokBaru?: number; stokBekas?: number; stokRusak?: number } = {
          stok: stokFisik
        }

        if (selisih !== 0) {
          // For stock loss (negative selisih)
          if (selisih < 0) {
            const absSelisih = Math.abs(selisih)

            // Determine which stock category to reduce based on reason
            if (alasanSelisih === 'rusak' || alasanSelisih === 'expired') {
              // Reduce from stokBaru, add to stokRusak (if items became damaged)
              // But total stok is still reduced, so we just reduce stokBaru
              updateData.stokBaru = Math.max(0, (currentStock.stokBaru || 0) - absSelisih)
            } else {
              // Default: reduce from stokBaru
              updateData.stokBaru = Math.max(0, (currentStock.stokBaru || 0) - absSelisih)
            }
          } else {
            // For stock gain (positive selisih), add to stokBaru
            updateData.stokBaru = (currentStock.stokBaru || 0) + selisih
          }
        }

        await tx.barangGudang.update({
          where: { barangId_gudangId: { barangId, gudangId } },
          data: updateData
        })
      } else if (stokFisik > 0) {
        // Create stock record if it doesn't exist and stokFisik > 0
        // Default: set all as stokBaru (new stock)
        await tx.barangGudang.create({
          data: {
            id: randomUUID(),
            barangId,
            gudangId,
            stok: stokFisik,
            stokBaru: stokFisik,
            stokBekas: 0,
            stokRusak: 0,
            updatedAt: new Date()
          }
        })
      }

      logger.dbOperation('transaction', 'StockOpname+BarangGudang', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/opname', 201, Date.now() - startTime, {
        userId: user.id,
        barangId,
        gudangId,
        stokFisik,
        stokSistem,
        selisih,
        opnameId: opnameRecord.id,
      })

      // System Log
      logActivitySafe({
        action: 'CREATE',
        subject: 'Stock Opname',
        userId: user.id,
        details: { id: opnameRecord.id, barangId: barangId, gudangId: gudangId, diff: stokFisik - stokSistem }
      })

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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan');
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
})
