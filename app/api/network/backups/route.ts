import { randomUUID } from 'crypto'
import { deviceBackupCreateSchema, deviceBackupQuerySchema } from '@/lib/validations/device-backup'
import { prisma } from '@/modules/database'
import { logActivitySafe } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

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
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    const { searchParams } = req.nextUrl
    const queryParams = Object.fromEntries(searchParams.entries())

    const parsed = deviceBackupQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid query parameters', { errors: parsed.error.flatten() })
    }

    const filters = parsed.data
    const where: Record<string, unknown> = {}

    if (filters.deviceId) where.deviceId = filters.deviceId
    if (filters.deviceType) where.deviceType = filters.deviceType
    if (filters.backupType) where.backupType = filters.backupType
    if (filters.status) where.status = filters.status

    if (filters.startDate || filters.endDate) {
      const createdAt: Record<string, Date> = {}
      if (filters.startDate) createdAt.gte = new Date(filters.startDate)
      if (filters.endDate) createdAt.lte = new Date(filters.endDate)
      where.createdAt = createdAt
    }

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
        prisma.deviceBackups.findMany({
          where: where as Prisma.DeviceBackupsWhereInput,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.deviceBackups.count({ where: where as Prisma.DeviceBackupsWhereInput }),
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
          message: 'Device backups will be available after database migration'
        })
      }
      throw prismaError
    }
})

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
export const POST = createHandler({ 
    auth: true,
    schema: deviceBackupCreateSchema
}, async (req, ctx) => {
    const data = ctx.validated

    try {
      const result = await prisma.deviceBackups.create({
        data: {
          id: randomUUID(),
          deviceId: data.deviceId,
          deviceType: data.deviceType,
          backupName: data.backupName,
          description: data.description ?? null,
          backupType: data.backupType,
          filePath: data.filePath,
          fileSize: data.fileSize,
          fileHash: data.fileHash ?? null,
          compressionType: data.compressionType ?? null,
          isEncrypted: data.isEncrypted,
          encryptionKey: data.encryptionKey ?? null,
          backupMethod: data.backupMethod ?? null,
          status: data.status,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          createdBy: ctx.session!.user.id,
          retentionDays: data.retentionDays ?? null,
          isAutoCleanup: data.isAutoCleanup,
          updatedAt: new Date(),
        },
      })

      // System Log
      logActivitySafe({
        action: 'CREATE',
        subject: 'Device Backup',
        userId: ctx.session!.user.id,
        details: { id: result.id, name: data.backupName, deviceId: data.deviceId }
      })

      return apiSuccess({ id: result.id }, { status: 201 })
    } catch (prismaError: unknown) {
      throw prismaError
    }
})
