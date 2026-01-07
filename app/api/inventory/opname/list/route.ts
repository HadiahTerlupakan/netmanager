import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { hasPermission } from '@/lib/rbac'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasPermission("opname:read"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
      const where: any = {}
      if (barangId) where.barangId = barangId
      if (gudangId) where.gudangId = gudangId

      // SITE RESTRICTION
      const permissions = (session.user as any).permissions || []
      const isSuperAdmin = (session.user as any).role === 'SUPER_ADMIN'
      
      if (!isSuperAdmin && (permissions.includes('opname:site_only') || permissions.includes('k_barang:site_only'))) {
          const userSiteId = (session.user as any).siteId
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

      return NextResponse.json({
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
  } catch (error: any) {
    logger.error('Error fetching stock opname list', error, {
      path: '/api/inventory/opname/list',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data stock opname' },
      { status: 500 }
    )
  }
}