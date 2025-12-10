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

async function getStockByCondition(barangId: string, gudangId: string) {
  // Get ALL transactions for this barang to calculate current condition breakdown
  const [masukData, keluarData] = await Promise.all([
    prisma.barangMasuk.findMany({
      where: { barangId, gudangId },
      orderBy: { tanggal: 'desc' }
    }),
    prisma.barangKeluar.findMany({
      where: { barangId, gudangId, isHilang: false },
      orderBy: { tanggal: 'desc' }
    })
  ])

  // Calculate current stock by condition
  let stokBaru = 0
  let stokBekas = 0
  let stokRusak = 0

  // Process barang masuk
  masukData.forEach((masuk: any) => {
    switch (masuk.kondisi) {
      case 'BARU':
        stokBaru += masuk.jumlah
        break
      case 'BEKAS':
        stokBekas += masuk.jumlah
        break
      case 'RUSAK':
        stokRusak += masuk.jumlah
        break
      default:
        stokBaru += masuk.jumlah
        break
    }
  })

  // Process barang keluar
  keluarData.forEach((keluar: any) => {
    switch (keluar.kondisi) {
      case 'BARU':
        stokBaru = Math.max(0, stokBaru - keluar.jumlah)
        break
      case 'BEKAS':
        stokBekas = Math.max(0, stokBekas - keluar.jumlah)
        break
      case 'RUSAK':
        stokRusak = Math.max(0, stokRusak - keluar.jumlah)
        break
      default:
        stokBaru = Math.max(0, stokBaru - keluar.jumlah)
        break
    }
  })

  return {
    stokBaru,
    stokBekas,
    stokRusak,
    totalStok: stokBaru + stokBekas + stokRusak
  }
}

/**
 * GET /api/inventory/transfer/[id]
 * Get specific transfer record by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/transfer/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    try {
      const dbStart = Date.now()

      const transferRecord = await prisma.transferAntarGudang.findUnique({
        where: { id },
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
              nama: true,
              lokasi: true
            }
          },
          keGudang: {
            select: {
              id: true,
              kode: true,
              nama: true,
              lokasi: true
            }
          },
          masuk: {
            select: {
              id: true,
              tanggal: true,
              jumlah: true,
              kondisi: true,
              keterangan: true
            }
          },
          keluar: {
            select: {
              id: true,
              tanggal: true,
              jumlah: true,
              kondisi: true,
              keterangan: true
            }
          }
        }
      })

      logger.dbOperation('findUnique', 'TransferAntarGudang+Relations', Date.now() - dbStart)

      if (!transferRecord) {
        return NextResponse.json({ error: 'Record transfer tidak ditemukan' }, { status: 404 })
      }

      logger.apiRequest('GET', '/api/inventory/transfer/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        transferId: id,
      })

      return NextResponse.json({ transfer: transferRecord })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching transfer record', error, {
      path: '/api/inventory/transfer/[id]',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data transfer' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory/transfer/[id]
 * Update transfer record (not typically used, but included for completeness)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/transfer/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { keterangan } = body

    try {
      const dbStart = Date.now()

      const transferRecord = await prisma.transferAntarGudang.update({
        where: { id },
        data: {
          keterangan
        },
        include: {
          barang: {
            select: {
              id: true,
              kode: true,
              nama: true
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
        }
      })

      logger.dbOperation('update', 'TransferAntarGudang', Date.now() - dbStart)

      logger.apiRequest('PUT', '/api/inventory/transfer/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        transferId: id,
      })

      return NextResponse.json({ message: 'Transfer record berhasil diperbarui' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error updating transfer record', error, {
      path: '/api/inventory/transfer/[id]',
      method: 'PUT',
    })

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Record transfer tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Gagal memperbarui record transfer' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/transfer/[id]
 * Delete transfer record and reverse stock changes (emergency operation)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to DELETE /api/inventory/transfer/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    try {
      const dbStart = Date.now()

      await prisma.$transaction(async (tx) => {
        // Get the transfer record to be deleted
        const transferRecord = await tx.transferAntarGudang.findUnique({
          where: { id },
          include: {
            barang: true,
            dariGudang: true,
            keGudang: true,
            masuk: true,
            keluar: true
          }
        })

        if (!transferRecord) {
          throw new Error('Record transfer tidak ditemukan')
        }

        // Restore stock to source warehouse
        const stockSumber = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId: transferRecord.barangId, gudangId: transferRecord.dariGudangId } }
        })

        if (stockSumber) {
          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId: transferRecord.barangId, gudangId: transferRecord.dariGudangId } },
            data: {
              stok: stockSumber.stok + transferRecord.jumlah
            }
          })
        } else {
          // If no stock record exists, create one
          await tx.barangGudang.create({
            data: {
              barangId: transferRecord.barangId,
              gudangId: transferRecord.dariGudangId,
              stok: transferRecord.jumlah
            }
          })
        }

        // Check condition-specific stock in destination warehouse before rollback
        const stockTujuanByKondisi = await getStockByCondition(transferRecord.barangId, transferRecord.keGudangId)
        const availableStockInTujuan = stockTujuanByKondisi[
          transferRecord.kondisi === 'BARU' ? 'stokBaru' :
          transferRecord.kondisi === 'BEKAS' ? 'stokBekas' :
          transferRecord.kondisi === 'RUSAK' ? 'stokRusak' : 'stokBaru'
        ] || 0

        if (availableStockInTujuan < transferRecord.jumlah) {
          throw new Error(
            `Stok ${transferRecord.kondisi.toLowerCase()} di gudang tujuan tidak mencukupi untuk pembatalan transfer. ` +
            `Stok tersedia: ${availableStockInTujuan}, Diperlukan: ${transferRecord.jumlah}`
          )
        }

        // Reduce stock from destination warehouse (using BarangGudang for atomicity)
        const stockTujuan = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId: transferRecord.barangId, gudangId: transferRecord.keGudangId } }
        })

        if (stockTujuan) {
          const newStock = stockTujuan.stok - transferRecord.jumlah

          if (newStock === 0) {
            // If stock becomes 0, delete the BarangGudang record
            await tx.barangGudang.delete({
              where: { barangId_gudangId: { barangId: transferRecord.barangId, gudangId: transferRecord.keGudangId } }
            })
          } else {
            // Update with reduced stock
            await tx.barangGudang.update({
              where: { barangId_gudangId: { barangId: transferRecord.barangId, gudangId: transferRecord.keGudangId } },
              data: { stok: newStock }
            })
          }
        } else {
          throw new Error('Stok tidak ditemukan di gudang tujuan')
        }

        // Delete related barang masuk and keluar records
        if (transferRecord.masuk && transferRecord.masuk.length > 0) {
          await tx.barangMasuk.deleteMany({
            where: { transferId: id }
          })
        }

        if (transferRecord.keluar && transferRecord.keluar.length > 0) {
          await tx.barangKeluar.deleteMany({
            where: { transferId: id }
          })
        }

        // Delete the transfer record
        await tx.transferAntarGudang.delete({
          where: { id }
        })

        logger.dbOperation('transaction', 'TransferAntarGudang+RelatedRecords+BarangGudang', Date.now() - dbStart)
      })

      logger.apiRequest('DELETE', '/api/inventory/transfer/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        transferId: id,
      })

      return NextResponse.json({ message: 'Transfer berhasil dibatalkan dan stok dikembalikan' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error deleting transfer record', error, {
      path: '/api/inventory/transfer/[id]',
      method: 'DELETE',
    })

    if (error.message === 'Record transfer tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message.includes('tidak mencukupi untuk pembatalan transfer') || error.message.includes('tidak ditemukan di gudang tujuan')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Gagal membatalkan transfer' },
      { status: 500 }
    )
  }
}