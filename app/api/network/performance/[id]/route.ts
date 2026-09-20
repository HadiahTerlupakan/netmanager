import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { NetworkPerformanceService } from "@/modules/network";

/**
 * @swagger
 * /api/network/performance/{id}:
 *   get:
 *     summary: Get network performance data by ID
 *     description: Mengambil data performa jaringan berdasarkan ID
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
 *         description: Performance data ID
 *     responses:
 *       200:
 *         description: Network performance data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NetworkPerformance'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Performance data not found
 *       500:
 *         description: Server error
 */
export const GET = createHandler(
  { auth: true, permissions: ["network:read"] },
  async (_req, ctx) => {
    const networkPerformanceService = new NetworkPerformanceService();

    try {
      const performanceData =
        await networkPerformanceService.getPerformanceById(ctx.params.id);

      if (!performanceData) {
        return ApiErrors.notFound("Data performa");
      }

      return apiSuccess(performanceData);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error as Error & { code?: string }).code === "P2021"
      ) {
        return ApiErrors.internalError(
          "Network performance monitoring will be available after database migration",
        );
      }

      throw error;
    }
  },
);
