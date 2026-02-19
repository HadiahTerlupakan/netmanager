import { Prisma } from '@prisma/client'
import { configurationRestoreCreateSchema } from '@/lib/validations/device-backup'
import { prisma } from '@/lib/prisma'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

/**
 * @swagger
 * /api/network/backups/{id}/restore:
 *   post:
 *     summary: Restore configuration from backup
 *     description: Memulih konfigurasi dari backup
 *     tags: [Configuration Restore]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Backup ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - deviceType
 *               - backupId
 *               - restoreName
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device ID
 *               deviceType:
 *                 type: string
 *                 enum: [OLT, MIKROTIK, ONU]
 *                 description: Device type
 *               backupId:
 *                 type: string
 *                 description: Backup ID to restore from
 *               restoreName:
 *                 type: string
 *                 description: Restore name
 *               description:
 *                 type: string
 *                 description: Restore description
 *               restoreMethod:
 *                 type: string
 *                 description: Restore method (SNMP, API, SSH, TELNET)
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Scheduled restore time
 *               rollbackEnabled:
 *                 type: boolean
 *                 default: false
 *                 description: Whether rollback is enabled
 *     responses:
 *       201:
 *         description: Configuration restore initiated successfully
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
 *       404:
 *         description: Backup not found
 *       500:
 *         description: Server error
 */
export const POST = createHandler({ 
    auth: true,
    schema: configurationRestoreCreateSchema
}, async (req, ctx) => {
    const { id } = ctx.params
    const data = ctx.validated
    
    // Verify backup exists
    try {
      const backup = await prisma.deviceBackups.findUnique({
          where: { id },
      })

      if (!backup) {
          return ApiErrors.notFound('Backup')
      }

      const result = await prisma.configurationRestores.create({
        data: {
          deviceId: data.deviceId,
          deviceType: data.deviceType,
          backupId: id,
          restoreName: data.restoreName,
          description: data.description,
          restoreMethod: data.restoreMethod,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
          rollbackEnabled: data.rollbackEnabled || false,
          createdBy: ctx.session!.user.id,
        } as unknown as Prisma.ConfigurationRestoresCreateInput,
      })

      return apiSuccess({ id: result.id }, { status: 201 })
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError instanceof Error && (prismaError as unknown as Record<string, unknown>).code === 'P2021') {
        return ApiErrors.internalError('Pemulihan konfigurasi akan tersedia setelah migrasi database')
      }
      throw prismaError
    }
})
