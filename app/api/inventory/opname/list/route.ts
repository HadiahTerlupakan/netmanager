import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/modules/database'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

async function requireAdmin() {
  const session = await getServerSession(authConfig)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * GET /api/inventory/opname/list
 * Get all stock opname records with filters and pagination
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/opname/list')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("opname:read"))) {
      return ApiErrors.forbidden('Akses ditolak')
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    try {
      const dbStart = Date.now()

      // Build where clause
      const where: Prisma.StockOpnameWhereInput = {}
      if (barangId) where.barangId = barangId
      if (gudangId) where.gudangId = gudangId

      // SITE RESTRICTION
      // const permissions = (session.user as any).permissions || []
      const permissions = await getUserPermissions(session.user.id);
      const isSuper = isSuperAdmin(session.user as { role?: string | null; isSuperAdmin?: boolean })

      if (!isSuper && (permissions.includes('opname:site_only') || permissions.includes('k_barang:site_only'))) {
          const userSiteId = session.user.siteId
          if (userSiteId) {
               where.gudang = {
                   sites: {
                       some: {
                           id: userSiteId
                       }
                   }
               }
          }
      }

      const [opnameList, total] = await Promise.all([
        prisma.stockOpname.findMany({
          where,
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
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: offset,
          take: limit
        }),
        prisma.stockOpname.count({ where })
      ])

      logger.dbOperation('findMany', 'StockOpname+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/opname/list', 200, Date.now() - startTime, {
        userId: session.user.id,
        count: opnameList.length,
        page,
        limit,
        total,
        barangId,
        gudangId,
      })

      return apiSuccess({
        opnameList,
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
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Error fetching stock opname list', err, {
      path: '/api/inventory/opname/list',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat data stock opname')
  }
}