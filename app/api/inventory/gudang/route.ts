import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

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
export async function GET() {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/gudang')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const dbStart = Date.now()

      const gudangs = await prisma.gudang.findMany({
        where: {
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

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
export async function POST(req: Request) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/gudang')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

      const gudang = await prisma.gudang.create({
        data: {
          kode,
          nama,
          lokasi,
          isActive: isActive ?? true
        }
      })

      logger.dbOperation('create', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/gudang', 201, Date.now() - startTime, {
        userId: session.user.id,
        gudangId: gudang.id,
        kode: gudang.kode,
      })

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