import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import { getNetworkAlertService } from "@/modules/network";
import {
  networkAlertCreateSchema,
  networkAlertQuerySchema,
} from "@/lib/validations/network-performance";
import * as z from "zod";
import type { NetworkAlertCreateData } from "@/lib/validations/network-performance";

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
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  const { searchParams } = req.nextUrl;
  const queryParams = Object.fromEntries(searchParams.entries());

  const parsed = networkAlertQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return ApiErrors.badRequest("Invalid query parameters", {
      errors: z.flattenError(parsed.error),
    });
  }

  const networkAlertService = getNetworkAlertService();
  const result = await networkAlertService.getAlertList(parsed.data);

  return apiSuccess(result);
});

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
export const POST = createHandler(
  {
    auth: true,
    schema: networkAlertCreateSchema,
  },
  async (_req, ctx) => {
    const data = ctx.validated as NetworkAlertCreateData;
    const networkAlertService = getNetworkAlertService();

    try {
      const result = await networkAlertService.createAlert(data);

      logActivitySafe({
        action: "CREATE",
        subject: "Network Alert",
        userId: ctx.session!.user.id,
        details: {
          id: result.id,
          title: data.title,
          severity: data.severity,
          deviceId: data.deviceId,
        },
      });

      return apiSuccess(result, { status: 201 });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error as Error & { code?: string }).code === "P2021"
      ) {
        return ApiErrors.internalError(
          "Network alerts will be available after database migration",
        );
      }

      throw error;
    }
  },
);
