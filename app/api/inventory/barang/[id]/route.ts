import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getInventoryRepository } from '@/lib/repositories'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * GET /api/inventory/barang/[id]
 * Get specific item by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/barang/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      const barang = await inventoryRepository.findBarangDetail(id)

      if (!barang) {
        return NextResponse.json(
          { error: 'Barang tidak ditemukan' },
          { status: 404 }
        )
      }

      // Calculate total stock
      let totalStock = 0
      if (barang.stok) {
        totalStock = barang.stok.reduce((sum: number, stock: any) => sum + stock.stok, 0)
      }

      const barangWithStats = {
        ...barang,
        totalStock
      }

      logger.dbOperation('findUnique', 'Barang+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', `/api/inventory/barang/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        barangId: barang.id,
      })

      return NextResponse.json({ barang: barangWithStats })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching barang', error, {
      path: '/api/inventory/barang/[id]',
      method: 'GET',
      id: 'unknown',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data barang' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory/barang/[id]
 * Update specific item
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/barang/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { kode, nama, satuan } = body

    // Validation
    if (!kode || !nama || !satuan) {
      return NextResponse.json(
        { error: 'Kode, nama, dan satuan barang harus diisi' },
        { status: 400 }
      )
    }

    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      // Check if barang exists
      const existingBarang = await inventoryRepository.findBarangById(id)

      if (!existingBarang) {
        return NextResponse.json(
          { error: 'Barang tidak ditemukan' },
          { status: 404 }
        )
      }

      // Check if kode conflicts with another barang
      const kodeConflict = await inventoryRepository.findBarangByKode(kode)

      if (kodeConflict && kodeConflict.id !== id) {
        return NextResponse.json(
          { error: 'Kode barang sudah digunakan' },
          { status: 400 }
        )
      }

      const updatedBarang = await inventoryRepository.updateBarang(id, {
        kode,
        nama,
        satuan
      })

      logger.dbOperation('update', 'Barang', Date.now() - dbStart)

      logger.apiRequest('PUT', `/api/inventory/barang/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        barangId: updatedBarang.id,
      })

      // System Log
      await logger.logActivity({
        action: 'UPDATE',
        subject: 'Barang',
        userId: session.user.id,
        details: { id: updatedBarang.id, changes: { kode, nama, satuan } }
      })

      return NextResponse.json({ barang: updatedBarang })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error updating barang', error, {
      path: '/api/inventory/barang/[id]',
      method: 'PUT',
      id: 'unknown',
    })
    return NextResponse.json(
      { error: 'Gagal mengupdate barang' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/barang/[id]
 * Delete specific item
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to DELETE /api/inventory/barang/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      // Check if barang exists
      const existingBarang = await inventoryRepository.findBarangById(id)

      if (!existingBarang) {
        return NextResponse.json(
          { error: 'Barang tidak ditemukan' },
          { status: 404 }
        )
      }

      // Safe delete via repository
      await inventoryRepository.deleteBarang(id)

      logger.dbOperation('delete', 'Barang', Date.now() - dbStart)

      logger.apiRequest('DELETE', `/api/inventory/barang/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        barangId: id,
      })

      // System Log
      await logger.logActivity({
        action: 'DELETE',
        subject: 'Barang',
        userId: session.user.id,
        details: { id }
      })

      return NextResponse.json({ message: 'Barang berhasil dihapus' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error deleting barang', error, {
      path: '/api/inventory/barang/[id]',
      method: 'DELETE',
    })
    return NextResponse.json(
      { error: 'Gagal menghapus barang' },
      { status: 500 }
    )
  }
}