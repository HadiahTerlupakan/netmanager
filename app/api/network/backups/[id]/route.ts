import { prisma } from '@/lib/prisma'
import { logActivitySafe } from '@/lib/logger'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

/**
 * @swagger
 * /api/network/backups/{id}:
 *   get:
 *     summary: Get device backup by ID
 *     description: Mengambil data backup perangkat berdasarkan ID
 *     tags: [Device Backups]
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
 *     responses:
 *       200:
 *         description: Device backup retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceBackup'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Backup not found
 *       500:
 *         description: Server error
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params

    try {
      const backup = await prisma.deviceBackups.findUnique({
        where: { id },
      })

      if (!backup) {
        return ApiErrors.notFound('Backup')
      }

      return apiSuccess({ data: backup })
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError instanceof Error && (prismaError as unknown as Record<string, unknown>).code === 'P2021') {
        return ApiErrors.internalError('Device backups will be available after database migration')
      }
      throw prismaError
    }
})

/**
 * @swagger
 * /api/network/backups/{id}:
 *   delete:
 *     summary: Delete device backup
 *     description: Menghapus data backup perangkat
 *     tags: [Device Backups]
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
 *     responses:
 *       200:
 *         description: Device backup deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Backup not found
 *       500:
 *         description: Server error
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params

    try {
      const backup = await prisma.deviceBackups.findUnique({
        where: { id },
      })

      if (!backup) {
        return ApiErrors.notFound('Backup')
      }

      await prisma.deviceBackups.delete({
        where: { id },
      })

      // System Log
      logActivitySafe({
        action: 'DELETE',
        subject: 'Device Backup',
        userId: ctx.session!.user.id,
        details: { id, name: backup.backupName }
      })

      return apiSuccess({ message: 'Backup berhasil dihapus' })
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError instanceof Error && (prismaError as unknown as Record<string, unknown>).code === 'P2021') {
        return ApiErrors.internalError('Device backups will be available after database migration')
      }
      throw prismaError
    }
})
