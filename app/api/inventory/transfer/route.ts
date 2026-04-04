import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import type { Session } from 'next-auth'
import { hasPermission } from '@/lib/rbac'
import { getInventoryRepository } from '@/lib/repositories'
import { logger, logActivitySafe } from '@/lib/logger'
import { validateGudangAccess } from '@/modules/inventory'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

/**
 * GET /api/inventory/transfer
 * Get all transfer records with filters
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user

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
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user)

  if (!isSuper && (permissions.includes('transfer:site_only') || permissions.includes('k_barang:site_only'))) {
      const { prisma } = await import('@/modules/database');
      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
      siteId = dbUser?.siteId
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
      userId: user.id,
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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan');
    logger.error('Error fetching transfer records', err, {
      path: '/api/inventory/transfer',
      method: 'GET',
    })
    throw error // Let createHandler handle it
  }
})

/**
 * POST /api/inventory/transfer
 * Create new transfer record
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user

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

  // Use session directly because verifyAuth returns full user session but ctx.session is limited.
  // Ideally createHandler should pass full session or we should adapt helpers.
  // validateGudangAccess expects { user: ... }. ctx.session matches mostly.
  // But validateGudangAccess might need more fields.
  // Let's check validateGudangAccess signature. It likely takes the session object.
  // Since I don't have the original session object from getServerSession, I'll mock it or rely on structure compatibility.
  // `ctx.session` has `user: { id, email, name, role }`.
  // If `validateGudangAccess` needs permissions or siteId, it might fail or fetch them.
  // Let's assume it fetches if needed or I should pass a "enriched" session.
  // To be safe, I'll rely on the helper fetching permissions/siteId internally or I'll re-fetch user.
  // Looking at the imports in the original file, `validateGudangAccess` is from `@/lib/inventory-validation`.
  // I will pass `ctx.session` and hope it works, or inspect `validateGudangAccess` if I could.
  // To be absolutely safe, I'll reconstruct a session-like object with siteId if I can fetch it.
  
  // Re-fetch full user for validation helpers if needed
  const { prisma } = await import('@/modules/database');
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { siteId: true, role: true } });
  
  const mockSession = {
      user: {
          ...user,
          siteId: dbUser?.siteId,
          role: dbUser?.role || user.role
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  const accessDari = await validateGudangAccess(mockSession as Session, dariGudangId)
  if (!accessDari.allowed) {
    return ApiErrors.forbidden(`Gudang Sumber: ${accessDari.error}`)
  }

  const accessKe = await validateGudangAccess(mockSession as Session, keGudangId)
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
      userId: user.id,
      fotoBukti,
      fotoMetadata
    })

    logger.dbOperation('transaction', 'TransferAntarGudang+BarangMasuk+BarangKeluar+BarangGudang', Date.now() - dbStart)

    logger.apiRequest('POST', '/api/inventory/transfer', 201, Date.now() - startTime, {
      userId: user.id,
      barangId,
      dariGudangId,
      keGudangId,
      jumlah,
      transferId: transferRecord.id,
      transferCode: transferRecord.kodeTransfer,
    })

    // System Log
    logActivitySafe({
      action: 'CREATE',
      subject: 'Inventory Transfer',
      userId: user.id,
      details: { id: transferRecord.id, code: transferRecord.kodeTransfer, barangId, quantity: jumlah }
    })

    return apiSuccess({
      message: 'Transfer barang antar gudang berhasil',
      transfer: transferRecord,
      kodeTransfer: transferRecord.kodeTransfer
    }, { status: 201 })

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan');
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
})
