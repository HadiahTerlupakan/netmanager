import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * GET /api/inventory/barang/stock
 * Get current stock for specific barang and gudang
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/barang/stock')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')

    if (!barangId || !gudangId) {
      return apiError('Barang ID dan Gudang ID harus diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    try {
      const dbStart = Date.now()

      // Get current stock for this barang-gudang combination
      const barangGudang = await prisma.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId,
            gudangId
          }
        },
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

      logger.dbOperation('findUnique', 'BarangGudang+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/barang/stock', 200, Date.now() - startTime, {
        userId: session.user.id,
        barangId,
        gudangId,
        stock: barangGudang?.stok || 0
      })

      return apiSuccess({
        stok: barangGudang?.stok || 0,
        barang: barangGudang?.barang,
        gudang: barangGudang?.gudang
      })

    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching stock information', error, {
      path: '/api/inventory/barang/stock',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal mengambil informasi stok')
  }
}