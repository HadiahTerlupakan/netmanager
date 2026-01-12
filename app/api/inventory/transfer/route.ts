import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig, getUserPermissions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'
import { validateGudangAccess } from '@/lib/inventory-validation'

/**
 * GET /api/inventory/transfer
 * Get all transfer records with filters
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasPermission("transfer:read"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    const isSuperAdmin = (session.user as any).role === 'SUPER_ADMIN'
    
    if (!isSuperAdmin && (permissions.includes('transfer:site_only') || permissions.includes('k_barang:site_only'))) {
        siteId = (session.user as any).siteId
    }

    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      const { items: transferList, total } = await inventoryRepository.findAllTransfers({
        barangId,
        dariGudangId,
        keGudangId,
        skip: offset,
        take: limit,
        siteId
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
    const session: any = await getServerSession(authConfig as any)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasPermission("transfer:create"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    // Validate photo data if provided
    if (fotoBukti && !Array.isArray(fotoBukti)) {
      return NextResponse.json(
        { error: 'fotoBukti harus berupa array URL foto' },
        { status: 400 }
      )
    }

    const accessDari = await validateGudangAccess(session, dariGudangId)
    if (!accessDari.allowed) {
      return NextResponse.json({ error: `Gudang Sumber: ${accessDari.error}` }, { status: 403 })
    }

    const accessKe = await validateGudangAccess(session, keGudangId)
    if (!accessKe.allowed) {
      return NextResponse.json({ error: `Gudang Tujuan: ${accessKe.error}` }, { status: 403 })
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

      return NextResponse.json({
        message: 'Transfer barang antar gudang berhasil',
        transfer: transferRecord,
        kodeTransfer: transferRecord.kodeTransfer
      }, { status: 201 })

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
    if (error.message.includes('Gudang') && (error.message.includes('tidak ditemukan') || error.message.includes('tidak aktif') || error.message.includes('sama'))) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error.message.includes('Stok tidak mencukupi') || error.message.includes('tidak mencukupi')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Gagal melakukan transfer barang' },
      { status: 500 }
    )
  }
}