import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { CreateReturnRequest, CreateReturnResponse } from '@/types/inventory-returns'



/**
 * Helper function to validate return request
 */
function validateReturnRequest(body: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!body.barangKeluarId) {
    errors.push('Barang keluar ID is required')
  }

  if (!body.jumlahDikembalikan || body.jumlahDikembalikan <= 0) {
    errors.push('Jumlah dikembalikan must be greater than 0')
  }

  if (!body.kondisiPengembalian) {
    errors.push('Kondisi pengembalian is required')
  } else if (!['BARU', 'BEKAS', 'RUSAK'].includes(body.kondisiPengembalian)) {
    errors.push('Kondisi pengembalian must be one of: BARU, BEKAS, RUSAK')
  }

  // Validate photo data if provided
  if (body.fotoBukti && !Array.isArray(body.fotoBukti)) {
    errors.push('fotoBukti must be an array of URLs')
  }

  if (body.fotoMetadata && typeof body.fotoMetadata !== 'object') {
    errors.push('fotoMetadata must be an object')
  }

  // Validate purpose if provided
  if (body.purpose && typeof body.purpose !== 'string') {
    errors.push('Purpose must be a string')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Helper function to check if user can access this BarangKeluar
 */
async function canAccessBarangKeluar(barangKeluarId: string, session: any): Promise<boolean> {
  // All authenticated users can access (role-based access handled at UI level)
  return !!session?.user
}

/**
 * Helper function to calculate returnable quantity for a BarangKeluar
 */
async function getReturnableQuantity(barangKeluarId: string): Promise<number> {
  // Get original BarangKeluar record
  const barangKeluar = await prisma.barangKeluar.findUnique({
    where: { id: barangKeluarId },
    select: { jumlah: true }
  })

  if (!barangKeluar) {
    return 0
  }

  // Calculate total quantity already returned for this BarangKeluar
  // Note: This assumes we have a BarangReturn table, for now we'll return full quantity
  // In a real implementation, you would query the returns table
  const totalReturned = 0 // Placeholder - would be calculated from returns table

  return Math.max(0, barangKeluar.jumlah - totalReturned)
}

/**
 * POST /api/inventory/returns
 * Process a return transaction for borrowed items
 * 
 * Request body:
 * - barangKeluarId: string (required)
 * - jumlahDikembalikan: number (required)
 * - kondisiPengembalian: 'BARU' | 'BEKAS' | 'RUSAK' (required)
 * - keterangan?: string (optional)
 * - fotoBukti?: string[] (optional)
 * - fotoMetadata?: any (optional)
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    // Authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/returns', {
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent')
      })
      return NextResponse.json(
        { error: 'Unauthorized - Admin or Employee access required' },
        { status: 401 }
      )
    }

    if (!(await hasPermission("returns:create"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()

    // Validate request body
    const validation = validateReturnRequest(body)
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    const {
      barangKeluarId,
      jumlahDikembalikan,
      kondisiPengembalian,
      keterangan,
      fotoBukti,
      fotoMetadata,
      purpose
    } = body as CreateReturnRequest

    try {
      const dbStart = Date.now()

      // Check if user can access this BarangKeluar
      const canAccess = await canAccessBarangKeluar(barangKeluarId, session)
      if (!canAccess) {
        logger.warn('Access denied to BarangKeluar for return', {
          userId: session.user.id,
          barangKeluarId,
        })
        return NextResponse.json(
          { error: 'Access denied - You can only return your own borrowed items' },
          { status: 403 }
        )
      }

      // Get BarangKeluar details and validate returnable quantity
      const barangKeluar = await prisma.barangKeluar.findUnique({
        where: { id: barangKeluarId },
        include: {
          barang: { select: { id: true, kode: true, nama: true, satuan: true } },
          gudang: { select: { id: true, kode: true, nama: true } }
        }
      })

      if (!barangKeluar) {
        return NextResponse.json(
          { error: 'Barang keluar tidak ditemukan' },
          { status: 404 }
        )
      }

      const returnableQuantity = await getReturnableQuantity(barangKeluarId)
      if (jumlahDikembalikan > returnableQuantity) {
        return NextResponse.json(
          {
            error: 'Jumlah pengembalian melebihi jumlah yang dapat dikembalikan',
            maxReturnable: returnableQuantity,
            requested: jumlahDikembalikan
          },
          { status: 400 }
        )
      }

      // Process the return in a transaction
      const returnRecord = await prisma.$transaction(async (tx) => {
        // Create BarangMasuk record for the returned items
        const fullKeterangan = [
          keterangan || `Pengembalian dari transaksi keluar ${barangKeluarId}`,
          purpose ? `Keperluan: ${purpose}` : null
        ].filter(Boolean).join(' | ')

        const barangMasuk = await tx.barangMasuk.create({
          data: {
            id: crypto.randomUUID(),
            barangId: barangKeluar.barangId,
            gudangId: barangKeluar.gudangId,
            tanggal: new Date(),
            jumlah: jumlahDikembalikan,
            kondisi: kondisiPengembalian,
            keterangan: fullKeterangan,
            fotoBukti: fotoBukti || [],
            fotoMetadata: fotoMetadata || null
          }
        })

        // Update stock in BarangGudang
        const existingStock = await tx.barangGudang.findUnique({
          where: {
            barangId_gudangId: {
              barangId: barangKeluar.barangId,
              gudangId: barangKeluar.gudangId
            }
          }
        })

        if (existingStock) {
          // Update existing stock
          await tx.barangGudang.update({
            where: {
              barangId_gudangId: {
                barangId: barangKeluar.barangId,
                gudangId: barangKeluar.gudangId
              }
            },
            data: {
              stok: existingStock.stok + jumlahDikembalikan
            }
          })
        } else {
          // Create new stock record
          await tx.barangGudang.create({
            data: {
              id: crypto.randomUUID(),
              barangId: barangKeluar.barangId,
              gudangId: barangKeluar.gudangId,
              stok: jumlahDikembalikan,
              updatedAt: new Date()
            }
          })
        }

        // In a real implementation, you would also create a BarangReturn record here
        // const barangReturn = await tx.barangReturn.create({
        //   data: {
        //     barangKeluarId,
        //     barangMasukId: barangMasuk.id,
        //     employeeId: session.user.id,
        //     tanggalPengembalian: new Date(),
        //     jumlahDikembalikan,
        //     kondisiPengembalian,
        //     keterangan,
        //     fotoBukti: fotoBukti || [],
        //     fotoMetadata: fotoMetadata || null
        //   }
        // })

        logger.dbOperation('transaction', 'BarangMasuk+BarangGudang', Date.now() - dbStart)

        return {
          id: barangMasuk.id,
          barangMasukId: barangMasuk.id,
          barangKeluarId: barangKeluarId, // Add missing property
          // barangReturnId: barangReturn?.id, // Uncomment when BarangReturn table is implemented
          employeeId: session.user.id as string,
          tanggalPengembalian: new Date(),
          jumlahDikembalikan,
          kondisiPengembalian,
          keterangan,
          fotoBukti: fotoBukti || [],
          fotoMetadata: fotoMetadata || null,
          createdAt: barangMasuk.createdAt,
          updatedAt: barangMasuk.createdAt // Use createdAt since updatedAt doesn't exist
        }
      })

      logger.apiRequest('POST', '/api/inventory/returns', 201, Date.now() - startTime, {
        userId: session.user.id,
        barangKeluarId,
        jumlahDikembalikan,
        kondisiPengembalian,
        returnId: returnRecord.id
      })

      // System Log
      try {
        await logger.logActivity({
          action: 'CREATE',
          subject: 'Inventory Return',
          userId: session.user.id,
          details: {
            id: returnRecord.id,
            barangId: barangKeluar.barangId,
            gudangId: barangKeluar.gudangId,
            quantity: jumlahDikembalikan
          }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      const response: CreateReturnResponse = {
        message: 'Barang berhasil dikembalikan',
        returnId: returnRecord.id,
        data: returnRecord
      }

      return NextResponse.json(response, { status: 201 })

    } finally {
      // Do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error processing barang return', error, {
      path: '/api/inventory/returns',
      method: 'POST',
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent')
    })

    // Handle specific error cases
    if (error.message === 'Barang keluar tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (error.message.includes('Access denied')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    if (error.message.includes('Jumlah pengembalian')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Gagal memproses pengembalian barang' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/inventory/returns
 * Get all return transactions (admin only)
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    // Authentication - only ADMIN can access all returns
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/returns', {
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent')
      })
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    if (!(await hasPermission("returns:read"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const employeeId = searchParams.get('employeeId')

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()

      // Build where clause for filtering
      const where: any = {}

      // Add optional filters
      if (barangId) where.barangId = barangId
      if (gudangId) where.gudangId = gudangId
      if (employeeId) where.employeeId = employeeId

      // Add search condition
      if (search) {
        where.OR = [
          { barang: { nama: { contains: search, mode: 'insensitive' } } },
          { barang: { kode: { contains: search, mode: 'insensitive' } } },
          { keterangan: { contains: search, mode: 'insensitive' } }
        ]
      }

      // Get return records (placeholder - would query from BarangReturn table when implemented)
      // For now, we'll return an empty array with pagination info
      const returnRecords: any[] = [] // Placeholder - explicitly typed as any[]
      const total = 0 // Placeholder

      logger.dbOperation('findMany', 'BarangReturn', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/returns', 200, Date.now() - startTime, {
        userId: session.user.id,
        count: returnRecords.length,
        page,
        limit,
        total,
        search,
        barangId,
        gudangId,
        employeeId
      })

      return NextResponse.json({
        returns: returnRecords,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })

    } finally {
      // Do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching return records', error, {
      path: '/api/inventory/returns',
      method: 'GET',
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent')
    })

    return NextResponse.json(
      { error: 'Gagal memuat data pengembalian' },
      { status: 500 }
    )
  }
}
