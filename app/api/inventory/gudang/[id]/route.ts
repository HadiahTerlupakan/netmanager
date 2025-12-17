import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * GET /api/inventory/gudang/[id]
 * Get specific warehouse by ID
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/gudang/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      const gudang = await inventoryRepository.findGudangById(id)

      if (!gudang) {
        return NextResponse.json(
          { error: 'Gudang tidak ditemukan' },
          { status: 404 }
        )
      }

      logger.dbOperation('findUnique', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('GET', `/api/inventory/gudang/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        gudangId: gudang.id,
      })

      return NextResponse.json({ gudang })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching gudang', error, {
      path: '/api/inventory/gudang/[id]',
      method: 'GET',
      id: 'unknown',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data gudang' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory/gudang/[id]
 * Update specific warehouse
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/gudang/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const { kode, nama, lokasi, isActive } = body

    // Validation
    if (!kode || !nama) {
      return NextResponse.json(
        { error: 'Kode dan nama gudang harus diisi' },
        { status: 400 }
      )
    }

    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      // Check if gudang exists
      const existingGudang = await inventoryRepository.findGudangById(id)

      if (!existingGudang) {
        return NextResponse.json(
          { error: 'Gudang tidak ditemukan' },
          { status: 404 }
        )
      }

      // Check if kode conflicts with another gudang
      const kodeConflict = await inventoryRepository.findGudangByKode(kode)

      if (kodeConflict && kodeConflict.id !== id) {
        return NextResponse.json(
          { error: 'Kode gudang sudah digunakan' },
          { status: 400 }
        )
      }

      const updatedGudang = await inventoryRepository.updateGudang(id, {
        kode,
        nama,
        lokasi,
        isActive: isActive !== undefined ? isActive : existingGudang.isActive
      })

      logger.dbOperation('update', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('PUT', `/api/inventory/gudang/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        gudangId: updatedGudang.id,
      })

      // System Log
      try {
        const { logger } = await import('@/lib/logger')
        await logger.logActivity({
          action: 'UPDATE',
          subject: 'Gudang',
          userId: session.user.id,
          details: { id: updatedGudang.id, updates: { kode, nama, lokasi, isActive } }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      return NextResponse.json({ gudang: updatedGudang })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error updating gudang', error, {
      path: '/api/inventory/gudang/[id]',
      method: 'PUT',
      id: 'unknown',
    })
    return NextResponse.json(
      { error: 'Gagal mengupdate gudang' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/gudang/[id]
 * Delete specific warehouse (soft delete by setting isActive to false)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to DELETE /api/inventory/gudang/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      // Check if gudang exists
      const existingGudang = await inventoryRepository.findGudangById(id)

      if (!existingGudang) {
        return NextResponse.json(
          { error: 'Gudang tidak ditemukan' },
          { status: 404 }
        )
      }

      // Check if gudang has stock
      const hasStock = await inventoryRepository.hasStockInGudang(id)

      if (hasStock) {
        return NextResponse.json(
          { error: 'Tidak dapat menghapus gudang yang masih memiliki stok barang' },
          { status: 400 }
        )
      }

      // Soft delete by setting isActive to false (via repository deleteGudang)
      await inventoryRepository.deleteGudang(id)

      logger.dbOperation('update', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('DELETE', `/api/inventory/gudang/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        gudangId: id,
      })

      // System Log
      try {
        const { logger } = await import('@/lib/logger')
        await logger.logActivity({
          action: 'DELETE',
          subject: 'Gudang',
          userId: session.user.id,
          details: { id: id, name: existingGudang.nama }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      return NextResponse.json({ message: 'Gudang berhasil dihapus' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error deleting gudang', error, {
      path: '/api/inventory/gudang/[id]',
      method: 'DELETE',
      id: id ?? 'unknown',
    })
    return NextResponse.json(
      { error: 'Gagal menghapus gudang' },
      { status: 500 }
    )
  }
}