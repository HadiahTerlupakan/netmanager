import * as z from "zod";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getNetworkPerformanceService } from "@/modules/network";

const historyQuerySchema = z.object({
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["timestamp", "cpuUsage", "memoryUsage", "temperature"])
    .default("timestamp"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * @swagger
 * /api/network/performance/{id}/history:
 *   get:
 *     summary: Get performance history for a device
 *     description: Mengambil riwayat performa untuk perangkat tertentu
 *     tags: [Network Performance]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Device ID
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
 *         description: Performance history retrieved successfully
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
 *       404:
 *         description: Device not found
 *       500:
 *         description: Server error
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const { id } = ctx.params;
  const { searchParams } = req.nextUrl;
  const queryParams = Object.fromEntries(searchParams.entries());

  const parsed = historyQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return ApiErrors.badRequest("Invalid query parameters", {
      errors: z.flattenError(parsed.error),
    });
  }

  const networkPerformanceService = getNetworkPerformanceService();
  const result = await networkPerformanceService.getPerformanceHistory(
    id,
    parsed.data,
  );

  return apiSuccess(result);
});
