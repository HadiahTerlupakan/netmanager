import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasPermission("gudang:read"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const inventoryRepository = getInventoryRepository()

    const { searchParams } = new URL(req.url)
    const viewAll = searchParams.get('view') === 'all'

    // Check for site restriction
    const permissions = (session.user as any).permissions || []
    const siteId = (session.user as any).siteId
    const role = (session.user as any).role

    // Only restrict if:
    // 1. User has restriction permission
    // 2. User has a site assigned
    // 3. User is NOT requesting (and authorized for) view=all
    //    (Super Admins or users with Admin Panel access can view all)
    const isSuperAdmin = role === 'SUPER_ADMIN'
    const hasAdminAccess = (session.user as any).accessAdminPanel

    const canViewAll = isSuperAdmin || hasAdminAccess

    let shouldRestrict = permissions.includes('k_barang:site_only') && siteId

    if (viewAll && canViewAll) {
      shouldRestrict = false
    }

    try {
      const dbStart = Date.now()
      const gudangs = await inventoryRepository.getAllGudang(shouldRestrict ? { siteId } : undefined)

      logger.dbOperation('findMany', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/gudang', 200, Date.now() - startTime, {
        userId: session.user.id,
        gudangCount: gudangs.length,
      })

      return NextResponse.json({ gudangs })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching gudangs', error, {
      path: '/api/inventory/gudang',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data gudang' },
      { status: 500 }
    )
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasPermission("gudang:create"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const inventoryRepository = getInventoryRepository()

    const body = await req.json()
    const { nama, lokasi, isActive } = body

    // Validation
    if (!nama) {
      return NextResponse.json(
        { error: 'Nama gudang harus diisi' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()

      // Generate automatic gudang code
      const kode = await generateGudangCode()

      const gudang = await inventoryRepository.createGudang({
        kode,
        nama,
        lokasi,
        isActive: isActive ?? true
      })

      logger.dbOperation('create', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/gudang', 201, Date.now() - startTime, {
        userId: session.user.id,
        gudangId: gudang.id,
        kode: gudang.kode,
      })

      // System Log
      try {
        await logger.logActivity({
          action: 'CREATE',
          subject: 'Gudang',
          userId: session.user.id,
          details: { id: gudang.id, name: gudang.nama, code: gudang.kode }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      return NextResponse.json({ gudang }, { status: 201 })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error creating gudang', error, {
      path: '/api/inventory/gudang',
      method: 'POST',
    })
    return NextResponse.json(
      { error: 'Gagal membuat gudang' },
      { status: 500 }
    )
  }
}