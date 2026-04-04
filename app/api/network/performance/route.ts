import { randomUUID } from 'crypto'
import { networkPerformanceQuerySchema } from '@/lib/validations/network-performance'
import { prisma } from '@/modules/database'
import { Prisma } from '@prisma/client'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

// Import dynamically in POST handler or define static if needed.
// To use with createHandler schema option, we should import it.
// Assuming it's safe to import.
import { networkPerformanceCreateSchema } from '@/lib/validations/network-performance'

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
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    const { searchParams } = req.nextUrl
    const queryParams = Object.fromEntries(searchParams.entries())

    const parsed = networkPerformanceQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid query parameters', { errors: parsed.error.flatten() })
    }

    const filters = parsed.data
    const where: Record<string, unknown> = {}

    if (filters.deviceId) where.deviceId = filters.deviceId
    if (filters.deviceType) where.deviceType = filters.deviceType

    if (filters.startDate || filters.endDate) {
      const timestamp: Record<string, Date> = {}
      if (filters.startDate) timestamp.gte = new Date(filters.startDate)
      if (filters.endDate) timestamp.lte = new Date(filters.endDate)
      where.timestamp = timestamp
    }

    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const orderBy: Record<string, string> = {}
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
      orderBy.timestamp = 'desc'
    }

    // Using a simple approach without repository pattern for now
    // This will work once the Prisma schema is updated and migrations are run
    try {
      const [data, total] = await Promise.all([
        prisma.networkPerformance.findMany({
          where: where as Prisma.NetworkPerformanceWhereInput,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.networkPerformance.count({ where: where as Prisma.NetworkPerformanceWhereInput }),
      ])

      return apiSuccess({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError instanceof Error && (prismaError as unknown as Record<string, unknown>).code === 'P2021') {
        return apiSuccess({
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
})

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
export const POST = createHandler({ 
    auth: true,
    schema: networkPerformanceCreateSchema
}, async (req, ctx) => {
    const data = ctx.validated

    try {
      const result = await prisma.networkPerformance.create({
        data: {
          id: randomUUID(),
          deviceId: data.deviceId,
          deviceType: data.deviceType,
          cpuUsage: data.cpuUsage ?? null,
          memoryUsage: data.memoryUsage ?? null,
          temperature: data.temperature ?? null,
          uptime: data.uptime ? BigInt(data.uptime) : null,
          rxBytes: data.rxBytes ? BigInt(data.rxBytes) : null,
          txBytes: data.txBytes ? BigInt(data.txBytes) : null,
          rxPackets: data.rxPackets ? BigInt(data.rxPackets) : null,
          txPackets: data.txPackets ? BigInt(data.txPackets) : null,
          rxDrops: data.rxDrops ? BigInt(data.rxDrops) : null,
          txDrops: data.txDrops ? BigInt(data.txDrops) : null,
          rxErrors: data.rxErrors ? BigInt(data.rxErrors) : null,
          txErrors: data.txErrors ? BigInt(data.txErrors) : null,
          interfaceStatus: data.interfaceStatus ?? null,
          connectionCount: data.connectionCount ?? null,
          bandwidthUsage: data.bandwidthUsage ?? null,
          signalStrength: data.signalStrength ?? null,
          powerLevel: data.powerLevel ?? null,
          customMetrics: data.customMetrics ?? null,
          updatedAt: new Date(),
        },
      })

      return apiSuccess({ id: result.id }, { status: 201 })
    } catch (prismaError: unknown) {
      throw prismaError
    }
})
