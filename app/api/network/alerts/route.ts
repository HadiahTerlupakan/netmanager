import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { networkAlertCreateSchema, networkAlertQuerySchema } from '@/lib/validations/network-performance'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session = await getServerSession(authConfig)
  if (!session) {
    return null
  }
  return session
}

/**
 * @swagger
 * /api/network/alerts:
 *   get:
 *     summary: Get all network alerts
 *     description: Mengambil semua alert jaringan dengan filter
 *     tags: [Network Alerts]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, ACKNOWLEDGED, RESOLVED, SUPPRESSED]
 *         description: Filter by alert status
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [CRITICAL, WARNING, INFO]
 *         description: Filter by alert severity
 *       - in: query
 *         name: acknowledged
 *         schema:
 *           type: boolean
 *         description: Filter by acknowledgment status
 *       - in: query
 *         name: resolved
 *         schema:
 *           type: boolean
 *         description: Filter by resolution status
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
 *         description: Network alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NetworkAlert'
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
    if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const parsed = networkAlertQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const filters = parsed.data
    const where: Record<string, unknown> = { isActive: true }

    if (filters.deviceId) where.deviceId = filters.deviceId
    if (filters.deviceType) where.deviceType = filters.deviceType
    if (filters.status) where.status = filters.status
    if (filters.severity) where.severity = filters.severity
    if (filters.alertType) where.alertType = filters.alertType
    if (filters.acknowledged !== undefined) where.acknowledged = filters.acknowledged
    if (filters.resolved !== undefined) where.resolved = filters.resolved

    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const orderBy: Record<string, string> = {}
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
      orderBy.createdAt = 'desc'
    }

    try {
      const [data, total] = await Promise.all([
        prisma.networkAlerts.findMany({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.networkAlerts.count({ where }),
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
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError instanceof Error && (prismaError as unknown as Record<string, unknown>).code === 'P2021') {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
          message: 'Network alerts will be available after database migration'
        })
      }
      throw prismaError
    }
  } catch (error: unknown) {
    console.error('Error fetching network alerts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal memuat data alert jaringan' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/network/alerts:
 *   post:
 *     summary: Create new network alert
 *     description: Membuat alert jaringan baru
 *     tags: [Network Alerts]
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
 *               - title
 *               - message
 *               - severity
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device ID
 *               deviceType:
 *                 type: string
 *                 enum: [OLT, MIKROTIK, ONU]
 *                 description: Device type
 *               alertType:
 *                 type: string
 *                 enum: [CRITICAL, WARNING, INFO]
 *                 description: Alert type
 *               title:
 *                 type: string
 *                 description: Alert title
 *               message:
 *                 type: string
 *                 description: Alert message
 *               severity:
 *                 type: string
 *                 enum: [CRITICAL, WARNING, INFO]
 *                 description: Alert severity
 *               threshold:
 *                 type: number
 *                 description: Alert threshold value
 *               currentValue:
 *                 type: number
 *                 description: Current value that triggered the alert
 *               metricName:
 *                 type: string
 *                 description: Name of the metric that triggered the alert
 *               autoResolve:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the alert should auto-resolve
 *               autoResolveTime:
 *                 type: integer
 *                 minimum: 1
 *                 description: Auto-resolve time in minutes
 *     responses:
 *       201:
 *         description: Network alert created successfully
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
    if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

    const json = await req.json()
    const parsed = networkAlertCreateSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    try {
      const result = await prisma.networkAlerts.create({
        data: {
          id: randomUUID(),
          deviceId: data.deviceId,
          deviceType: data.deviceType,
          alertType: data.alertType,
          title: data.title,
          message: data.message,
          severity: data.severity,
          threshold: data.threshold ?? null,
          currentValue: data.currentValue ?? null,
          metricName: data.metricName ?? null,
          autoResolve: data.autoResolve || false,
          autoResolveTime: data.autoResolveTime ?? null,
          updatedAt: new Date(),
        },
      })

      // System Log
      try {
        const { logger } = await import('@/lib/logger')
        await logger.logActivity({
          action: 'CREATE',
          subject: 'Network Alert',
          userId: (session as { user: { id: string } }).user.id,
          details: { id: result.id, title: data.title, severity: data.severity, deviceId: data.deviceId }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      return NextResponse.json({ id: result.id }, { status: 201 })
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError instanceof Error && (prismaError as unknown as Record<string, unknown>).code === 'P2021') {
        return NextResponse.json(
          { error: 'Network alerts will be available after database migration' },
          { status: 503 }
        )
      }
      throw prismaError
    }
  } catch (error: unknown) {
    console.error('Error creating network alert:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal membuat alert jaringan' },
      { status: 500 }
    )
  }
}