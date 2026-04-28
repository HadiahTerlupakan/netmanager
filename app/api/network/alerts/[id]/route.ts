import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import { getNetworkAlertService } from "@/modules/network";
import { networkAlertUpdateSchema } from "@/lib/validations/network-performance";

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
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const networkAlertService = getNetworkAlertService();
  const alert = await networkAlertService.getAlertById(ctx.params.id);

  if (!alert) {
    return ApiErrors.notFound("Alert");
  }

  return apiSuccess(alert);
});

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
export const PUT = createHandler(
  {
    auth: true,
    schema: networkAlertUpdateSchema,
  },
  async (_req, ctx) => {
    const networkAlertService = getNetworkAlertService();
    const isUpdated = await networkAlertService.updateAlert({
      id: ctx.params.id,
      data: ctx.validated,
      userId: ctx.session!.user.id,
    });

    if (!isUpdated) {
      return ApiErrors.notFound("Alert");
    }

    logActivitySafe({
      action: "UPDATE",
      subject: "Network Alert",
      userId: ctx.session!.user.id,
      details: { id: ctx.params.id, updates: ctx.validated },
    });

    return apiSuccess({ message: "Alert berhasil diperbarui" });
  },
);

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
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const networkAlertService = getNetworkAlertService();
  const deletedAlert = await networkAlertService.deleteAlert(ctx.params.id);

  if (!deletedAlert) {
    return ApiErrors.notFound("Alert");
  }

  logActivitySafe({
    action: "DELETE",
    subject: "Network Alert",
    userId: ctx.session!.user.id,
    details: { id: ctx.params.id, title: deletedAlert.title },
  });

  return apiSuccess({ message: "Alert berhasil dihapus" });
});
