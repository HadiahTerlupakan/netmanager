import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

/**
 * GET /api/inventory/transfer
 * Get all transfer records with filters
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/transfer')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const dariGudangId = searchParams.get('dariGudangId')
    const keGudangId = searchParams.get('keGudangId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    try {
      const dbStart = Date.now()

      // Build where clause
      const where: any = {}
      if (barangId) where.barangId = barangId
      if (dariGudangId) where.dariGudangId = dariGudangId
      if (keGudangId) where.keGudangId = keGudangId

      const [transferList, total] = await Promise.all([
        prisma.transferAntarGudang.findMany({
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
            dariGudang: {
              select: {
                id: true,
                kode: true,
                nama: true
              }
            },
            keGudang: {
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
        prisma.transferAntarGudang.count({ where })
      ])

      logger.dbOperation('findMany', 'TransferAntarGudang+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/transfer', 200, Date.now() - startTime, {
        userId: session.user.id,
        count: transferList.length,
        page,
        limit,
        total,
        barangId,
        dariGudangId,
        keGudangId,
      })

      return NextResponse.json({
        transferList,
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
    logger.error('Error fetching transfer records', error, {
      path: '/api/inventory/transfer',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data transfer' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/transfer
 * Create new transfer record
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/transfer')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { barangId, dariGudangId, keGudangId, jumlah, kondisi, keterangan } = body

    // Validation
    if (!barangId || !dariGudangId || !keGudangId || !jumlah || jumlah <= 0) {
      return NextResponse.json(
        { error: 'Barang, gudang sumber, gudang tujuan, dan jumlah harus diisi dengan benar' },
        { status: 400 }
      )
    }

    if (dariGudangId === keGudangId) {
      return NextResponse.json(
        { error: 'Gudang sumber dan tujuan tidak boleh sama' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()

      // Generate transfer code
      const transferCode = `TRF${Date.now()}`

      await prisma.$transaction(async (tx) => {
        // Check if barang exists
        const barang = await tx.barang.findUnique({
          where: { id: barangId }
        })

        if (!barang) {
          throw new Error('Barang tidak ditemukan')
        }

        // Check if gudang exists and active
        const [dariGudang, keGudang] = await Promise.all([
          tx.gudang.findUnique({ where: { id: dariGudangId, isActive: true } }),
          tx.gudang.findUnique({ where: { id: keGudangId, isActive: true } })
        ])

        if (!dariGudang) {
          throw new Error('Gudang sumber tidak ditemukan atau tidak aktif')
        }

        if (!keGudang) {
          throw new Error('Gudang tujuan tidak ditemukan atau tidak aktif')
        }

        // Check stock in source warehouse
        const stockSumber = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId, gudangId: dariGudangId } }
        })

        if (!stockSumber || stockSumber.stok < jumlah) {
          throw new Error(`Stok tidak mencukupi di gudang sumber. Stok tersedia: ${stockSumber?.stok || 0}`)
        }

        // Create transfer record
        const transferRecord = await tx.transferAntarGudang.create({
          data: {
            kodeTransfer: transferCode,
            barangId,
            dariGudangId,
            keGudangId,
            jumlah,
            kondisi: kondisi || 'BARU',
            keterangan
          }
        })

        // Create barang keluar record from source warehouse
        await tx.barangKeluar.create({
          data: {
            barangId,
            gudangId: dariGudangId,
            transferId: transferRecord.id,
            jumlah,
            kondisi: kondisi || 'BARU',
            keterangan: `Transfer ke ${keGudang.nama} (${keGudang.kode})${keterangan ? ` - ${keterangan}` : ''}`
          }
        })

        // Update stock in source warehouse
        await tx.barangGudang.update({
          where: { barangId_gudangId: { barangId, gudangId: dariGudangId } },
          data: {
            stok: stockSumber.stok - jumlah
          }
        })

        // Update or create stock in destination warehouse
        const stockTujuan = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId, gudangId: keGudangId } }
        })

        if (stockTujuan) {
          // Update existing stock
          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId, gudangId: keGudangId } },
            data: {
              stok: stockTujuan.stok + jumlah
            }
          })
        } else {
          // Create new stock record
          await tx.barangGudang.create({
            data: {
              barangId,
              gudangId: keGudangId,
              stok: jumlah
            }
          })
        }

        // Create barang masuk record to destination warehouse
        await tx.barangMasuk.create({
          data: {
            barangId,
            gudangId: keGudangId,
            transferId: transferRecord.id,
            jumlah,
            kondisi: kondisi || 'BARU',
            keterangan: `Transfer dari ${dariGudang.nama} (${dariGudang.kode})${keterangan ? ` - ${keterangan}` : ''}`
          }
        })

        logger.dbOperation('transaction', 'TransferAntarGudang+BarangMasuk+BarangKeluar+BarangGudang', Date.now() - dbStart)

        logger.apiRequest('POST', '/api/inventory/transfer', 201, Date.now() - startTime, {
          userId: session.user.id,
          barangId,
          dariGudangId,
          keGudangId,
          jumlah,
          transferId: transferRecord.id,
          transferCode,
        })

        return transferRecord
      })

      return NextResponse.json(
        {
          message: 'Transfer barang antar gudang berhasil',
          kodeTransfer: transferCode
        },
        { status: 201 }
      )
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error creating transfer', error, {
      path: '/api/inventory/transfer',
      method: 'POST',
    })

    if (error.message === 'Barang tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'Gudang sumber tidak ditemukan atau tidak aktif') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error.message === 'Gudang tujuan tidak ditemukan atau tidak aktif') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error.message.includes('Stok tidak mencukupi')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error.message === 'Gudang sumber dan tujuan tidak boleh sama') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Gagal melakukan transfer barang' },
      { status: 500 }
    )
  }
}