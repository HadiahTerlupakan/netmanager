import { networkAlertUpdateSchema } from '@/lib/validations/network-performance'
import { prisma } from '@/modules/database'
import { logActivitySafe } from '@/lib/logger'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

/**
 * @swagger
 * /api/network/alerts/{id}:
 *   get:
 *     summary: Get network alert by ID
 *     description: Mengambil data alert jaringan berdasarkan ID
 *     tags: [Network Alerts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Network alert retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NetworkAlert'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Server error
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params

    try {
      const alert = await prisma.networkAlerts.findUnique({
        where: { id },
      })

      if (!alert) {
        return ApiErrors.notFound('Alert')
      }

      return apiSuccess({ data: alert })
    } catch (prismaError: unknown) {
      throw prismaError
    }
})

/**
 * @swagger
 * /api/network/alerts/{id}:
 *   put:
 *     summary: Update network alert
 *     description: Memperbarui data alert jaringan
 *     tags: [Network Alerts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
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
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, ACKNOWLEDGED, RESOLVED, SUPPRESSED]
 *                 description: Alert status
 *               acknowledged:
 *                 type: boolean
 *                 description: Whether alert is acknowledged
 *               resolved:
 *                 type: boolean
 *                 description: Whether alert is resolved
 *               autoResolve:
 *                 type: boolean
 *                 description: Whether alert should auto-resolve
 *               autoResolveTime:
 *                 type: integer
 *                 minimum: 1
 *                 description: Auto-resolve time in minutes
 *     responses:
 *       200:
 *         description: Network alert updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Server error
 */
export const PUT = createHandler({ 
    auth: true,
    schema: networkAlertUpdateSchema
}, async (req, ctx) => {
    const { id } = ctx.params
    const data = ctx.validated

    try {
      const updateData: Record<string, unknown> = { ...data }

      if (data.acknowledged) {
        updateData.acknowledgedBy = ctx.session!.user.id
        updateData.acknowledgedAt = new Date()
      }

      if (data.resolved) {
        updateData.resolvedBy = ctx.session!.user.id
        updateData.resolvedAt = new Date()
      }

      if (data.severity) updateData.severity = data.severity
      if (data.status) updateData.status = data.status

      await prisma.networkAlerts.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      })

      // System Log
      logActivitySafe({
        action: 'UPDATE',
        subject: 'Network Alert',
        userId: ctx.session!.user.id,
        details: { id, updates: updateData }
      })

      return apiSuccess({ message: 'Alert berhasil diperbarui' })
    } catch (prismaError: unknown) {
      throw prismaError
    }
})

/**
 * @swagger
 * /api/network/alerts/{id}:
 *   delete:
 *     summary: Delete network alert
 *     description: Menghapus data alert jaringan
 *     tags: [Network Alerts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Network alert deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Server error
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params

    try {
      const alert = await prisma.networkAlerts.findUnique({
        where: { id },
      })

      if (!alert) {
        return ApiErrors.notFound('Alert')
      }

      await prisma.networkAlerts.delete({
        where: { id },
      })

      // System Log
      logActivitySafe({
        action: 'DELETE',
        subject: 'Network Alert',
        userId: ctx.session!.user.id,
        details: { id, title: alert.title }
      })

      return apiSuccess({ message: 'Alert berhasil dihapus' })
    } catch (prismaError: unknown) {
      throw prismaError
    }
})
