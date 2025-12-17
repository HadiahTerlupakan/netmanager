import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { deviceBackupCreateSchema, deviceBackupQuerySchema } from '@/lib/validations/device-backup'
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
 * /api/network/backups:
 *   get:
 *     summary: Get all device backups
 *     description: Mengambil semua data backup perangkat dengan filter
 *     tags: [Device Backups]
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
 *         name: backupType
 *         schema:
 *           type: string
 *           enum: [MANUAL, SCHEDULED, AUTOMATIC]
 *         description: Filter by backup type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED]
 *         description: Filter by backup status
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
 *         description: Device backups retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DeviceBackup'
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

    const parsed = deviceBackupQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const filters = parsed.data
    const where: any = {}

    if (filters.deviceId) where.deviceId = filters.deviceId
    if (filters.deviceType) where.deviceType = filters.deviceType
    if (filters.backupType) where.backupType = filters.backupType
    if (filters.status) where.status = filters.status

    if (filters.startDate || filters.endDate) {
      where.createdAt = {}
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate)
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate)
    }

    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const orderBy: any = {}
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
      orderBy.createdAt = 'desc'
    }

    try {
      // @ts-ignore - Will work after schema update
      const [data, total] = await Promise.all([
        prisma.deviceBackup.findMany({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.deviceBackup.count({ where }),
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
          message: 'Device backups will be available after database migration'
        })
      }
      throw prismaError
    }
  } catch (error: any) {
    console.error('Error fetching device backups:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal memuat data backup perangkat' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/network/backups:
 *   post:
 *     summary: Create new device backup
 *     description: Membuat backup perangkat baru
 *     tags: [Device Backups]
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
 *               - backupName
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device ID
 *               deviceType:
 *                 type: string
 *                 enum: [OLT, MIKROTIK, ONU]
 *                 description: Device type
 *               backupName:
 *                 type: string
 *                 description: Backup name
 *               description:
 *                 type: string
 *                 description: Backup description
 *               backupType:
 *                 type: string
 *                 enum: [MANUAL, SCHEDULED, AUTOMATIC]
 *                 default: MANUAL
 *                 description: Backup type
 *               backupMethod:
 *                 type: string
 *                 description: Backup method (SNMP, API, SSH, TELNET)
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Scheduled backup time
 *               retentionDays:
 *                 type: integer
 *                 minimum: 1
 *                 default: 30
 *                 description: Number of days to retain backup
 *               isAutoCleanup:
 *                 type: boolean
 *                 default: false
 *                 description: Whether to automatically cleanup old backups
 *     responses:
 *       201:
 *         description: Device backup created successfully
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
    const parsed = deviceBackupCreateSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    try {
      const result = await prisma.deviceBackup.create({
        data: {
          deviceId: data.deviceId,
          deviceType: data.deviceType,
          backupName: data.backupName,
          description: data.description,
          backupType: data.backupType,
          filePath: data.filePath,
          fileSize: data.fileSize,
          fileHash: data.fileHash,
          compressionType: data.compressionType,
          isEncrypted: data.isEncrypted,
          encryptionKey: data.encryptionKey,
          backupMethod: data.backupMethod,
          status: data.status,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
          createdBy: session.user?.id,
          retentionDays: data.retentionDays,
          isAutoCleanup: data.isAutoCleanup,
        },
      })

      // System Log
      try {
        const { logger } = await import('@/lib/logger')
        await logger.logActivity({
          action: 'CREATE',
          subject: 'Device Backup',
          userId: session?.user?.id,
          details: { id: result.id, name: data.backupName, deviceId: data.deviceId }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      return NextResponse.json({ id: result.id }, { status: 201 })
    } catch (prismaError: any) {
      throw prismaError
    }
  } catch (error: any) {
    console.error('Error creating device backup:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal membuat backup perangkat' },
      { status: 500 }
    )
  }
}