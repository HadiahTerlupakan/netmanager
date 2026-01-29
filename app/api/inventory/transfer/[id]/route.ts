import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'
import { authConfig } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { hasPermission } from '@/lib/rbac'

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
    const session: any = await getServerSession(authConfig as any)
    if (!session || !session.user) {
      return ApiErrors.unauthorized()
    }

    if (!(await hasPermission("transfer:read"))) {
      return ApiErrors.forbidden()
    }

    const { id } = await params
    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      const transferRecord = await inventoryRepository.findTransferById(id)

      logger.dbOperation('findUnique', 'TransferAntarGudang+Relations', Date.now() - dbStart)

      if (!transferRecord) {
        return ApiErrors.notFound('Record transfer tidak ditemukan')
      }

      logger.apiRequest('GET', `/api/inventory/transfer/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        transferId: id,
      })

      return apiSuccess({ transfer: transferRecord })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching transfer record', error, {
      path: '/api/inventory/transfer/[id]',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat data transfer')
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
    const session: any = await getServerSession(authConfig as any)
    if (!session || !session.user) {
      return ApiErrors.unauthorized()
    }

    if (!(await hasPermission("transfer:create"))) {
      return ApiErrors.forbidden()
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

      return apiSuccess({ message: 'Transfer record berhasil diperbarui', transfer: transferRecord })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error updating transfer record', error, {
      path: '/api/inventory/transfer/[id]',
      method: 'PUT',
    })

    if (error.code === 'P2025') {
      return ApiErrors.notFound('Record transfer tidak ditemukan')
    }

    return ApiErrors.internalError('Gagal memperbarui record transfer')
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
    const session: any = await getServerSession(authConfig as any)
    if (!session || !session.user) {
      return ApiErrors.unauthorized()
    }

    if (!(await hasPermission("transfer:delete"))) {
      return ApiErrors.forbidden()
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

      return apiSuccess({ message: 'Transfer berhasil dibatalkan and stok dikembalikan' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error deleting transfer record', error, {
      path: '/api/inventory/transfer/[id]',
      method: 'DELETE',
    })

    if (error.message === 'Record transfer tidak ditemukan') {
      return ApiErrors.notFound('Record transfer tidak ditemukan')
    }
    if (error.message.includes('tidak mencukupi untuk pembatalan transfer') || error.message.includes('tidak ditemukan di gudang tujuan')) {
      return ApiErrors.badRequest(error.message)
    }

    return ApiErrors.internalError('Gagal membatalkan transfer')
  }
}