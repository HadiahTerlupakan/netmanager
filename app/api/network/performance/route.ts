import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { NetworkPerformanceService } from "@/modules/network";
import {
  networkPerformanceCreateSchema,
  networkPerformanceQuerySchema,
} from "@/lib/validations/network-performance";
import * as z from "zod";

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
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const GET = createHandler(
  { auth: true, permissions: ["network:read"] },
  async (req, _ctx) => {
    const { searchParams } = req.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());

    const parsed = networkPerformanceQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return ApiErrors.badRequest("Invalid query parameters", {
        errors: z.flattenError(parsed.error),
      });
    }

    const networkPerformanceService = new NetworkPerformanceService();
    const result = await networkPerformanceService.getPerformanceList(
      parsed.data,
    );

    return apiSuccess(result);
  },
);

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
 *     responses:
 *       201:
 *         description: Network performance data created successfully
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
    permissions: ["network:create"],
    schema: networkPerformanceCreateSchema,
  },
  async (_req, ctx) => {
    const networkPerformanceService = new NetworkPerformanceService();
    const result = await networkPerformanceService.createPerformance(
      ctx.validated,
    );

    return apiSuccess(result, { status: 201 });
  },
);
