import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * GET /api/inventory/opname
 * Get all stock opname records with filters
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/opname')
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

      return NextResponse.json({
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
  } catch (error: any) {
    logger.error('Error fetching stock opname', error, {
      path: '/api/inventory/opname',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data stock opname' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/opname
 * Record new stock opname
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/opname')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      pic,
      suhuPenyimpanan,
      kelembaban,
      tanggalExpire,
      nomorBatch,
      catatanDetail
    } = body

    // Validation
    if (!barangId || !gudangId || stokFisik === undefined || stokFisik < 0) {
      return NextResponse.json(
        { error: 'Barang, gudang, dan stok fisik harus diisi dengan benar' },
        { status: 400 }
      )
    }

    // Validate condition breakdown
    const totalKondisi = kondisiBaik + kondisiRusak + kondisiExpire
    if (totalKondisi > stokFisik) {
      return NextResponse.json(
        { error: 'Total jumlah kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik' },
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

      return NextResponse.json({
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
  } catch (error: any) {
    logger.error('Error creating stock opname', error, {
      path: '/api/inventory/opname',
      method: 'POST',
    })

    if (error.message === 'Barang tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'Gudang tidak ditemukan atau tidak aktif') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Gagal mencatat stock opname' },
      { status: 500 }
    )
  }
}

