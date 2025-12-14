import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { networkPerformanceQuerySchema } from '@/lib/validations/network-performance'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * @swagger
 * /api/network/performance:
 *   get:
 *     summary: Get all network performance data
 *     description: Mengambil semua data performa jaringan dengan filter
 *     tags: [Network Performance]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: string
 *         description: Filter by device ID
 *       - in: query
 *         name: deviceType
 *         schema:
 *           type: string
 *           enum: [OLT, MIKROTIK, ONU]
 *         description: Filter by device type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Network performance data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NetworkPerformance'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function GET(req: Request) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const parsed = networkPerformanceQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const filters = parsed.data
    const where: any = {}

    if (filters.deviceId) where.deviceId = filters.deviceId
    if (filters.deviceType) where.deviceType = filters.deviceType

    if (filters.startDate || filters.endDate) {
      where.timestamp = {}
      if (filters.startDate) where.timestamp.gte = new Date(filters.startDate)
      if (filters.endDate) where.timestamp.lte = new Date(filters.endDate)
    }

    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const orderBy: any = {}
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
      orderBy.timestamp = 'desc'
    }

    // Using a simple approach without repository pattern for now
    // This will work once the Prisma schema is updated and migrations are run
    try {
      const [data, total] = await Promise.all([
        // @ts-ignore - Will work after schema update
        prisma.networkPerformance.findMany({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        // @ts-ignore - Will work after schema update
        prisma.networkPerformance.count({ where }),
      ])

      return NextResponse.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (prismaError: any) {
      // Handle case where model doesn't exist yet
      if (prismaError.code === 'P2021') {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
          message: 'Network performance monitoring will be available after database migration'
        })
      }
      throw prismaError
    }
  } catch (error: any) {
    console.error('Error fetching network performance data:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal memuat data performa jaringan' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/network/performance:
 *   post:
 *     summary: Create new network performance data
 *     description: Membuat data performa jaringan baru
 *     tags: [Network Performance]
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
 *               - deviceId
 *               - deviceType
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device ID
 *               deviceType:
 *                 type: string
 *                 enum: [OLT, MIKROTIK, ONU]
 *                 description: Device type
 *               cpuUsage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: CPU usage percentage
 *               memoryUsage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Memory usage percentage
 *               temperature:
 *                 type: number
 *                 description: Device temperature in Celsius
 *               uptime:
 *                 type: number
 *                 description: Device uptime in seconds
 *               rxBytes:
 *                 type: number
 *                 description: Received bytes
 *               txBytes:
 *                 type: number
 *                 description: Transmitted bytes
 *               rxPackets:
 *                 type: number
 *                 description: Received packets
 *               txPackets:
 *                 type: number
 *                 description: Transmitted packets
 *               rxDrops:
 *                 type: number
 *                 description: Dropped received packets
 *               txDrops:
 *                 type: number
 *                 description: Dropped transmitted packets
 *               rxErrors:
 *                 type: number
 *                 description: Received packet errors
 *               txErrors:
 *                 type: number
 *                 description: Transmitted packet errors
 *               interfaceStatus:
 *                 type: object
 *                 description: Interface status information
 *               connectionCount:
 *                 type: integer
 *                 minimum: 0
 *                 description: Number of active connections
 *               bandwidthUsage:
 *                 type: number
 *                 minimum: 0
 *                 description: Current bandwidth usage in Mbps
 *               signalStrength:
 *                 type: number
 *                 description: Signal strength in dBm
 *               powerLevel:
 *                 type: string
 *                 description: Power level status
 *               customMetrics:
 *                 type: object
 *                 description: Custom device-specific metrics
 *     responses:
 *       201:
 *         description: Network performance data created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function POST(req: Request) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const { networkPerformanceCreateSchema } = await import('@/lib/validations/network-performance')
    const parsed = networkPerformanceCreateSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    try {
      const result = await prisma.networkPerformance.create({
        data: {
          deviceId: data.deviceId,
          deviceType: data.deviceType,
          cpuUsage: data.cpuUsage,
          memoryUsage: data.memoryUsage,
          temperature: data.temperature,
          uptime: data.uptime ? BigInt(data.uptime) : undefined,
          rxBytes: data.rxBytes ? BigInt(data.rxBytes) : undefined,
          txBytes: data.txBytes ? BigInt(data.txBytes) : undefined,
          rxPackets: data.rxPackets ? BigInt(data.rxPackets) : undefined,
          txPackets: data.txPackets ? BigInt(data.txPackets) : undefined,
          rxDrops: data.rxDrops ? BigInt(data.rxDrops) : undefined,
          txDrops: data.txDrops ? BigInt(data.txDrops) : undefined,
          rxErrors: data.rxErrors ? BigInt(data.rxErrors) : undefined,
          txErrors: data.txErrors ? BigInt(data.txErrors) : undefined,
          interfaceStatus: data.interfaceStatus,
          connectionCount: data.connectionCount,
          bandwidthUsage: data.bandwidthUsage,
          signalStrength: data.signalStrength,
          powerLevel: data.powerLevel,
          customMetrics: data.customMetrics,
        },
      })

      return NextResponse.json({ id: result.id }, { status: 201 })
    } catch (prismaError: any) {
      throw prismaError
    }
  } catch (error: any) {
    console.error('Error creating network performance data:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal membuat data performa jaringan' },
      { status: 500 }
    )
  }
}