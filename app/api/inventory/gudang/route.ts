import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

/**
 * Generate automatic warehouse code
 */
async function generateGudangCode(): Promise<string> {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
  return `GD${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`
}

/**
 * @swagger
 * /api/inventory/gudang:
 *   get:
 *     summary: Get all warehouses
 *     description: Retrieve a list of all active warehouses in the inventory system
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of warehouses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gudangs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Gudang'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return ApiErrors.unauthorized('Unauthorized')
    }

    if (!(await hasPermission("gudang:read"))) {
      return ApiErrors.forbidden('Forbidden')
    }

    const inventoryRepository = getInventoryRepository()

    const { searchParams } = new URL(req.url)
    const viewAll = searchParams.get('view') === 'all'

    // Check for site restriction
    // const permissions = (session.user as any).permissions || []
    const permissions = await getUserPermissions(session.user.id!);
    const siteId = (session.user as { siteId?: string }).siteId
    const role = (session.user as { role?: string }).role

    // Only restrict if:
    // 1. User has restriction permission
    // 2. User has a site assigned
    // 3. User is NOT requesting (and authorized for) view=all
    //    (Super Admins or users with Admin Panel access can view all)
    const isSuper = isSuperAdmin(session.user as any)
    // ONLY Super Admin can bypass site restrictions via view=all
    // Other users with accessAdminPanel must still respect site_only permission
    const canViewAll = isSuper

    // Check strict site restriction
    // Support both administrative 'gudang:site_only' and mobile 'k_barang:site_only'
    const hasRestriction = permissions.includes('gudang:site_only') || permissions.includes('k_barang:site_only')
    let shouldRestrict: boolean = !!(hasRestriction && siteId)

    if (viewAll && canViewAll) {
      shouldRestrict = false
    }

    try {
      const dbStart = Date.now()
      const gudangs = await inventoryRepository.getAllGudang(shouldRestrict ? { siteId } : undefined)

      logger.dbOperation('findMany', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/gudang', 200, Date.now() - startTime, {
        gudangCount: gudangs.length,
        ...(session.user.id ? { userId: session.user.id } : {})
      })

      return apiSuccess({ gudangs })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error fetching gudangs', err, {
      path: '/api/inventory/gudang',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat data gudang')
  }
}

/**
 * @swagger
 * /api/inventory/gudang:
 *   post:
 *     summary: Create new warehouse
 *     description: Add a new warehouse to the inventory system
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nama
 *             properties:
 *               nama:
 *                 type: string
 *                 description: Warehouse name
 *                 example: "Gudang Utama"
 *               lokasi:
 *                 type: string
 *                 description: Warehouse location
 *                 example: "Jakarta Pusat"
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *                 description: Whether the warehouse is active
 *                 default: true
 *     responses:
 *       201:
 *         description: Warehouse created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gudang:
 *                   $ref: '#/components/schemas/Gudang'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return ApiErrors.unauthorized('Unauthorized')
    }

    if (!(await hasPermission("gudang:create"))) {
      return ApiErrors.forbidden('Forbidden')
    }

    const inventoryRepository = getInventoryRepository()

    const body = await req.json()
    const { nama, lokasi, isActive, siteIds } = body

    // Validation
    if (!nama) {
      return ApiErrors.badRequest('Nama gudang harus diisi')
    }

    // Note: siteIds is optional, gudang-site relationship managed from Site menu

    try {
      const dbStart = Date.now()

      // Generate automatic gudang code
      const kode = await generateGudangCode()

      // NEW: Enforce Site Restriction on Creation
      // const permissions = (session.user as any).permissions || []
      const permissions = await getUserPermissions(session.user.id!);
      const isSuper = isSuperAdmin(session.user as any)
      const userSiteId = (session.user as { siteId?: string }).siteId

      let finalSiteIds = siteIds
      const hasRestriction = permissions.includes('gudang:site_only') || permissions.includes('k_barang:site_only')

      if (!isSuper && hasRestriction) {
        if (userSiteId) {
          finalSiteIds = [userSiteId] // Force assignment to user's site
        }
      }

      const gudang = await inventoryRepository.createGudang({
        kode,
        nama,
        isActive: isActive ?? true,
        ...(lokasi ? { lokasi } : {}),
        ...(finalSiteIds ? { siteIds: finalSiteIds } : {})
      })

      logger.dbOperation('create', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/gudang', 201, Date.now() - startTime, {
        gudangId: gudang.id,
        kode: gudang.kode,
        ...(session.user.id ? { userId: session.user.id } : {})
      })

      // System Log
      try {
        await logger.logActivity({
          action: 'CREATE',
          subject: 'Gudang',
          details: { id: gudang.id, name: gudang.nama, code: gudang.kode },
          ...(session.user.id ? { userId: session.user.id } : {})
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      return apiSuccess({ gudang }, { status: 201 })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error creating gudang', err, {
      path: '/api/inventory/gudang',
      method: 'POST',
    })
    return ApiErrors.internalError('Gagal membuat gudang')
  }
}