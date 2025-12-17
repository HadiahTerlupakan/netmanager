import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'

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
    const session = await requireAdmin(req)
    if (session instanceof NextResponse) {
      return session
    }

    const { id } = await params
    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      const transferRecord = await inventoryRepository.findTransferById(id)

      logger.dbOperation('findUnique', 'TransferAntarGudang+Relations', Date.now() - dbStart)

      if (!transferRecord) {
        return NextResponse.json({ error: 'Record transfer tidak ditemukan' }, { status: 404 })
      }

      logger.apiRequest('GET', `/api/inventory/transfer/${id}`, 200, Date.now() - startTime, {
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
 * Update transfer record (only description)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin(req)
    if (session instanceof NextResponse) {
      return session
    }

    const { id } = await params
    const body = await req.json()
    const { keterangan } = body

    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      const transferRecord = await inventoryRepository.updateTransfer(id, { keterangan })

      logger.dbOperation('update', 'TransferAntarGudang', Date.now() - dbStart)

      logger.apiRequest('PUT', `/api/inventory/transfer/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        transferId: id,
      })

      return NextResponse.json({ message: 'Transfer record berhasil diperbarui', transfer: transferRecord })
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
    const session = await requireAdmin(req)
    if (session instanceof NextResponse) {
      return session
    }

    const { id } = await params
    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      await inventoryRepository.deleteTransfer(id)

      logger.dbOperation('transaction', 'TransferAntarGudang+RelatedRecords+BarangGudang', Date.now() - dbStart)

      logger.apiRequest('DELETE', `/api/inventory/transfer/${id}`, 200, Date.now() - startTime, {
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