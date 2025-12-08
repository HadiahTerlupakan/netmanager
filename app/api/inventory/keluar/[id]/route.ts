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
 * GET /api/inventory/keluar/[id]
 * Get specific stock-out record by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/keluar/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    try {
      const dbStart = Date.now()

      const keluarRecord = await prisma.barangKeluar.findUnique({
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
          gudang: {
            select: {
              id: true,
              kode: true,
              nama: true
            }
          }
        }
      })

      logger.dbOperation('findUnique', 'BarangKeluar+Relations', Date.now() - dbStart)

      if (!keluarRecord) {
        return NextResponse.json({ error: 'Record barang keluar tidak ditemukan' }, { status: 404 })
      }

      logger.apiRequest('GET', '/api/inventory/keluar/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        keluarId: id,
      })

      return NextResponse.json({ keluar: keluarRecord })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching barang keluar', error, {
      path: '/api/inventory/keluar/[id]',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data barang keluar' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory/keluar/[id]
 * Update stock-out record (not typically used, but included for completeness)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/keluar/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { jumlah, keterangan } = body

    // Validation
    if (!jumlah || jumlah <= 0) {
      return NextResponse.json(
        { error: 'Jumlah harus diisi dengan angka positif' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()

      await prisma.$transaction(async (tx) => {
        // Get current record
        const currentRecord = await tx.barangKeluar.findUnique({
          where: { id },
          include: {
            barang: true,
            gudang: true
          }
        })

        if (!currentRecord) {
          throw new Error('Record barang keluar tidak ditemukan')
        }

        // Calculate stock difference
        const stockDifference = currentRecord.jumlah - jumlah

        // Update the record
        await tx.barangKeluar.update({
          where: { id },
          data: {
            jumlah,
            keterangan
          }
        })

        // Update stock in BarangGudang
        const currentStock = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId: currentRecord.barangId, gudangId: currentRecord.gudangId } }
        })

        if (currentStock) {
          const newStock = currentStock.stok + stockDifference
          if (newStock < 0) {
            throw new Error('Stok tidak mencukupi untuk perubahan ini')
          }

          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId: currentRecord.barangId, gudangId: currentRecord.gudangId } },
            data: { stok: newStock }
          })
        } else {
          throw new Error('Stok tidak ditemukan untuk barang dan gudang ini')
        }

        logger.dbOperation('transaction', 'BarangKeluar+BarangGudang', Date.now() - dbStart)
      })

      logger.apiRequest('PUT', '/api/inventory/keluar/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        keluarId: id,
        jumlah,
      })

      return NextResponse.json({ message: 'Barang keluar berhasil diperbarui' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error updating barang keluar', error, {
      path: '/api/inventory/keluar/[id]',
      method: 'PUT',
    })

    if (error.message === 'Record barang keluar tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'Stok tidak mencukupi untuk perubahan ini') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Gagal memperbarui barang keluar' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/keluar/[id]
 * Delete stock-out record and restore stock
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to DELETE /api/inventory/keluar/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    try {
      const dbStart = Date.now()

      await prisma.$transaction(async (tx) => {
        // Get the record to be deleted
        const keluarRecord = await tx.barangKeluar.findUnique({
          where: { id },
          include: {
            barang: true,
            gudang: true
          }
        })

        if (!keluarRecord) {
          throw new Error('Record barang keluar tidak ditemukan')
        }

        // Restore stock to BarangGudang
        const currentStock = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId: keluarRecord.barangId, gudangId: keluarRecord.gudangId } }
        })

        if (currentStock) {
          // Add back the stock that was taken out
          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId: keluarRecord.barangId, gudangId: keluarRecord.gudangId } },
            data: {
              stok: currentStock.stok + keluarRecord.jumlah
            }
          })
        } else {
          // If no stock record exists, create one
          await tx.barangGudang.create({
            data: {
              barangId: keluarRecord.barangId,
              gudangId: keluarRecord.gudangId,
              stok: keluarRecord.jumlah
            }
          })
        }

        // Delete the record
        await tx.barangKeluar.delete({
          where: { id }
        })

        logger.dbOperation('transaction', 'BarangKeluar+BarangGudang', Date.now() - dbStart)
      })

      logger.apiRequest('DELETE', '/api/inventory/keluar/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        keluarId: id,
      })

      return NextResponse.json({ message: 'Record barang keluar berhasil dihapus dan stok dikembalikan' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error deleting barang keluar', error, {
      path: '/api/inventory/keluar/[id]',
      method: 'DELETE',
    })

    if (error.message === 'Record barang keluar tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Gagal menghapus record barang keluar' },
      { status: 500 }
    )
  }
}