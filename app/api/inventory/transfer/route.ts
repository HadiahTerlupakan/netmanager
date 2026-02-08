import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'
import { validateGudangAccess } from '@/lib/inventory-validation'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

/**
 * GET /api/inventory/transfer
 * Get all transfer records with filters
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authConfig)
    if (!session || !session.user) {
      return ApiErrors.unauthorized()
    }

    if (!(await hasPermission("transfer:read"))) {
      return ApiErrors.forbidden()
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId') || undefined
    const dariGudangId = searchParams.get('dariGudangId') || undefined
    const keGudangId = searchParams.get('keGudangId') || undefined
    let siteId = searchParams.get('siteId') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // SITE RESTRICTION
    // const permissions = (session.user as any).permissions || []
    const permissions = await getUserPermissions(session.user.id);
    const user = session.user as { role?: string; siteId?: string };
    const isSuper = isSuperAdmin(user)

    if (!isSuper && (permissions.includes('transfer:site_only') || permissions.includes('k_barang:site_only'))) {
        siteId = user.siteId
    }

    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      const { items: transferList, total } = await inventoryRepository.findAllTransfers({
        skip: offset,
        take: limit,
        ...(barangId && { barangId }),
        ...(dariGudangId && { dariGudangId }),
        ...(keGudangId && { keGudangId }),
        ...(siteId && { siteId })
      })

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

      return apiSuccess({
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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error fetching transfer records', err, {
      path: '/api/inventory/transfer',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat data transfer')
  }
}

/**
 * POST /api/inventory/transfer
 * Create new transfer record
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authConfig)
    if (!session || !session.user) {
      return ApiErrors.unauthorized()
    }

    if (!(await hasPermission("transfer:create"))) {
      return ApiErrors.forbidden()
    }

    const inventoryRepository = getInventoryRepository()

    const body = await req.json()
    const {
      barangId,
      dariGudangId,
      keGudangId,
      jumlah,
      kondisi,
      keterangan,
      fotoBukti,
      fotoMetadata
    } = body

    // Validation
    if (!barangId || !dariGudangId || !keGudangId || !jumlah || jumlah <= 0) {
      return ApiErrors.badRequest('Barang, gudang sumber, gudang tujuan, dan jumlah harus diisi dengan benar')
    }

    if (dariGudangId === keGudangId) {
      return ApiErrors.badRequest('Gudang sumber dan tujuan tidak boleh sama')
    }

    // Validate photo data if provided
    if (fotoBukti && !Array.isArray(fotoBukti)) {
      return ApiErrors.badRequest('fotoBukti harus berupa array URL foto')
    }

    const accessDari = await validateGudangAccess(session, dariGudangId)
    if (!accessDari.allowed) {
      return ApiErrors.forbidden(`Gudang Sumber: ${accessDari.error}`)
    }

    const accessKe = await validateGudangAccess(session, keGudangId)
    if (!accessKe.allowed) {
      return ApiErrors.forbidden(`Gudang Tujuan: ${accessKe.error}`)
    }

    try {
      const dbStart = Date.now()

      const transferRecord = await inventoryRepository.createTransfer({
        barangId,
        dariGudangId,
        keGudangId,
        jumlah,
        kondisi,
        keterangan,
        userId: session.user.id,
        fotoBukti,
        fotoMetadata
      })

      logger.dbOperation('transaction', 'TransferAntarGudang+BarangMasuk+BarangKeluar+BarangGudang', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/transfer', 201, Date.now() - startTime, {
        userId: session.user.id,
        barangId,
        dariGudangId,
        keGudangId,
        jumlah,
        transferId: transferRecord.id,
        transferCode: transferRecord.kodeTransfer,
      })

      // System Log
      try {
        await logger.logActivity({
          action: 'CREATE',
          subject: 'Inventory Transfer',
          userId: session.user.id,
          details: { id: transferRecord.id, code: transferRecord.kodeTransfer, barangId, quantity: jumlah }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      return apiSuccess({
        message: 'Transfer barang antar gudang berhasil',
        transfer: transferRecord,
        kodeTransfer: transferRecord.kodeTransfer
      }, { status: 201 })

    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error creating transfer', err, {
      path: '/api/inventory/transfer',
      method: 'POST',
    })

    if (err.message === 'Barang tidak ditemukan') {
      return ApiErrors.notFound('Barang tidak ditemukan')
    }
    if (err.message.includes('Gudang') && (err.message.includes('tidak ditemukan') || err.message.includes('tidak aktif') || err.message.includes('sama'))) {
      return ApiErrors.badRequest(err.message)
    }
    if (err.message.includes('Stok tidak mencukupi') || err.message.includes('tidak mencukupi')) {
      return ApiErrors.badRequest(err.message)
    }

    return ApiErrors.internalError('Gagal melakukan transfer barang')
  }
}